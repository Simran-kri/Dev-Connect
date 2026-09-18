import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],
    images: {
      type: [{ type: String }],
      validate: {
        validator: (value) => value.length <= 4,
        message: "A post can have at most 4 images"
      },
      default: []
    },
    // A repost holds no content of its own - it points at the original so
    // the original author and their original timestamp always stay credited.
    repostOf: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
    reports: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

postSchema.pre("validate", function requireContent(next) {
  if (!this.body && !this.repostOf && this.images.length === 0) {
    return next(new Error("A post needs text, an image, or must be a repost"));
  }
  next();
});

export default mongoose.model("Post", postSchema);

