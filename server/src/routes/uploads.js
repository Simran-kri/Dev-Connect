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

export default router;

