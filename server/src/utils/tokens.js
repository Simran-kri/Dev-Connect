import jwt from "jsonwebtoken";

function requireSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Add it to server/.env before starting the app.");
  }
  return process.env.JWT_SECRET;
}

export function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    requireSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, requireSecret());
}

