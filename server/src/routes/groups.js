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

// When this member joined. Groups created before join dates were tracked
// fall back to the group's creation time, so existing members see everything.
function joinedAtFor(group, userId) {
  return group.memberJoinedAt?.get(String(userId)) || group.createdAt;
}

// Adds a member and records their join time. Returns null if they were
// already in the group, so nothing is reset for existing members.
async function addMemberToGroup(groupId, userId) {
  return Group.findOneAndUpdate(
    { _id: groupId, members: { $ne: userId } },
    {
      $addToSet: { members: userId },
      $set: { [`memberJoinedAt.${userId}`]: new Date() }
    },
    { new: true }
  );
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
    memberJoinedAt: new Map([[String(req.user._id), new Date()]]),
    inviteCode: newInviteCode()
  });

  res.status(201).json({ group: await group.populate(populateGroup) });
});

// Joining through an invite link. The code is secret, so only people who
// were given the link can join.
router.post("/join/:code", protect, async (req, res) => {
  const existing = await Group.findOne({ inviteCode: req.params.code });
  if (!existing) {
    return res.status(404).json({ message: "This invite link is invalid or has been reset." });
  }

  const added = await addMemberToGroup(existing._id, req.user._id);
  const group = await Group.findById((added || existing)._id).populate(populateGroup);
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

  const added = await addMemberToGroup(group._id, target._id);
  if (added) {
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
  group.memberJoinedAt?.delete(String(req.params.userId));
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
  group.memberJoinedAt?.delete(String(req.user._id));
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

// Members only see messages sent after they joined.
router.get("/:id", protect, async (req, res) => {
  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  const populated = await Group.findById(group._id)
    .populate(populateGroup)
    .populate("messages.sender", "name avatar");

  const joinedAt = new Date(joinedAtFor(populated, req.user._id));
  const visible = populated.messages.filter((message) => new Date(message.createdAt) >= joinedAt);

  res.json({ group: { ...populated.toObject(), messages: visible.slice(-100) } });
});

// Messages are saved over plain HTTP. The request only succeeds if the
// message is stored, so nothing can show as sent when it wasn't saved.
router.post("/:id/messages", protect, async (req, res) => {
  const text = String(req.body?.text || "").trim();
  const audioUrl = String(req.body?.audioUrl || "");
  if (!text && !audioUrl) {
    return res.status(400).json({ message: "Message needs text or a voice note" });
  }

  const group = await findMyGroup(req.params.id, req.user._id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  group.messages.push({ sender: req.user._id, text, audioUrl });
  await group.save();

  const saved = group.messages[group.messages.length - 1];

  const recipients = group.members.filter((id) => String(id) !== String(req.user._id));
  if (recipients.length) {
    await Notification.insertMany(
      recipients.map((recipient) => ({
        recipient,
        actor: req.user._id,
        type: "group",
        text: `New message in ${group.name}`
      }))
    );
  }

  res.status(201).json({
    message: {
      _id: saved._id,
      text: saved.text,
      audioUrl: saved.audioUrl,
      createdAt: saved.createdAt,
      sender: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar || "" }
    }
  });
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