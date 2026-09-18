import express from "express";
import { protect } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import Post from "../models/Post.js";
import { asyncHandler, parseList, requireFields } from "../utils/http.js";
import { buildPage, parsePagination } from "../utils/pagination.js";

const router = express.Router();

const populatePost = [
  { path: "author", select: "name title avatar college skills" },
  { path: "comments.author", select: "name avatar" },
  {
    path: "repostOf",
    populate: { path: "author", select: "name title avatar college" }
  }
];

router.get("/", protect, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  if (req.query.feed === "trending") {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [posts, totalRows] = await Promise.all([
      Post.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $addFields: {
            engagementScore: { $add: [{ $size: "$likes" }, { $size: "$comments" }] }
          }
        },
        { $sort: { engagementScore: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]),
      Post.countDocuments({ createdAt: { $gte: since } })
    ]);

    const populated = await Post.populate(posts, populatePost);
    const { items, ...meta } = buildPage(populated, totalRows, page, limit);
    return res.json({ posts: items, ...meta });
  }

  // ?feed=following restricts the feed to people the current user follows
  // (plus their own posts) - everything else keeps the global feed as-is.
  const filter = {};
  if (req.query.feed === "following") {
    const authorIds = [...(req.user.following || []), req.user._id];
    filter.author = { $in: authorIds };
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate(populatePost)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Post.countDocuments(filter)
  ]);

  const { items, ...meta } = buildPage(posts, total, page, limit);
  res.json({ posts: items, ...meta });
}));

router.post("/", protect, asyncHandler(async (req, res) => {
  requireFields(req.body, ["body"]);
  const { body } = req.body;
  const images = Array.isArray(req.body.images) ? req.body.images.slice(0, 4) : [];

  const post = await Post.create({
    author: req.user._id,
    body,
    tags: parseList(req.body.tags),
    images
  });
  const populated = await post.populate(populatePost);
  res.status(201).json({ post: populated });
}));

router.post("/:id/repost", protect, asyncHandler(async (req, res) => {
  const original = await Post.findById(req.params.id);
  if (!original) return res.status(404).json({ message: "Post not found" });

  // Reposting a repost should point at the true original, not chain them.
  const targetId = original.repostOf || original._id;

  if (String(original.author) === String(req.user._id) && !original.repostOf) {
    return res.status(400).json({ message: "You can't repost your own post" });
  }

  const existing = await Post.findOne({ author: req.user._id, repostOf: targetId });

  if (existing) {
    await existing.deleteOne();
    await Post.findByIdAndUpdate(targetId, { $pull: { reposts: req.user._id } });
    return res.json({ reposted: false });
  }

  const repost = await Post.create({ author: req.user._id, repostOf: targetId });
  const target = await Post.findByIdAndUpdate(
    targetId,
    { $addToSet: { reposts: req.user._id } },
    { new: true }
  );

  if (String(target.author) !== String(req.user._id)) {
    await Notification.create({
      recipient: target.author,
      actor: req.user._id,
      type: "like",
      text: `${req.user.name} reposted your post`
    });
  }

  const populated = await repost.populate(populatePost);
  res.status(201).json({ reposted: true, post: populated });
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

router.delete("/:id/comment/:commentId", protect, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const comment = post.comments.id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });

  const isCommentAuthor = String(comment.author) === String(req.user._id);
  const isPostAuthor = String(post.author) === String(req.user._id);
  if (!isCommentAuthor && !isPostAuthor && req.user.role !== "admin") {
    return res.status(403).json({ message: "You can only delete your own comments" });
  }

  comment.deleteOne();
  await post.save();

  const populated = await Post.findById(post._id).populate(populatePost);
  res.json({ post: populated });
}));

router.patch("/:id", protect, asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  if (String(post.author) !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only edit your own posts" });
  }

  if (req.body.body !== undefined) post.body = req.body.body;
  if (req.body.tags !== undefined) post.tags = parseList(req.body.tags);
  if (req.body.images !== undefined) post.images = (Array.isArray(req.body.images) ? req.body.images : []).slice(0, 4);

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
