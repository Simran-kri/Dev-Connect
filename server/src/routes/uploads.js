import express from "express";
import multer from "multer";
import { configureCloudinary, cloudinary } from "../config/cloudinary.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed"));
    }
    callback(null, true);
  }
});

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith("audio/")) {
      return callback(new Error("Only audio files are allowed"));
    }
    callback(null, true);
  }
});

router.post(
  "/image",
  protect,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    if (!configureCloudinary()) {
      return res.status(501).json({
        message: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "devconnect",
      resource_type: "image"
    });

    res.status(201).json({
      url: result.secure_url,
      publicId: result.public_id
    });
  })
);

router.post(
  "/audio",
  protect,
  uploadAudio.single("audio"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Audio file is required" });
    }

    if (!configureCloudinary()) {
      return res.status(501).json({
        message: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    // Cloudinary has no dedicated "audio" resource type - "video" is the
    // standard, documented way to upload audio-only files.
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "devconnect/voice-notes",
      resource_type: "video"
    });

    res.status(201).json({
      url: result.secure_url,
      publicId: result.public_id
    });
  })
);

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith("video/")) {
      return callback(new Error("Only video files are allowed"));
    }
    callback(null, true);
  }
});

router.post(
  "/video",
  protect,
  uploadVideo.single("video"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Video file is required" });
    }

    if (!configureCloudinary()) {
      return res.status(501).json({
        message: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "devconnect/project-videos",
      resource_type: "video"
    });

    res.status(201).json({
      url: result.secure_url,
      publicId: result.public_id
    });
  })
);

export default router;

