import express from "express";
import { protect } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import Sprint from "../models/Sprint.js";
import { asyncHandler, parseList, requireFields } from "../utils/http.js";

const router = express.Router();

const populateSprint = [
  { path: "poster", select: "name avatar title" },
  { path: "assignee", select: "name avatar title" },
  { path: "applicants.user", select: "name avatar title" }
];

// Shapes a sprint for one viewer. Applicant lists are only shown to the
// poster, and work links only to the poster and the assigned student.
function shape(sprint, userId) {
  const obj = sprint.toObject ? sprint.toObject() : sprint;
  const isPoster = String(obj.poster?._id || obj.poster) === String(userId);
  const isAssignee = String(obj.assignee?._id || obj.assignee || "") === String(userId);
  const hasApplied = (obj.applicants || []).some(
    (a) => String(a.user?._id || a.user) === String(userId)
  );

  return {
    ...obj,
    applicantCount: obj.applicants?.length || 0,
    applicants: isPoster ? obj.applicants : [],
    hasApplied,
    isPoster,
    isAssignee,
    deliverable: isPoster || isAssignee ? obj.deliverable : undefined
  };
}

function notify(recipient, actor, text) {
  if (!recipient || String(recipient) === String(actor._id)) return Promise.resolve();
  return Notification.create({ recipient, actor: actor._id, type: "project", text });
}

// Open sprints for everyone. ?mine=1 returns sprints you posted, applied to,
// or are working on.
router.get("/", protect, asyncHandler(async (req, res) => {
  const filter = req.query.mine === "1"
    ? { $or: [{ poster: req.user._id }, { assignee: req.user._id }, { "applicants.user": req.user._id }] }
    : { status: "open" };

  const sprints = await Sprint.find(filter)
    .populate(populateSprint)
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ sprints: sprints.map((s) => shape(s, req.user._id)) });
}));

// Accepted work for one student, shown as their verified record.
router.get("/proof/:userId", protect, asyncHandler(async (req, res) => {
  const sprints = await Sprint.find({ assignee: req.params.userId, status: "accepted" })
    .populate({ path: "poster", select: "name" })
    .sort({ acceptedAt: -1 });

  res.json({
    proof: sprints.map((s) => ({
      _id: s._id,
      title: s.title,
      skills: s.skills,
      client: s.poster?.name || "Client",
      acceptedAt: s.acceptedAt,
      deliverableUrl: s.deliverable?.url || ""
    }))
  });
}));

router.post("/", protect, asyncHandler(async (req, res) => {
  requireFields(req.body, ["title", "description", "budget", "deadline"]);

  const budget = Number(req.body.budget);
  const deadline = new Date(req.body.deadline);
  if (!Number.isFinite(budget) || budget < 0) {
    return res.status(400).json({ message: "Enter a valid budget" });
  }
  if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
    return res.status(400).json({ message: "The deadline must be a future date" });
  }

  const sprint = await Sprint.create({
    title: req.body.title.trim(),
    description: req.body.description.trim(),
    skills: parseList(req.body.skills),
    budget,
    deadline,
    poster: req.user._id
  });

  res.status(201).json({ sprint: shape(await sprint.populate(populateSprint), req.user._id) });
}));

router.post("/:id/apply", protect, asyncHandler(async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (sprint.status !== "open") {
    return res.status(400).json({ message: "This sprint isn't taking applications" });
  }
  if (String(sprint.poster) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't apply to your own sprint" });
  }
  if (sprint.applicants.some((a) => String(a.user) === String(req.user._id))) {
    return res.status(400).json({ message: "You've already applied" });
  }

  sprint.applicants.push({ user: req.user._id, note: String(req.body.note || "").trim().slice(0, 500) });
  await sprint.save();
  await notify(sprint.poster, req.user, `${req.user.name} applied to "${sprint.title}"`);
  res.json({ ok: true });
}));

router.post("/:id/assign", protect, asyncHandler(async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (String(sprint.poster) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the poster can choose a student" });
  }
  if (sprint.status !== "open") {
    return res.status(400).json({ message: "This sprint is already assigned" });
  }

  const applicant = sprint.applicants.find((a) => String(a.user) === String(req.body.userId));
  if (!applicant) return res.status(400).json({ message: "That person hasn't applied" });

  sprint.assignee = applicant.user;
  sprint.status = "assigned";
  await sprint.save();
  await notify(sprint.assignee, req.user, `You were chosen for "${sprint.title}"`);
  res.json({ ok: true });
}));

router.post("/:id/submit", protect, asyncHandler(async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (String(sprint.assignee) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the assigned student can submit work" });
  }
  if (sprint.status !== "assigned") {
    return res.status(400).json({ message: "Work can't be submitted for this sprint now" });
  }

  const url = String(req.body.url || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ message: "Add a link starting with http:// or https://" });
  }

  sprint.deliverable = {
    url,
    note: String(req.body.note || "").trim().slice(0, 1000),
    submittedAt: new Date()
  };
  sprint.status = "submitted";
  await sprint.save();
  await notify(sprint.poster, req.user, `${req.user.name} submitted work for "${sprint.title}"`);
  res.json({ ok: true });
}));

router.post("/:id/accept", protect, asyncHandler(async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (String(sprint.poster) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the poster can accept work" });
  }
  if (sprint.status !== "submitted") {
    return res.status(400).json({ message: "There's no submitted work to accept" });
  }

  sprint.status = "accepted";
  sprint.acceptedAt = new Date();
  await sprint.save();
  await notify(sprint.assignee, req.user, `Your work on "${sprint.title}" was accepted`);
  res.json({ ok: true });
}));

router.post("/:id/cancel", protect, asyncHandler(async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (String(sprint.poster) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the poster can cancel this sprint" });
  }
  if (!["open", "assigned"].includes(sprint.status)) {
    return res.status(400).json({ message: "Only open or assigned sprints can be cancelled" });
  }

  sprint.status = "cancelled";
  await sprint.save();
  if (sprint.assignee) {
    await notify(sprint.assignee, req.user, `"${sprint.title}" was cancelled`);
  }
  res.json({ ok: true });
}));

export default router;
