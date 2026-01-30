import { Server, Socket } from "socket.io";
import { redis, CHAT_QUEUE_KEY, CACHE_TTL } from "../utils/redis.js";
import { type AuthSocket } from "../middleware/socketAuth.middleware.js";
import prisma from "../utils/prisma.js";
import { userInfo } from "node:os";

export const chatHandler = (io: Server, socket: Socket) => {
  // Cast socket to our custom type so TypeScript knows about .data.user
  const authSocket = socket as AuthSocket;

  authSocket.on("send_message", async (data) => {
    const { roomId, message } = data;
    const currentUser = authSocket.data.user!;
    const userId = currentUser.userId;
    const userName = currentUser.userName;

    try {
      // 👇 2. LOGIC FOR PHOTO: Fetch only the photo from DB
      const userInfo = await prisma.user.findUnique({
        where: { id: userId },
        select: { photo: true }, // We only need the photo field
      });

      const timestamp = Date.now();

      const chatPayload = {
        id: crypto.randomUUID(), // temporary ID for list keys
        text: message,
        roomId,
        userId, // Securely obtained
        userName, // Securely obtained
        createdAt: new Date(timestamp).toISOString(),
        user: {
          userName: userName,
          photo: userInfo?.photo || null,
        },
      };

      const payloadString = JSON.stringify(chatPayload);
      const roomCacheKey = `chat:room:${roomId}`;

      // Optimistic Update
      io.to(roomId).emit("receive_message", chatPayload);

      // Redis Pipeline
      const pipeline = redis.pipeline();
      pipeline.zadd(roomCacheKey, timestamp, payloadString);
      pipeline.expire(roomCacheKey, CACHE_TTL);
      pipeline.rpush(CHAT_QUEUE_KEY, payloadString);

      await pipeline.exec();

      console.log(`📨 Message sent in ${roomId} by ${userName}`);
    } catch (error) {
      console.error("Redis Error:", error);
      socket.emit("error", { message: "Message failed to process" });
    }
  });
};
