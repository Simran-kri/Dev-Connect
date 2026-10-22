import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

const sprintSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    skills: [{ type: String, trim: true }],
    budget: { type: Number, required: true, min: 0 },
    deadline: { type: Date, required: true },
    poster: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["open", "assigned", "submitted", "accepted", "cancelled"],
      default: "open"
    },
    applicants: [applicantSchema],
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deliverable: {
      url: { type: String, default: "" },
      note: { type: String, default: "" },
      submittedAt: { type: Date }
    },
    acceptedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("Sprint", sprintSchema);
