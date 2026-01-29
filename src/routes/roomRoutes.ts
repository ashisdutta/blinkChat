import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getRoomMessages } from "../controllers/chatController.js";
import { editRoomsInfo, getRoomInfo } from "../controllers/roomController.js";

// Import the Logic
import {
  allJoinedRooms,
  createRoom,
  getNearbyRooms,
  joinRoom,
  leaveRoom
} from "../controllers/roomController.js";

const router = express.Router();

router.post("/create", protect, createRoom);
router.get("/nearby", protect, getNearbyRooms);
router.post("/join", protect, joinRoom);
router.get("/joined", protect, allJoinedRooms);
router.post("/:roomId/leave", protect, leaveRoom);
router.put("/:roomId/update", protect, editRoomsInfo);
router.get("/:roomId/messages", protect, getRoomMessages);
router.get("/:roomId", protect, getRoomInfo);

export default router;
