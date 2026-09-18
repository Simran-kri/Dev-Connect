import mongoose from "mongoose";
import User from "../models/User.js";

export async function connectDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing. Add it to server/.env.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("MongoDB connected");

  // The email index used to be a plain unique index (email always required).
  // Now that email is optional (phone-only accounts), it needs to be sparse
  // so multiple accounts can have no email at all. syncIndexes reconciles
  // an existing database's indexes with the current schema automatically -
  // without this, a second phone-only signup could fail with a false
  // "duplicate key" error against the old index definition.
  try {
    await User.syncIndexes();
  } catch (error) {
    console.error("Index sync failed (non-fatal):", error.message);
  }
}