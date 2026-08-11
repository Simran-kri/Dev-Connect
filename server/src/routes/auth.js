import express from "express";
import { protect } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import User from "../models/User.js";
import { asyncHandler, parseList, requireFields } from "../utils/http.js";
import { signToken } from "../utils/tokens.js";

const router = express.Router();

// 10 attempts per 15 minutes per IP on login/register to blunt brute-force
// and credential-stuffing attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many attempts. Please wait a few minutes and try again."
});

function publicUser(user) {
  const clean = user.toObject ? user.toObject() : user;
  delete clean.password;
  return clean;
}

router.post("/register", authLimiter, asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "email", "password"]);
  const { name, email, password, college = "" } = req.body;

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const user = await User.create({
    name,
    email,
    password,
    college,
    skills: parseList(req.body.skills)
  });

  res.status(201).json({ user: publicUser(user), token: signToken(user) });
}));

router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "password"]);
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (user.status === "banned") {
    return res.status(403).json({ message: "This account has been banned" });
  }

  res.json({ user: publicUser(user), token: signToken(user) });
}));

router.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

export default router;
