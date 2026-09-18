import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    techStack: [{ type: String, trim: true }],
    github: { type: String, default: "" },
    liveDemo: { type: String, default: "" },
    images: [{ type: String }],
    // Either a pasted YouTube/Vimeo/Loom link (videoUrl) or a file uploaded
    // to Cloudinary (videoFile) - both supported, shown as an embed or a
    // native player respectively.
    videoUrl: { type: String, default: "" },
    videoFile: { type: String, default: "" },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);

