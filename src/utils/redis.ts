import { Redis } from "ioredis";

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = Number(process.env.REDIS_PORT) || 6379;

// 1. Connection for General Operations (Caching, etc.)
export const redis = new Redis({
    host: redisHost,
    port: redisPort,
});

// 2. Constants
export const CHAT_QUEUE_KEY = "chat:postgres_queue";
export const CACHE_TTL = 60 * 60 * 2;