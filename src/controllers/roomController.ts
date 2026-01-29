import { type Request, type Response } from "express";
import prisma from "../utils/prisma.js";
import { createRoomSchema } from "../types/types.js";
import { validateLocation } from "./geoController.js";
import { getDistance } from "geolib";
import { redis } from "../utils/redis.js";

export const createRoom = async (req: Request, res: Response) => {
  const parsedRoom = createRoomSchema.safeParse(req.body);
  if (!parsedRoom.success) {
    return res.status(411).json({
      message: "incorrect room data schema",
    });
  }

  const { name, latitude, longitude, description } = req.body;
  if (!req.user) {
    return res.json({
      message: "userId is not present",
    });
  }

  let cleanLocation;
  try {
    cleanLocation = validateLocation(latitude, longitude);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const newRoom = await prisma.room.create({
      data: {
        name,
        description,
        latitude: cleanLocation.latitude,
        longitude: cleanLocation.longitude,
        ownerId: req.user.userId,
        members: {
          connect: {
            id: req.user.userId,
          },
        },
      },
    });

    return res.status(200).json({
      message: "room created successfully",
      roomId: newRoom.id,
    });
  } catch (error) {
    res.status(500).json({ message: "Database creation failed" });
  }
};

export const getNearbyRooms = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.query;
    let userLoc;
    try {
      userLoc = validateLocation(Number(latitude), Number(longitude));
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }

    const allRooms = await prisma.room.findMany();
    const visibleRooms = allRooms.filter((room) => {
      const dist = getDistance(
        { latitude: userLoc.latitude, longitude: userLoc.longitude },
        { latitude: room.latitude, longitude: room.longitude }
      );
      return dist <= room.radius;
    });

    res.status(200).json({
      message: "Success",
      count: visibleRooms.length,
      rooms: visibleRooms,
    });
  } catch (error: any) {
    console.error("Error finding rooms:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 3. Edit Room info
export const editRoomsInfo = async (req: Request, res: Response) => {
  const { name, description } = req.body;
  const { roomId } = req.params;
  const { userId } = req.user!;

  const existingRoom = await prisma.room.findFirst({
    where: {
      id: roomId as string,
      members: {
        some: {
          id: userId,
        },
      },
    },
  });

  if (!existingRoom) {
    return res.status(403).json({
      message: "You are not allowed to edit this room (Not a member).",
    });
  }

  try {
    const updatedRoom = await prisma.room.updateMany({
      where: {
        id: roomId as string,
      },
      data: {
        name: name,
        description:description
      },
    });

    return res.json({ message: "Room updated"});
  } catch (error) {
    return res.status(500).json({
      error: error,
    });
  }
};

export const DeleteRooms = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.user!;

    const room = await prisma.room.findUnique({
      where: {
        id: roomId as string,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.ownerId !== userId) {
      return res.status(403).json({
        message: "Permission denied. Only the owner can delete this room.",
      });
    }

    if (room._count.members > 20) {
      return res.status(400).json({
        message: `Cannot delete room. It has ${room._count.members} active members (Limit is 20).`,
      });
    }

    await prisma.room.delete({
      where: {
        id: roomId as string,
      },
    });

    return res.status(200).json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const joinRoom = async (req: Request, res: Response) => {
  const { roomId } = req.query;
  const { userId } = req.user!;

  try {
    // update the ROOM to include the USER in its 'members' list
    const updatedRoom = await prisma.room.update({
      where: {
        id: roomId as string,
      },
      data: {
        members: {
          connect: {
            id: userId,
          },
        },
      },
      // Include members in response to confirm they were added
      include: {
        members: true,
      },
    });

    res.status(200).json({
      message: "User added to room successfully",
      room: updatedRoom,
    });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({ error: "Unable to join room" });
  }
};

export const allJoinedRooms = async (req: Request, res: Response) => {
  const { userId } = req.user!;

  try {
    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: {
            id: userId as string,
          },
        },
      },
      select: {
        id: true,
        name: true,
        photo: true,
      },
    });

    if (rooms.length === 0) {
      return res.status(200).json([]);
    }

    //last message from Redis(Pipeline for speed)
    const pipeline = redis.pipeline();
    rooms.forEach((room) => {
      const roomKey = `chat:room:${room.id}`;
      pipeline.zrevrange(roomKey, 0, 0);
    });

    const redisResults = await pipeline.exec();

    //If Redis fails, mark as "needs fetch"
    // We map this to a Promise array to handle DB fetches asynchronously
    const roomPromises = rooms.map(async (room, index) => {
      const [error, result] = redisResults![index] ?? [null, null];

      let lastMessage = null;
      let lastMessageTime = null;

      // CHECK REDIS FIRST
      if (!error && Array.isArray(result) && result.length > 0) {
        try {
          const payload = JSON.parse(result[0]);
          lastMessage = payload.text;
          lastMessageTime = payload.createdAt;
        } catch (e) {
          console.error(`Error parsing cache for room ${room.id}`, e);
        }
      }

      // IF REDIS MISS (null data), FETCH FROM DB
      if (!lastMessage || !lastMessageTime) {
        const dbChat = await prisma.chat.findFirst({
          where: { roomId: room.id },
          orderBy: { createdAt: "desc" }, // Get the newest one
          select: {
            text: true,
            createdAt: true,
          },
        });

        if (dbChat) {
          lastMessage = dbChat.text;
          lastMessageTime = dbChat.createdAt;

          //in future write in cache again! for fist retrival
        }
      }

      return {
        id: room.id,
        name: room.name,
        photo: room.photo,
        lastMessage,
        lastMessageTime,
      };
    });

    // Resolve all promises
    const formattedRooms = await Promise.all(roomPromises);

    //Sort rooms by latest activity
    formattedRooms.sort((a, b) => {
      const timeA = a.lastMessageTime
        ? new Date(a.lastMessageTime).getTime()
        : 0;
      const timeB = b.lastMessageTime
        ? new Date(b.lastMessageTime).getTime()
        : 0;
      return timeB - timeA;
    });

    res.status(200).json(formattedRooms);
  } catch (error) {
    console.error("Error fetching joined rooms:", error);
    res.status(500).json({ error: "Unable to fetch joined rooms" });
  }
};


export const getRoomInfo = async (req: Request, res: Response) => {
  const { roomId } = req.params;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId as string},
      select: {
        id: true,
        name: true,
        photo: true,
        description: true, // <--- Add this (Ensure it exists in your Prisma Schema!)
        ownerId: true,     // Useful to know if I can edit settings
        createdAt: true,
        members: {         // <--- Fetch actual members
          select: {
            id: true,
            userName: true, // or 'name', whatever your User model has
            email: true,
            // photo: true  // if users have photos
          }
        },
        _count: { select: { members: true } }
      }
    });

    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: "Error fetching room" });
  }
};


// leave room //
export const leaveRoom = async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userId } = req.user!;

  try {
    await prisma.room.update({
      where: { 
        id: roomId as string
      },
      data: {
        members: {
          disconnect: {
            id: userId
          }
        }
      }
    });

    return res.status(200).json({ message: "Successfully left the room" });

  } catch (error) {
    console.error("Leave Room Error:", error);
    return res.status(500).json({ message: "Failed to leave room" });
  }
};