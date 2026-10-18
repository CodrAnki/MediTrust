import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '..', 'uploads');

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, matches the client-side limit

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error('Invalid image format. Please upload a JPG, PNG or WEBP file.');
    err.status = 400;
    return cb(err);
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

export default upload;

// ---- Reference images (admin) ---------------------------------------------
// Saved under server/reference-images/. Extension + MIME are checked here;
// real image integrity is verified after upload (services/referenceImageService.js).
import { referenceDir, ALLOWED_EXT, ALLOWED_MIME } from '../services/referenceImageService.js';

const referenceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, referenceDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ref-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

export const referenceUpload = multer({
  storage: referenceStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error('Only JPG, JPEG, PNG or WEBP images are allowed.');
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
});

export const UPLOAD_LIMITS = { maxFileMb: MAX_FILE_SIZE_BYTES / (1024 * 1024), allowedFormats: ['JPG', 'JPEG', 'PNG', 'WEBP'] };
