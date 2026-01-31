import prisma from "../utils/prisma.js";
import { type Request, type Response } from "express";
import { registerSchema, loginSchema } from "../types/types.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// --- Register ---
export const register = async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid inputs",
      errors: result.error.issues,
    });
  }

  const { userName, password, photo } = result.data;

  try {
    // READ VERIFICATION TOKEN FROM COOKIE
    const verificationToken = req.cookies.verify_token;

    if (!verificationToken) {
      return res.status(401).json({ message: "Email not verified" });
    }

    let decodedEmail: string;

    try {
      const decoded = jwt.verify(
        verificationToken,
        process.env.JWT_SECRET!
      ) as any;

      if (!decoded.isVerified || !decoded.email) {
        throw new Error("Invalid token payload");
      }

      decodedEmail = decoded.email;
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired verification token" });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ userName }, { email: decodedEmail }],
      },
    });

    if (existingUser) {
      return res.status(409).json({ message: "User or Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        userName,
        password: hashedPassword,
        email: decodedEmail,
        photo: photo || null,
      },
    });

    // ✅ CREATE AUTH TOKEN
    const token = jwt.sign(
      { userId: user.id, userName: user.userName },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    // ✅ SET AUTH COOKIE
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // ✅ DELETE VERIFICATION COOKIE (ONE-TIME USE)
    res.clearCookie("verify_token");

    return res.status(201).json({ message: "User created", userId: user.id });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Login ---

export const login = async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid inputs",
        errors: validation.error.format(),
      });
    }

    const { identifier, password } = validation.data;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { userName: identifier }, // Check if it matches a username
          { email: identifier }, // Check if it matches an email
        ],
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { userId: user.id, userName: user.userName },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    // Set Secure Cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/", // Ensure cookie is accessible on all routes
    });

    return res.json({
      message: "Login successful",
      user: { id: user.id, name: user.userName },
    });
  } catch (error) {
    console.error("Login Error:", error); // Log the actual error for debugging
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Logout ---
export const logout = (req: Request, res: Response) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "strict" : "lax",
  });
  res.json({ message: "Logged out successfully" });
};

// --- Me (Verify Session) ---
export const getMe = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  // If we reach here, the 'protect' middleware has already passed
  const user = await prisma.user.findUnique({
    where: { id: req.user?.userId },
    select: { id: true, userName: true, photo: true, email: true },
  });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json(user);
};



//update username data

export const updateUser = async (req:Request, res:Response)=>{
  const {userId} = req.user!;
  const {userName, photo} = req.body;
  try {
    const updated = await prisma.user.update({
      where:{
        id: userId as string
      },
      data:{
        userName,
        photo
      }
    })

    if(updated){
      return res.status(200).json({
        msg: "update successful"
      })
    }
  } catch (error) {
    return res.status(500).json({
      error
    })
  }
}