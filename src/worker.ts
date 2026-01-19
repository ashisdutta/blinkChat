import { redis, CHAT_QUEUE_KEY } from "./utils/redis.js";
import prisma from "./utils/prisma.js"; // Uses your Singleton

const BATCH_SIZE = 50;

async function startWorker() {
    console.log("-----------------------------------------");
    console.log("👷 Worker Service Started");
    console.log("-----------------------------------------");

    while (true) {
        try {
            // 1. Check if there are messages in the queue
            const queueLength = await redis.llen(CHAT_QUEUE_KEY);

            if (queueLength > 25) {
                // Process if we have a full batch OR if needed (you can tweak logic)
                // For high-scale, we usually wait for at least a few messages
                const fetchCount = Math.min(queueLength, BATCH_SIZE);
                
                console.log(`📦 Processing ${fetchCount} messages...`);
                
                // 2. Pop messages from Redis
                const rawMessages = await redis.lpop(CHAT_QUEUE_KEY, BATCH_SIZE);

                if (rawMessages && rawMessages.length > 0) {
                    const dataToInsert = rawMessages.map((msg) => {
                        const parsed = JSON.parse(msg);
                        
                        // 3. MAP JSON TO PRISMA SCHEMA
                        return {
                            text: parsed.text,      // Matches 'text' in Schema
                            roomId: parsed.roomId,  // Matches 'roomId' in Schema
                            userId: parsed.userId   // Matches 'userId' in Schema
                            // 'createdAt' is handled by @default(now()) in DB
                        };
                    });

                    // 4. Bulk Insert into Postgres
                    // IMPORTANT: This will fail if userId or roomId don't exist in DB
                    await prisma.chat.createMany({ 
                        data: dataToInsert 
                    });
                    
                    console.log(`✅ Saved ${dataToInsert.length} messages to DB.`);
                }
            } else {
                // 5. If queue is empty, sleep for 1 second to save CPU
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error("❌ Worker Error:", error);
            // Sleep longer on error (e.g., DB is down)
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

startWorker();