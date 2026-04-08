const express = require("express");
const multer = require("multer");
const path = require("path");
const ExifParser = require("exif-parser");
const fs = require("fs");

const router = express.Router();

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split("/")[1]);
    cb(null, extOk || mimeOk);
  },
});

// POST /api/upload/image — Upload image + extract EXIF GPS data
router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image provided" });
    }

    let exifData = null;
    const imageBuffer = fs.readFileSync(req.file.path);

    // Extract EXIF data (GPS coordinates + timestamp)
    try {
      const parser = ExifParser.create(imageBuffer);
      const result = parser.parse();
      if (result.tags) {
        exifData = {
          gpsLat: result.tags.GPSLatitude || null,
          gpsLng: result.tags.GPSLongitude || null,
          capturedAt: result.tags.DateTimeOriginal
            ? new Date(result.tags.DateTimeOriginal * 1000).toISOString()
            : null,
          cameraMake: result.tags.Make || null,
          cameraModel: result.tags.Model || null,
        };
      }
    } catch {
      // EXIF extraction failed — not fatal for non-JPEG
    }

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/${req.file.filename}`,
        exif: exifData,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload/multiple — Upload multiple images
router.post("/multiple", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: "No images provided" });
    }

    const results = req.files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      path: `/uploads/${file.filename}`,
    }));

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
