import { z } from "zod";

export const registerSchema = z.object({
  userName: z.string().min(3),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Username or Email is required"),
  password: z.string(),
});

export const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  description: z.string().optional(),
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be -90 or greater")
    .max(90, "Latitude must be 90 or less"),

  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be -180 or greater")
    .max(180, "Longitude must be 180 or less"),
});
