// import { Server } from "socket.io";
// import { chatHandler } from "./chatHandler.js";

// export const initializeSockets = (io: Server) => {
//     io.on("connection", (socket) => {
//     console.log("🟢 User Connected:", socket.id);

//     // Join a Room (Basic logic)
//     socket.on("join_room", (roomId:string) => {
//         socket.join(roomId);
//         console.log(`User ${socket.id} joined room ${roomId}`);
//     });

//     // Attach Chat Logic
//     chatHandler(io, socket);
    
//     socket.on("disconnect", () => {
//         console.log("🔴 User Disconnected:", socket.id);
//         });
//     });
// };


import { Server } from "socket.io";
import { chatHandler } from "./chatHandler.js";
import { socketAuth } from "../middleware/socketAuth.middleware.js"; // Import middleware

export const initializeSockets = (io: Server) => {
    
    // 🛑 APPLY MIDDLEWARE HERE
    io.use(socketAuth);

    io.on("connection", (socket) => {
        // By now, the user is authenticated
        const userName = socket.data.user?.userName || "Unknown";
        console.log(`🟢 User Connected: ${userName} (${socket.id})`);

        socket.on("join_room", (roomId: string) => {
            socket.join(roomId);
            console.log(`User ${userName} joined room ${roomId}`);
        });

        // Attach Chat Logic
        chatHandler(io, socket);

        socket.on("disconnect", () => {
            console.log("🔴 User Disconnected:", socket.id);
        });
    });
};