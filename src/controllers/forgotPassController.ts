import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { redis } from "../utils/redis.js"; 
import prisma from "../utils/prisma.js"; 
import "dotenv/config";


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const forgotPassword = async (req:Request, res:Response)=>{
    const {email} = req.body;

    if (!email) {
    return res.status(400).json({ message: "Email is required" });
    }

    try {
        const user = await prisma.user.findFirst({where:{email}});

        if (!user) {
            return res.status(200).json({ message: "If account exists, email sent" });
        }

        const token = jwt.sign({email}, process.env.JWT_SECRET!, {expiresIn:"10m"})
        await redis.setex(`reset_token:${token}`, 600, "valid");
        const resetLink = `${process.env.CLIENT_URL}/resetpassword?token=${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Reset your Password",
            html: `
                <h3>Password Reset Request</h3>
                <p>Click the link below to reset your password:</p>
                <a href="${resetLink}" target="_blank">Reset Password</a>
                <p>This link expires in 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `,
        });
        return res.status(200).json({ message: "Reset link sent" });
    } catch (error) {
        return res.status(500).json({ message: "Error sending email" });
    }
}


export const resetPassword = async (req:Request, res:Response)=>{
    const {token, newPassword} = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: "Missing token or password" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };
        const isTokenActive = await redis.get(`reset_token:${token}`);

        if (!isTokenActive) {
            return res.status(400).json({ message: "Link already used or expired" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { email: decoded.email },
            data: { password: hashedPassword },
        });
        await redis.del(`reset_token:${token}`);
        return res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        return res.status(400).json({ message: "Invalid or expired token" });
    }
}