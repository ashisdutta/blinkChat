// import { Server, Socket } from "socket.io";
// import { redis, CHAT_QUEUE_KEY, CACHE_TTL } from "../utils/redis.js";

// export const chatHandler = (io: Server, socket: Socket) => {
//   socket.on("send_message", async (data) => {
//     const { roomId, message, userId, userName } = data;

//     // 1. Generate Timestamp once so Cache & DB match perfectly
//     const timestamp = Date.now();

//     const chatPayload = {
//       text: message,
//       roomId,
//       userId,
//       userName,
//       // Convert to ISO string for DB/Frontend consistency
//       createdAt: new Date(timestamp).toISOString(),
//     };

//     const payloadString = JSON.stringify(chatPayload);
//     const roomCacheKey = `chat:room:${roomId}`;

//     try {
//       // A. Optimistic Update (Fastest)
//       io.to(roomId).emit("receive_message", chatPayload);

//       // ---------------------------------------------------------
//       // B. CACHE (ZSET) - For "Recent History"
//       // ---------------------------------------------------------
//       // We use a "Pipeline" to send multiple commands in one network round-trip
//       const pipeline = redis.pipeline();

//       // 1. Add to Sorted Set (Score = Timestamp)
//       pipeline.zadd(roomCacheKey, timestamp, payloadString);

//       // 2. Reset the Expiry Timer (Keep cache alive while active)
//       pipeline.expire(roomCacheKey, CACHE_TTL);

//       // 3. Queue for DB (The Worker will pick this up)
//       pipeline.rpush(CHAT_QUEUE_KEY, payloadString);

//       // Execute all Redis commands at once
//       await pipeline.exec();

//       console.log(`📨 Handled Room ${roomId} (Cached & Queued)`);
//     } catch (error) {
//       console.error("Redis Error:", error);
//       socket.emit("error", { message: "Message failed to process" });
//     }
//   });
// };


import { Server, Socket } from "socket.io";
import { redis, CHAT_QUEUE_KEY, CACHE_TTL } from "../utils/redis.js";
import { type AuthSocket } from "../middleware/socketAuth.middleware.js";

export const chatHandler = (io: Server, socket: Socket) => {
  // Cast socket to our custom type so TypeScript knows about .data.user
  const authSocket = socket as AuthSocket;

  authSocket.on("send_message", async (data) => {
    // 🛑 1. REMOVE userId/userName from the incoming data
    const { roomId, message } = data;

    // 🛑 2. GET USER FROM SECURE SOCKET DATA
    // The middleware ensures this exists
    const currentUser = authSocket.data.user!; 
    
    const userId = currentUser.userId;
    const userName = currentUser.userName;

    // 3. Generate Timestamp
    const timestamp = Date.now();

    const chatPayload = {
      text: message,
      roomId,
      userId,   // Securely obtained
      userName, // Securely obtained
      createdAt: new Date(timestamp).toISOString(),
    };

    const payloadString = JSON.stringify(chatPayload);
    const roomCacheKey = `chat:room:${roomId}`;

    try {
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