import express from "express";
import { protect } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import Post from "../models/Post.js";
import { asyncHandler, parseList, requireFields } from "../utils/http.js";
import { buildPage, parsePagination } from "../utils/pagination.js";

const router = express.Router();

const populatePost = [
  { path: "author", select: "name title avatar college skills" },
  { path: "comments.author", select: "name avatar" }
];

router.get("/", protect, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const [posts, total] = await Promise.all([
    Post.find()
      .populate(populatePost)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Post.countDocuments()
  ]);

  const { items, ...meta } = buildPage(posts, total, page, limit);
  res.json({ posts: items, ...meta });
}));

router.post("/", protect, asyncHandler(async (req, res) => {
  requireFields(req.body, ["body"]);
  const { body, image = "" } = req.body;

  const post = await Post.create({
    author: req.user._id,
    body,
    tags: parseList(req.body.tags),
    image
  });
  const populated = await post.populate(populatePost);
  res.status(201).json({ post: populated });
}));

router.post("/:id/like", protect, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const liked = post.likes.some((id) => String(id) === String(req.user._id));
  post.likes = liked
    ? post.likes.filter((id) => String(id) !== String(req.user._id))
    : [...post.likes, req.user._id];
  await post.save();

  if (!liked && String(post.author) !== String(req.user._id)) {
    await Notification.create({
      recipient: post.author,
      actor: req.user._id,
      type: "like",
      text: `${req.user.name} liked your post`
    });
  }

  res.json({ liked: !liked, likes: post.likes.length });
}));

router.post("/:id/comment", protect, asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: "Comment text is required" });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  post.comments.push({ author: req.user._id, text });
  await post.save();

  if (String(post.author) !== String(req.user._id)) {
    await Notification.create({
      recipient: post.author,
      actor: req.user._id,
      type: "comment",
      text: `${req.user.name} commented on your post`
    });
  }

  const populated = await Post.findById(post._id).populate(populatePost);
  res.status(201).json({ post: populated });
}));

router.patch("/:id", protect, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  if (String(post.author) !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only edit your own posts" });
  }

  if (req.body.body !== undefined) post.body = req.body.body;
  if (req.body.tags !== undefined) post.tags = parseList(req.body.tags);
  if (req.body.image !== undefined) post.image = req.body.image;

  await post.save();
  const populated = await post.populate(populatePost);
  res.json({ post: populated });
}));

router.delete("/:id", protect, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const isOwner = String(post.author) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ message: "You can only delete your own posts" });
  }

  await post.deleteOne();
  res.json({ ok: true });
}));

router.post("/:id/report", protect, asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { reports: req.user._id } },
    { new: true }
  );
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json({ reports: post.reports.length });
}));

export default router;
