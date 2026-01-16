import rateLimit from "express-rate-limit";

// 1. Cooldown: Allow 1 request every 1 minutes
// "Resend OTP option after 1min"
export const sendOtpLimiter = rateLimit({
  windowMs: 20 * 1000, // 20 sec
  max: 1, // Limit each IP to 1 request per windowMs
  message: { message: "Please wait a minutes before resending OTP." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const verifyOtpLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 10 minutes
  max: 3,
  message: { message: "Too many failed attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
