import prisma from "../utils/prisma.js";
import { type Request, type Response } from "express";
import { signupInputSchema, signinInputSchema } from "../types.js";
import  jwt from "jsonwebtoken";
import "dotenv/config";

const signToken = async (id:string, username:string) => {
    return jwt.sign({ id, username}, process.env.JWT_SECRET as string, {
        expiresIn: '30d' // Token expires in 30 days
    });
};


export const signup = async (req:Request, res:Response)=>{
    const {username, password, email} = req.body;

    const {success} = signupInputSchema.safeParse({username, password, email})

    if(!success){
        return res.status(411).json({
            message:"incorrect input"
        })
    }

    try {
        const user = await prisma.user.create({
            data:{
                userName:username,
                email,
                password
            }
        })


        return res.status(200).json({
            status:"user created successfully",
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
}

export const signin = async (req:Request, res:Response)=>{
    const {username, password} = req.body;
    const {success} = signinInputSchema.safeParse({username, password});

    if(!success){
        return res.status(411).json({
            message:"incorrect input"
        })
    }

    try {
        const user = await prisma.user.findUnique({
            where:{
                userName:username,
                password
            }
        })

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = signToken(user?.id, user?.userName);
        return res.status(200).json({
            token: token
        })

    } catch (error) {
        return res.status(500).json({ message: 'Server Error' });
    }
}