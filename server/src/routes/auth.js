import express from "express";
import { protect } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import User from "../models/User.js";
import { asyncHandler, parseList, requireFields } from "../utils/http.js";
import { signToken } from "../utils/tokens.js";
import { generateOtp, sendEmail } from "../utils/email.js";

const router = express.Router();

// 10 attempts per 15 minutes per IP on login/register to blunt brute-force
// and credential-stuffing attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many attempts. Please wait a few minutes and try again."
});

// Tighter limit specifically for OTP requests - these trigger an email send,
// so they're more worth protecting against abuse than a login attempt.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many code requests. Please wait a few minutes and try again."
});

const OTP_TTL_MS = 10 * 60 * 1000;

function publicUser(user) {
  const clean = user.toObject ? user.toObject() : user;
  delete clean.password;
  delete clean.otpCode;
  delete clean.otpExpiresAt;
  delete clean.otpPurpose;
  return clean;
}

async function issueOtp(user, purpose, subject, bodyIntro) {
  const code = generateOtp();
  user.otpCode = code;
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpPurpose = purpose;
  await user.save();

  await sendEmail({
    to: user.email,
    subject,
    text: `${bodyIntro}\n\nYour code: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can ignore this email.`
  });
}

router.post("/register", authLimiter, asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "password"]);
  const { name, password, college = "" } = req.body;
  const email = req.body.email?.trim().toLowerCase() || "";
  const phone = req.body.phone?.trim() || "";

  if (!email && !phone) {
    return res.status(400).json({ message: "Provide an email or phone number" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  if (email && (await User.findOne({ email }))) {
    return res.status(409).json({ message: "Email already registered" });
  }
  if (phone && (await User.findOne({ phone }))) {
    return res.status(409).json({ message: "Phone number already registered" });
  }

  const user = await User.create({
    name,
    email: email || undefined,
    phone: phone || undefined,
    password,
    college,
    skills: parseList(req.body.skills),
    // Nothing to verify if there's no email to send a code to - phone
    // verification would need a paid SMS gateway, out of scope for now.
    isVerified: !email
  });

  if (email) {
    await issueOtp(
      user,
      "verify",
      "Verify your DevConnect email",
      `Welcome to DevConnect, ${user.name}! Use the code below to verify your email address.`
    );
  }

  res.status(201).json({ user: publicUser(user), token: signToken(user) });
}));

router.post("/send-otp", protect, otpLimiter, asyncHandler(async (req, res) => {
  if (req.user.isVerified) {
    return res.status(400).json({ message: "Your email is already verified" });
  }

  const user = await User.findById(req.user._id);
  await issueOtp(
    user,
    "verify",
    "Verify your DevConnect email",
    `Use the code below to verify your email address.`
  );

  res.json({ message: "Verification code sent" });
}));

router.post("/verify-otp", protect, asyncHandler(async (req, res) => {
  requireFields(req.body, ["otp"]);

  const user = await User.findById(req.user._id).select("+otpCode +otpExpiresAt +otpPurpose");

  if (
    !user.otpCode ||
    user.otpPurpose !== "verify" ||
    user.otpCode !== req.body.otp ||
    !user.otpExpiresAt ||
    user.otpExpiresAt < new Date()
  ) {
    return res.status(400).json({ message: "That code is invalid or has expired" });
  }

  user.isVerified = true;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  user.otpPurpose = undefined;
  await user.save();

  res.json({ user: publicUser(user) });
}));

router.post("/forgot-password", authLimiter, asyncHandler(async (req, res) => {
  requireFields(req.body, ["email"]);
  const user = await User.findOne({ email: req.body.email });

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to discover which addresses are registered.
  if (user) {
    await issueOtp(
      user,
      "reset",
      "Reset your DevConnect password",
      "Use the code below to reset your password."
    );
  }

  res.json({ message: "If that email is registered, a reset code has been sent." });
}));

router.post("/reset-password", authLimiter, asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "otp", "newPassword"]);

  if (req.body.newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const user = await User.findOne({ email: req.body.email }).select("+otpCode +otpExpiresAt +otpPurpose");

  if (
    !user ||
    !user.otpCode ||
    user.otpPurpose !== "reset" ||
    user.otpCode !== req.body.otp ||
    !user.otpExpiresAt ||
    user.otpExpiresAt < new Date()
  ) {
    return res.status(400).json({ message: "That code is invalid or has expired" });
  }

  user.password = req.body.newPassword;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  user.otpPurpose = undefined;
  await user.save();

  res.json({ message: "Password updated. You can now log in." });
}));

router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  requireFields(req.body, ["identifier", "password"]);
  const { identifier, password } = req.body;
  const trimmed = identifier.trim();

  // Simple heuristic: anything with an "@" is treated as an email, otherwise
  // as a phone number. Good enough since the two formats don't overlap.
  const query = trimmed.includes("@") ? { email: trimmed.toLowerCase() } : { phone: trimmed };
  const user = await User.findOne(query).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email/phone or password" });
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