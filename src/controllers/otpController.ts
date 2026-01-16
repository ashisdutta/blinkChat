import { type Request, type Response } from "express";
import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";
import jwt from "jsonwebtoken";
import "dotenv/config";

// --- In-Memory Store for OTPs ---
// In production, use Redis!
interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
}
const otpStore = new Map<string, OtpRecord>();

// --- Email Configuration ---
const transporter = nodemailer.createTransport({
  service: "gmail", // Or your SMTP provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- 1. Send OTP ---
export const sendOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Generate 6-digit numeric OTP
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  // Store OTP (Valid for 3 mins)
  otpStore.set(email, {
    otp,
    expiresAt: Date.now() + 3 * 60 * 1000,
    attempts: 0,
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Verification Code",
      text: `Your verification code is ${otp}. It expires in 3 minutes.`,
    });

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Email Error:", error);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

// --- 2. Verify OTP ---
export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const record = otpStore.get(email);

  // Check existence
  if (!record) {
    return res
      .status(400)
      .json({ message: "OTP not found. Please request a new one." });
  }

  // Check expiry
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ message: "OTP expired." });
  }

  // Check validity
  if (record.otp !== otp) {
    record.attempts += 1;
    otpStore.set(email, record); // Update attempts

    if (record.attempts >= 3) {
      otpStore.delete(email); // Anti-Brute Force: Delete after 3 fails
      return res
        .status(400)
        .json({ message: "Too many wrong attempts. OTP invalidated." });
    }

    return res.status(400).json({ message: "Invalid OTP" });
  }

  // --- Success ---
  otpStore.delete(email); // Prevent reuse

  // Generate a temporary "Registration Token"
  // This token contains the EMAIL and proves it was verified.
  const verificationToken = jwt.sign(
    { email, isVerified: true },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" } // User has 15 mins to complete registration form
  );

  return res.status(200).json({
    message: "Email verified",
    verificationToken, // Frontend must send this to /register
  });
};
