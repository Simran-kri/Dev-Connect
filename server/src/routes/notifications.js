import express from "express";
import { protect } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate("actor", "name avatar")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ notifications });
});

router.patch("/read", protect, async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
});

export default router;

