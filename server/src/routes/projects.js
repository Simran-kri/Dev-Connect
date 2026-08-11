import express from "express";
import { protect } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import Project from "../models/Project.js";
import { asyncHandler, parseList, requireFields } from "../utils/http.js";
import { buildPage, parsePagination } from "../utils/pagination.js";

const router = express.Router();

router.get("/", protect, asyncHandler(async (req, res) => {
  const filter = req.query.owner ? { owner: req.query.owner } : {};
  const { page, limit, skip } = parsePagination(req.query);

  const [projects, total] = await Promise.all([
    Project.find(filter)
      .populate("owner", "name title avatar skills")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Project.countDocuments(filter)
  ]);

  const { items, ...meta } = buildPage(projects, total, page, limit);
  res.json({ projects: items, ...meta });
}));

router.get("/:id", protect, asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate("owner", "name title avatar skills college bio github linkedin portfolio");

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  res.json({ project });
}));

router.post("/", protect, asyncHandler(async (req, res) => {
  requireFields(req.body, ["title", "description"]);
  const { title, description, github = "", liveDemo = "", images = [] } = req.body;

  const project = await Project.create({
    owner: req.user._id,
    title,
    description,
    techStack: parseList(req.body.techStack),
    github,
    liveDemo,
    images
  });

  res.status(201).json({ project: await project.populate("owner", "name title avatar skills") });
}));

router.patch("/:id", protect, asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  if (String(project.owner) !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only edit your own projects" });
  }

  const allowed = ["title", "description", "github", "liveDemo", "images"];
  allowed.forEach((field) => {
    if (field in req.body) project[field] = req.body[field];
  });
  if (req.body.techStack !== undefined) project.techStack = parseList(req.body.techStack);

  await project.save();
  res.json({ project: await project.populate("owner", "name title avatar skills") });
}));

router.delete("/:id", protect, asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const isOwner = String(project.owner) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ message: "You can only delete your own projects" });
  }

  await project.deleteOne();
  res.json({ ok: true });
}));

router.post("/:id/like", protect, asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const liked = project.likes.some((id) => String(id) === String(req.user._id));
  project.likes = liked
    ? project.likes.filter((id) => String(id) !== String(req.user._id))
    : [...project.likes, req.user._id];
  await project.save();

  if (!liked && String(project.owner) !== String(req.user._id)) {
    await Notification.create({
      recipient: project.owner,
      actor: req.user._id,
      type: "project",
      text: `${req.user.name} liked your project`
    });
  }

  res.json({ liked: !liked, likes: project.likes.length });
}));

export default router;
