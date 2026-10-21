import mongoose from "mongoose";

const groupPostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    fileUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

const groupMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true, default: "" },
    audioUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

groupMessageSchema.pre("validate", function requireContent(next) {
  if (!this.text && !this.audioUrl) {
    return next(new Error("A message needs text or a voice note"));
  }
  next();
});

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    posts: [groupPostSchema],
    messages: [groupMessageSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);

