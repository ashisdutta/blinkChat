import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { type JwtPayload } from "../types/definitions.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// 1. Extend Socket interface to include user data
export interface AuthSocket extends Socket {
  data: {
    user?: JwtPayload;
  };
}

export const socketAuth = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error("Authentication error: No cookies found"));
    }

    const cookies = cookie.parse(cookieHeader);
    const token = cookies.auth_token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    socket.data.user = decoded;

    next();
  } catch (error) {
    console.error("Socket Auth Error:", error);
    next(new Error("Authentication error: Invalid token"));
  }
};
