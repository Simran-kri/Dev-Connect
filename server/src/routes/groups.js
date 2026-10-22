import crypto from "crypto";
import express from "express";
import { protect } from "../middleware/auth.js";
import Group from "../models/Group.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const router = express.Router();

const populateGroup = [
  { path: "owner", select: "name avatar" },
  { path: "members", select: "name avatar" }
];

function newInviteCode() {
  return crypto.randomBytes(8).toString("hex");
}

// A group is only found if you are a member. For anyone else it behaves
// exactly like a group that doesn't exist.
async function findMyGroup(id, userId) {
  return Group.findOne({ _id: id, members: userId });
}

function isOwnerOf(group, userId) {
  return String(group.owner) === String(userId);
}

// Only groups you belong to are listed.
router.get("/", protect, async (req, res) => {
  const groups = await Group.find({ members: req.user._id })
    .populate(populateGroup)
    .sort({ createdAt: -1 });
  res.json({ groups });
});

router.post("/", protect, async (req, res) => {
  const { name, description = "" } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Group name is required" });

  const group = await Group.create({
    name: name.trim(),
    description,
    owner: req.user._id,
    members: [req.user._id],
    inviteCode: newInviteCode()
  });

  res.status(201).json({ group: await group.populate(populateGroup) });
});

// Joining through an invite link. The code is secret, so only people who
// were given the link can join.
router.post("/join/:code", protect, async (req, res) => {
  const group = await Group.findOneAndUpdate(
    { inviteCode: req.params.code },
    { $addToSet: { members: req.user._id } },
    { new: true }
  ).populate(populateGroup);

  if (!group) return res.status(404).json({ message: "This invite link is invalid or has been reset." });
  res.json({ group });
});

// Any member can get the invite link. Only the owner can reset it, which
// makes all old links stop working.
router.post("/:id/invite-link", protect, async (req, res) => {
  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  const reset = req.body?.reset === true;
  if (reset && !isOwnerOf(group, req.user._id)) {
    return res.status(403).json({ message: "Only the owner can reset the invite link" });
  }

  if (!group.inviteCode || reset) {
    group.inviteCode = newInviteCode();
    await group.save();
  }
  res.json({ inviteCode: group.inviteCode });
});

// Any member can add a person directly.
router.post("/:id/members", protect, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "Pick a person to add" });

  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  const target = await User.findById(userId).select("_id name");
  if (!target) return res.status(404).json({ message: "User not found" });

  const alreadyMember = group.members.some((m) => String(m) === String(target._id));
  if (!alreadyMember) {
    group.members.push(target._id);
    await group.save();

    await Notification.create({
      recipient: target._id,
      actor: req.user._id,
      type: "group",
      text: `${req.user.name} added you to ${group.name}`
    });
  }

  res.json({ group: await Group.findById(group._id).populate(populateGroup) });
});

// Only the owner can remove someone.
router.delete("/:id/members/:userId", protect, async (req, res) => {
  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  if (!isOwnerOf(group, req.user._id)) {
    return res.status(403).json({ message: "Only the owner can remove members" });
  }
  if (String(req.params.userId) === String(group.owner)) {
    return res.status(400).json({ message: "The owner can't be removed. Delete the group instead." });
  }

  group.members = group.members.filter((id) => String(id) !== String(req.params.userId));
  await group.save();
  res.json({ group: await Group.findById(group._id).populate(populateGroup) });
});

router.post("/:id/leave", protect, async (req, res) => {
  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  if (isOwnerOf(group, req.user._id)) {
    return res.status(400).json({ message: "The owner can't leave. Delete the group instead." });
  }

  group.members = group.members.filter((id) => String(id) !== String(req.user._id));
  await group.save();
  res.json({ ok: true });
});

router.delete("/:id", protect, async (req, res) => {
  const group = req.user.role === "admin"
    ? await Group.findById(req.params.id)
    : await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  if (!isOwnerOf(group, req.user._id) && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only the group owner can delete this group" });
  }

  await group.deleteOne();
  res.json({ ok: true });
});

router.get("/:id", protect, async (req, res) => {
  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  const populated = await Group.findById(group._id)
    .populate(populateGroup)
    .populate("messages.sender", "name avatar");

  // Only the most recent messages are sent, same as Rooms.
  res.json({ group: { ...populated.toObject(), messages: populated.messages.slice(-100) } });
});

router.post("/:id/posts", protect, async (req, res) => {
  const { text, fileUrl = "" } = req.body;
  if (!text) return res.status(400).json({ message: "Post text is required" });

  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  group.posts.push({ author: req.user._id, text, fileUrl });
  await group.save();

  res.status(201).json({
    group: await Group.findById(group._id)
      .populate(populateGroup)
      .populate("posts.author", "name avatar")
  });
});

export default router;