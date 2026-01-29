import { type Request, type Response } from "express";
import { ChatService } from "../servies/chatService.js";

export const getRoomMessages = async (req: Request, res: Response) => {
  const { roomId} = req.params;
  const { cursor, direction = "older", limit = "100" } = req.query;

  // Convert types safely
  const limitNum = parseInt(limit as string);
  const cursorNum = cursor ? parseInt(cursor as string) : undefined;
  const dir = direction === "newer" ? "newer" : "older";

  try {
    const messages = await ChatService.getMessages(
      roomId as string,
      limitNum,
      cursorNum,
      dir
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
      // Helper for frontend:
      // If we have messages, the new "cursor" is the timestamp of the first or last msg
      nextCursor:
        messages.length > 0
          ? dir === "older"
            ? messages[0].createdAt
            : messages[messages.length - 1].createdAt
          : null,
    });
  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};
