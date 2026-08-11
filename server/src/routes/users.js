import express from "express";
import { protect } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { buildPage, parsePagination } from "../utils/pagination.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
  const filter = { _id: { $ne: req.user._id }, status: "active" };
  const { page, limit, skip } = parsePagination(req.query);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const { items, ...meta } = buildPage(users, total, page, limit);
  res.json({ users: items, ...meta });
});

router.get("/:id", protect, async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

router.put("/profile/me", protect, async (req, res) => {
  const allowed = [
    "name",
    "title",
    "college",
    "bio",
    "experience",
    "skills",
    "github",
    "linkedin",
    "portfolio",
    "avatar"
  ];

  const updates = {};
  allowed.forEach((field) => {
    if (field in req.body) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true
  }).select("-password");

  res.json({ user });
});

router.post("/:id/follow", protect, async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: "User not found" });

  const alreadyFollowing = req.user.following.some((id) => String(id) === req.params.id);
  const action = alreadyFollowing ? "$pull" : "$addToSet";

  await User.findByIdAndUpdate(req.user._id, { [action]: { following: target._id } });
  await User.findByIdAndUpdate(target._id, { [action]: { followers: req.user._id } });

  if (!alreadyFollowing) {
    await Notification.create({
      recipient: target._id,
      actor: req.user._id,
      type: "follow",
      text: `${req.user.name} followed you`
    });
  }

  const updated = await User.findById(req.user._id).select("-password");
  res.json({ following: !alreadyFollowing, user: updated });
});

export default router;

