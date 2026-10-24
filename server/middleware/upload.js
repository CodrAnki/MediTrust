import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

import {
  referenceDir,
  ALLOWED_EXT,
  ALLOWED_MIME,
} from "../services/referenceImageService.js";

// Resolve the current directory correctly in ES modules.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Uploaded medicine images: server/uploads/
export const uploadsDir = path.resolve(__dirname, "..", "uploads");

// Ensure the upload directory exists before Multer writes files.
fs.mkdirSync(uploadsDir, { recursive: true });

// Accepted image formats and maximum file size.
const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Generate unique filenames for uploaded medicine images.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

    cb(null, unique);
  },
});

// Validate uploaded medicine image MIME types.
function fileFilter(req, file, cb) {
  if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error(
      "Invalid image format. Please upload a JPG, PNG or WEBP file.",
    );

    err.status = 400;
    return cb(err);
  }

  return cb(null, true);
}

// Multer configuration for medicine image uploads.
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

export default upload;

// ---------------------------------------------------------------------------
// Reference images (admin)
// ---------------------------------------------------------------------------

// Ensure the reference-image directory exists as well.
fs.mkdirSync(referenceDir, { recursive: true });

const referenceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, referenceDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `ref-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

    cb(null, unique);
  },
});

// Validate admin reference images.
export const referenceUpload = multer({
  storage: referenceStorage,

  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error("Only JPG, JPEG, PNG or WEBP images are allowed.");

      err.status = 400;
      return cb(err);
    }

    return cb(null, true);
  },

  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10,
  },
});

export const UPLOAD_LIMITS = {
  maxFileMb: MAX_FILE_SIZE_BYTES / (1024 * 1024),
  allowedFormats: ["JPG", "JPEG", "PNG", "WEBP"],
};
