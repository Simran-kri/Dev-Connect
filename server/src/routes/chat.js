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

router.post("/group", protect, asyncHandler(async (req, res) => {
  const { name, memberIds } = req.body;
  requireFields(req.body, ["name", "memberIds"]);

  const uniqueOthers = [...new Set((memberIds || []).map(String))].filter(
    (id) => id !== String(req.user._id)
  );

  if (uniqueOthers.length < 2) {
    return res.status(400).json({ message: "Pick at least 2 other people to start a group" });
  }

  const conversation = await Conversation.create({
    name: name.trim(),
    isGroup: true,
    admin: req.user._id,
    members: [req.user._id, ...uniqueOthers],
    messages: []
  });

  res.status(201).json({
    conversation: await conversation.populate("members", "name avatar title")
  });
}));

router.post("/:userId", protect, asyncHandler(async (req, res) => {
  const peerId = req.params.userId;
  if (peerId === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot start a conversation with yourself" });
  }

  let conversation = await Conversation.findOne({
    members: { $all: [req.user._id, peerId], $size: 2 },
    isGroup: false
  });

  if (!conversation) {
    conversation = await Conversation.create({ members: [req.user._id, peerId], messages: [] });
  }

  res.status(201).json({
    conversation: await conversation.populate("members", "name avatar title")
  });
}));

router.post("/:conversationId/messages", protect, asyncHandler(async (req, res) => {
  const { text, audioUrl } = req.body;
  if (!text?.trim() && !audioUrl) {
    return res.status(400).json({ message: "Message needs text or a voice note" });
  }

  const conversation = await Conversation.findById(req.params.conversationId);
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });

  const isMember = conversation.members.some((id) => String(id) === String(req.user._id));
  if (!isMember) return res.status(403).json({ message: "Not a conversation member" });

  conversation.messages.push({ sender: req.user._id, text: text || "", audioUrl: audioUrl || "" });
  await conversation.save();

  const recipients = conversation.members.filter((id) => String(id) !== String(req.user._id));
  await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient,
      actor: req.user._id,
      type: "message",
      text: conversation.isGroup
        ? `${req.user.name} sent a message in ${conversation.name}`
        : `${req.user.name} sent you a message`
    }))
  );

  res.status(201).json({
    conversation: await conversation.populate("members", "name avatar title")
  });
}));

export default router;
