import { redis, CACHE_TTL } from "../utils/redis.js";
import prisma from "../utils/prisma.js";
import { tr } from "zod/v4/locales";

export const ChatService = {
  /**
   * CORE FUNCTION: Fetch messages based on cursor and direction
   */
  async getMessages(
    roomId: string,
    limit: number = 100,
    cursor?: number,
    direction: "older" | "newer" = "older"
  ) {
    const key = `chat:room:${roomId}`;

    // 1. Try to fetch from Redis first
    let messages: any[] = [];

    // SCENARIO A: new memeber -> Get latest 100
    if (!cursor) {
      // ZREVRANGE: Get highest scores (newest) first
      const raw = await redis.zrevrange(key, 0, limit - 1);
      messages = raw.map((s) => JSON.parse(s)).reverse(); // Reverse to show oldest -> newest
    }

    // SCENARIO B: Scroll Up (Pagination) -> Get older than cursor
    else if (direction === "older") {
      // ZREVRANGEBYSCORE: Get scores from (cursor - 1) down to -Infinity
      const raw = await redis.zrevrangebyscore(
        key,
        `(${cursor}`,
        "-inf",
        "LIMIT",
        0,
        limit
      );
      messages = raw.map((s) => JSON.parse(s)).reverse();
    }

    // SCENARIO C: Reconnect -> Get newer than cursor
    else if (direction === "newer") {
      // ZRANGEBYSCORE: Get scores from (cursor + 1) up to +Infinity
      const raw = await redis.zrangebyscore(
        key,
        `(${cursor}`,
        "+inf",
        "LIMIT",
        0,
        limit
      );
      messages = raw.map((s) => JSON.parse(s));
    }

    //  CACHE MISS CHECK:

    if (messages.length === 0 && direction !== "newer") {
      console.log(`⚠️ Cache miss for Room ${roomId}. Fetching from DB...`);
      messages = await this.fetchFromDB(roomId,limit, cursor);

      // OPTIONAL: Re-populate Redis (Cache-Aside)
      if (messages.length > 0) {
        const pipeline = redis.pipeline();
        messages.forEach((msg) => {
          const score = new Date(msg.createdAt).getTime();
          pipeline.zadd(key, score, JSON.stringify(msg));
        });
        pipeline.expire(key, CACHE_TTL);
        await pipeline.exec();
      }
    }

    return messages;
  },

  /**
   * Helper: Fallback to Database if Redis is empty
   */
  async fetchFromDB(roomId: string,limit: number, cursor?: number) {
    const msgs =  await prisma.chat
      .findMany({
        where: {
          roomId,
          ...(cursor
            ? {
                createdAt: { lt: new Date(cursor) }, // 'lt' = Less Than (Older)
              }
            : {}),
        },
        include:{
          user:{
            select:{
              userName:true
            }
          }
        },
        take: limit,
        orderBy: { createdAt: "desc" }, // Latest first
      })
      .then((msgs) => msgs.reverse());
      
      return msgs.map(msg => ({
        id: msg.id,
        text: msg.text,
        userId: msg.userId,
        userName: msg.user.userName,
        createdAt: msg.createdAt.toISOString(),
    }));// Return in chronological order
  },
};
