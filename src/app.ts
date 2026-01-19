import express, { type Express } from "express";
import { createServer } from "http"; // <--- Essential for Socket.io
import { Server } from "socket.io";  // <--- Essential for Socket.io
import mainRouter from "./routes/index.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import { initializeSockets } from "./sockets/socketHandler.js"; // <--- Your Socket Logic

dotenv.config();

const app: Express = express();
const httpServer = createServer(app); // <--- Wrap Express in a raw Server

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());

// Define CORS once (Shared by both Express and Socket.io)
const corsOptions = {
  origin: "http://localhost:3000", // Your Frontend URL
  credentials: true,               // Allow cookies
};

// Apply CORS to Express
app.use(cors(corsOptions));

// Initialize Socket.io attached to the HTTP Server
const io = new Server(httpServer, {
  cors: corsOptions, // <--- Apply same CORS settings
});

// Attach your socket logic
initializeSockets(io);

// Attach API Routes
app.use("/api", mainRouter);

// Health Check
app.get("/", (req, res) => {
  res.send("Ephemeral Chat Backend is running...");
});

// CRITICAL: Listen on httpServer, NOT app
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});