import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true, default: "" },
    audioUrl: { type: String, default: "" },
    seenAt: { type: Date }
  },
  { timestamps: true }
);

messageSchema.pre("validate", function requireContent(next) {
  if (!this.text && !this.audioUrl) {
    return next(new Error("A message needs text or a voice note"));
  }
  next();
});

const conversationSchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    messages: [messageSchema],
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);

