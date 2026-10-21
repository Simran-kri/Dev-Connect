import express from "express";
import { protect } from "../middleware/auth.js";
import Group from "../models/Group.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
  const groups = await Group.find()
    .populate("owner", "name avatar")
    .populate("members", "name avatar")
    .sort({ createdAt: -1 });
  res.json({ groups });
});

router.post("/", protect, async (req, res) => {
  const { name, description = "" } = req.body;
  if (!name) return res.status(400).json({ message: "Group name is required" });

  const group = await Group.create({
    name,
    description,
    owner: req.user._id,
    members: [req.user._id]
  });

  res.status(201).json({ group: await group.populate("owner", "name avatar") });
});

router.get("/:id", protect, async (req, res) => {
  const group = await Group.findById(req.params.id)
    .populate("owner", "name avatar")
    .populate("members", "name avatar")
    .populate("messages.sender", "name avatar");

  if (!group) return res.status(404).json({ message: "Group not found" });

  const isMember = group.members.some((member) => String(member._id) === String(req.user._id));
  if (!isMember) {
    return res.status(403).json({ message: "Join this group to see its chat." });
  }

  // Only send the most recent messages, same reasoning as live Rooms - a
  // group chat isn't meant to load its entire history on every visit.
  const recentMessages = group.messages.slice(-100);
  res.json({ group: { ...group.toObject(), messages: recentMessages } });
});

router.delete("/:id", protect, async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  const isOwner = String(group.owner) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only the group owner can delete this group" });
  }

  await group.deleteOne();
  res.json({ ok: true });
});

router.post("/:id/join", protect, async (req, res) => {
  const group = await Group.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { members: req.user._id } },
    { new: true }
  )
    .populate("owner", "name avatar")
    .populate("members", "name avatar");

  if (!group) return res.status(404).json({ message: "Group not found" });
  res.json({ group });
});

router.post("/:id/leave", protect, async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  if (String(group.owner) === String(req.user._id)) {
    return res.status(400).json({ message: "The owner cannot leave the group. Delete it instead." });
  }

  group.members = group.members.filter((id) => String(id) !== String(req.user._id));
  await group.save();

  const populated = await Group.findById(group._id)
    .populate("owner", "name avatar")
    .populate("members", "name avatar");
  res.json({ group: populated });
});

router.post("/:id/posts", protect, async (req, res) => {
  const { text, fileUrl = "" } = req.body;
  if (!text) return res.status(400).json({ message: "Post text is required" });

  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  group.posts.push({ author: req.user._id, text, fileUrl });
  await group.save();

  res.status(201).json({
    group: await Group.findById(group._id)
      .populate("owner", "name avatar")
      .populate("members", "name avatar")
      .populate("posts.author", "name avatar")
  });
});

export default router;