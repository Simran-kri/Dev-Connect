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

router.get("/analytics", async (req, res) => {
  const days = 14;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  async function dailyCounts(Model) {
    const rows = await Model.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      }
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  const [userCounts, postCounts, projectCounts, tagRows, topAuthorRows] = await Promise.all([
    dailyCounts(User),
    dailyCounts(Post),
    dailyCounts(Project),
    Post.aggregate([
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    Post.aggregate([
      { $group: { _id: "$author", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { count: 1, name: "$user.name", avatar: "$user.avatar" } }
    ])
  ]);

  // Fill in every day in the range, even ones with zero activity, so the
  // chart doesn't silently skip days with no signups/posts.
  const growth = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(since);
    date.setDate(date.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    growth.push({
      date: key,
      users: userCounts[key] || 0,
      posts: postCounts[key] || 0,
      projects: projectCounts[key] || 0
    });
  }

  res.json({
    growth,
    topTags: tagRows.map((row) => ({ tag: row._id, count: row.count })),
    topAuthors: topAuthorRows.map((row) => ({ name: row.name, avatar: row.avatar, count: row.count }))
  });
});

router.get("/reports", async (req, res) => {
  const posts = await Post.find({ reports: { $exists: true, $ne: [] } })
    .populate("author", "name email")
    .populate("reports", "name email");
  res.json({ posts });
});

router.patch("/posts/:id/dismiss-reports", async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { reports: [] }, { new: true });
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json({ ok: true });
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