import mongoose from "mongoose";

const roomMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isPrivate: { type: Boolean, default: false },
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    messages: [roomMessageSchema]
  },
  { timestamps: true }
);

roomSchema.methods.canEnter = function canEnter(userId) {
  if (!this.isPrivate) return true;
  const id = String(userId);
  return String(this.host) === id || this.allowedUsers.some((allowed) => String(allowed) === id);
};

export default mongoose.model("Room", roomSchema);
