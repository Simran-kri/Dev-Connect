import express from "express";
import { protect } from "../middleware/auth.js";
import Room from "../models/Room.js";
import { getRoomParticipantCount } from "../state/roomPresence.js";
import { asyncHandler, requireFields } from "../utils/http.js";
import { buildPage, parsePagination } from "../utils/pagination.js";

const router = express.Router();

const populateHost = { path: "host", select: "name avatar title" };
const populateAllowed = { path: "allowedUsers", select: "name avatar title" };
const populateMessageAuthors = { path: "messages.sender", select: "name avatar" };

// List view never needs the full message history - keep it light.
router.get("/", protect, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  // Private rooms are hidden from the public list entirely unless you're
  // the host or on the allowed list - "private" means invisible, not just
  // locked.
  const filter = {
    $or: [
      { isPrivate: false },
      { isPrivate: true, host: req.user._id },
      { isPrivate: true, allowedUsers: req.user._id }
    ]
  };

  const [rooms, total] = await Promise.all([
    Room.find(filter)
      .select("name description host isPrivate createdAt")
      .populate(populateHost)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Room.countDocuments(filter)
  ]);

  // "Live" should reflect whether anyone is actually here right now, not
  // just that the room document exists - a room isn't permanently "live"
  // just because it was created once.
  const withPresence = rooms.map((room) => ({
    ...room.toObject(),
    liveCount: getRoomParticipantCount(room._id)
  }));

  const { items, ...meta } = buildPage(withPresence, total, page, limit);
  res.json({ rooms: items, ...meta });
}));

router.post("/", protect, asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  const isPrivate = Boolean(req.body.isPrivate);
  const allowedUserIds = isPrivate ? [...new Set((req.body.allowedUserIds || []).map(String))] : [];

  const room = await Room.create({
    name: req.body.name.trim(),
    description: (req.body.description || "").trim(),
    host: req.user._id,
    isPrivate,
    allowedUsers: allowedUserIds,
    messages: []
  });

  res.status(201).json({ room: await room.populate([populateHost, populateAllowed]) });
}));

router.get("/:id", protect, asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate(populateHost)
    .populate(populateAllowed)
    .populate(populateMessageAuthors);

  if (!room) return res.status(404).json({ message: "Room not found" });
  if (!room.canEnter(req.user._id)) {
    return res.status(403).json({ message: "This is a private room. Ask the host to add you." });
  }

  // Only send the most recent messages to whoever opens the room - a live
  // space isn't meant to load its entire history on every visit.
  const recentMessages = room.messages.slice(-100);
  res.json({ room: { ...room.toObject(), messages: recentMessages } });
}));

router.delete("/:id", protect, asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  const isHost = String(room.host) === String(req.user._id);
  if (!isHost && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only the host can close this room" });
  }

  await room.deleteOne();
  res.json({ ok: true });
}));

export default router;
