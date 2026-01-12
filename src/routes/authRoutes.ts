import express from "express";

const router = express.Router();

router.post("/signup", (req, res) => {});

router.get("/userInfo", (req, res) => {
  res.send("inside authRoutes");
});

export default router;
