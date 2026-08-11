import express from "express";
import { protect } from "../middleware/auth.js";
import Conversation from "../models/Conversation.js";
import Notification from "../models/Notification.js";
import { asyncHandler, requireFields } from "../utils/http.js";

const router = express.Router();

router.get("/", protect, asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ members: req.user._id })
    .populate("members", "name avatar title")
    .sort({ updatedAt: -1 });
  res.json({ conversations });
}));

router.post("/:userId", protect, asyncHandler(async (req, res) => {
  const peerId = req.params.userId;
  if (peerId === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot start a conversation with yourself" });
  }

  let conversation = await Conversation.findOne({
    members: { $all: [req.user._id, peerId], $size: 2 }
  });

  if (!conversation) {
    conversation = await Conversation.create({ members: [req.user._id, peerId], messages: [] });
  }

  res.status(201).json({
    conversation: await conversation.populate("members", "name avatar title")
  });
}));

router.post("/:conversationId/messages", protect, asyncHandler(async (req, res) => {
  requireFields(req.body, ["text"]);
  const { text } = req.body;

  const conversation = await Conversation.findById(req.params.conversationId);
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });

  const isMember = conversation.members.some((id) => String(id) === String(req.user._id));
  if (!isMember) return res.status(403).json({ message: "Not a conversation member" });

  conversation.messages.push({ sender: req.user._id, text });
  await conversation.save();

  const recipient = conversation.members.find((id) => String(id) !== String(req.user._id));
  await Notification.create({
    recipient,
    actor: req.user._id,
    type: "message",
    text: `${req.user.name} sent you a message`
  });

  res.status(201).json({
    conversation: await conversation.populate("members", "name avatar title")
  });
}));

export default router;
