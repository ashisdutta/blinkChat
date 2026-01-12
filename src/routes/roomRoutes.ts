import express from "express";

const router = express.Router();

router.post("/CreateRoom", (req, res) => {});

router.get("/roomInfo", (req, res) => {
  res.send("inside roomRoutes");
});

export default router;
