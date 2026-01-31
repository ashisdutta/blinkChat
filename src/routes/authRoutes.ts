import { Router } from "express";
import {
  register,
  login,
  logout,
  getMe,
  updateUser,
} from "../controllers/authController.js";
import { sendOtp, verifyOtp } from "../controllers/otpController.js";
import { sendOtpLimiter, verifyOtpLimiter } from "../middleware/rateLimiter.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  forgotPassword,
  resetPassword,
} from "../controllers/forgotPassController.js";
import { getAuthParams } from "../controllers/imageKitController.js";
const router = Router();

// --- OTP Routes ---
router.post("/send-otp", sendOtpLimiter, sendOtp);
router.post("/verify-otp", verifyOtpLimiter, verifyOtp);

// --- Auth Routes ---
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/imagekit", getAuthParams);

// Protected Route
router.get("/me", protect, getMe);
router.put("/update", protect,updateUser)

export default router;
