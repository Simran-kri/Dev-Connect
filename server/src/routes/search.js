import express from "express";
import { protect } from "../middleware/auth.js";
import Project from "../models/Project.js";
import User from "../models/User.js";

const router = express.Router();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", protect, async (req, res) => {
  const q = (req.query.q || "").trim();
  const regex = new RegExp(escapeRegExp(q), "i");

  const userFilter = q
    ? {
        status: "active",
        $or: [
          { name: regex },
          { title: regex },
          { college: regex },
          { skills: regex }
        ]
      }
    : { status: "active" };

  const projectFilter = q
    ? {
        $or: [{ title: regex }, { description: regex }, { techStack: regex }]
      }
    : {};

  const [users, projects] = await Promise.all([
    User.find(userFilter).select("-password").limit(20),
    Project.find(projectFilter).populate("owner", "name avatar title").limit(20)
  ]);

  res.json({ users, projects });
});

export default router;

