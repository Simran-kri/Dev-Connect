import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Group from "../models/Group.js";
import Post from "../models/Post.js";
import Project from "../models/Project.js";
import User from "../models/User.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/stats", async (req, res) => {
  const [users, posts, projects, groups, reportedPosts] = await Promise.all([
    User.countDocuments(),
    Post.countDocuments(),
    Project.countDocuments(),
    Group.countDocuments(),
    Post.countDocuments({ reports: { $exists: true, $ne: [] } })
  ]);

  res.json({ users, posts, projects, groups, reportedPosts });
});

router.get("/reports", async (req, res) => {
  const posts = await Post.find({ reports: { $exists: true, $ne: [] } })
    .populate("author", "name email")
    .populate("reports", "name email");
  res.json({ posts });
});

router.delete("/posts/:id", async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

router.patch("/users/:id/ban", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.status = user.status === "banned" ? "active" : "banned";
  await user.save();
  res.json({ user });
});

export default router;

