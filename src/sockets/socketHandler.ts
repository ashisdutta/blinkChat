import { Server } from "socket.io";
import { chatHandler } from "./chatHandler.js";

export const initializeSockets = (io: Server) => {
    io.on("connection", (socket) => {
    console.log("🟢 User Connected:", socket.id);

    // Join a Room (Basic logic)
    socket.on("join_room", (roomId:string) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Attach Chat Logic
    chatHandler(io, socket);
    
    socket.on("disconnect", () => {
        console.log("🔴 User Disconnected:", socket.id);
        });
    });
};