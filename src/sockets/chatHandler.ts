import { Server, Socket } from "socket.io";
import { redis, CHAT_QUEUE_KEY, CACHE_TTL } from "../utils/redis.js";

export const chatHandler = (io: Server, socket: Socket) => {
    socket.on("send_message", async (data) => {
        const { roomId, message, userId, userName } = data;

        // 1. Generate Timestamp once so Cache & DB match perfectly
        const timestamp = Date.now(); 

        const chatPayload = {
            text: message,
            roomId,
            userId,
            userName,
            // Convert to ISO string for DB/Frontend consistency
            createdAt: new Date(timestamp).toISOString(), 
        };

        const payloadString = JSON.stringify(chatPayload);
        const roomCacheKey = `chat:room:${roomId}`;

        try {
            // A. Optimistic Update (Fastest)
            io.to(roomId).emit("receive_message", chatPayload);

            // ---------------------------------------------------------
            // B. CACHE (ZSET) - For "Recent History"
            // ---------------------------------------------------------
            // We use a "Pipeline" to send multiple commands in one network round-trip
            const pipeline = redis.pipeline();

            // 1. Add to Sorted Set (Score = Timestamp)
            pipeline.zadd(roomCacheKey, timestamp, payloadString);
            
            // 2. Reset the Expiry Timer (Keep cache alive while active)
            pipeline.expire(roomCacheKey, CACHE_TTL);

            // 3. Queue for DB (The Worker will pick this up)
            pipeline.rpush(CHAT_QUEUE_KEY, payloadString);

            // Execute all Redis commands at once
            await pipeline.exec();
            
            console.log(`📨 Handled Room ${roomId} (Cached & Queued)`);

        } catch (error) {
            console.error("Redis Error:", error);
            socket.emit("error", { message: "Message failed to process" });
        }
    });
};
