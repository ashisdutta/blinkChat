import z from "zod"

export const signupInputSchema = z.object({
    name: z.string(),
    username: z.email(),
    password: z.string().min(8)
})


export const signinInputSchema = z.object({
    username: z.email(),
    password: z.string().min(8)
})

export const createRoomSchema = z.object({
    name: z.string()
})