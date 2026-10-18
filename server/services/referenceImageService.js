import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Jimp from 'jimp';
import ReferenceImage from '../models/ReferenceImage.js';
import Medicine from '../models/Medicine.js';
import { analyzePackaging, PACKAGING_STATUS, PACKAGING_SOURCE } from './packagingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const referenceDir = path.join(__dirname, '..', 'reference-images');
fs.mkdirSync(referenceDir, { recursive: true });

export const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Validates a freshly uploaded reference image on disk: extension, MIME and
 * real image integrity (it must actually decode). Returns hashes, or throws
 * an Error with .status = 400.
 */
export async function inspectUploadedImage(file) {
  const ext = path.extname(file.originalname || file.filename).toLowerCase();
  const bad = (m) => Object.assign(new Error(m), { status: 400 });
  if (!ALLOWED_EXT.has(ext)) throw bad('Only JPG, JPEG, PNG or WEBP images are allowed.');
  if (!ALLOWED_MIME.has(file.mimetype)) throw bad('Invalid image MIME type.');
  let image;
  try { image = await Jimp.read(file.path); } catch { throw bad('The file is not a valid, readable image.'); }
  return { imageHash: sha256File(file.path), perceptualHash: image.hash(), width: image.bitmap.width, height: image.bitmap.height };
}

export function removeLocalFile(imageUrl) {
  if (!imageUrl || /^https?:\/\//i.test(imageUrl)) return;
  const target = path.join(referenceDir, path.basename(imageUrl)); // basename: no path traversal
  fs.promises.unlink(target).catch(() => {});
}

/** Absolute URL a browser can load for a reference image document. */
export function referenceUrl(doc, req) {
  if (!doc.imageUrl) return null;
  if (/^https?:\/\//i.test(doc.imageUrl)) return doc.imageUrl;
  return `${req.protocol}://${req.get('host')}/reference-images/${encodeURIComponent(doc.imageUrl)}`;
}

/** ONLY approved + enabled references are trusted for packaging comparison. */
export function getApprovedReferences(medicineId, limit = 6) {
  if (!medicineId) return Promise.resolve([]);
  return ReferenceImage.find({ medicineId, verificationStatus: 'approved', enabled: true })
    .sort({ createdAt: 1 }).limit(limit).lean();
}

/**
 * Compares the uploaded photo against every APPROVED reference for the
 * medicine and keeps the best similarity. If none are approved, packaging is
 * honestly reported as unavailable (never a fabricated score).
 */
export async function analyzeAgainstApprovedReferences(uploadedPath, medicineId, thresholds) {
  const refs = await getApprovedReferences(medicineId);
  if (!refs.length) {
    return { similarity: null, status: PACKAGING_STATUS.NOT_AVAILABLE, source: PACKAGING_SOURCE.UNAVAILABLE, referenceCount: 0, referenceAvailable: false };
  }
  let best = null;
  for (const ref of refs) {
    const r = await analyzePackaging(uploadedPath, ref.imageUrl, thresholds);
    if (typeof r.similarity === 'number' && (!best || r.similarity > best.similarity)) best = { ...r, referenceId: String(ref._id), referenceType: ref.imageType };
  }
  if (!best) return { similarity: null, status: PACKAGING_STATUS.NOT_AVAILABLE, source: PACKAGING_SOURCE.UNAVAILABLE, referenceCount: refs.length, referenceAvailable: true };
  return { ...best, referenceCount: refs.length, referenceAvailable: true };
}

/**
 * One-time, idempotent migration of the legacy single `Medicine.image` field
 * into ReferenceImage records (source "seed", approved — these were the
 * developer-curated references the pipeline already trusted). Existing
 * medicines with no ReferenceImage keep working; nothing is deleted.
 */
export async function migrateLegacyReferenceImages() {
  const medicines = await Medicine.find({ image: { $nin: [null, ''] } }, 'image').lean();
  let created = 0;
  for (const m of medicines) {
    const exists = await ReferenceImage.exists({ medicineId: m._id, imageUrl: m.image });
    if (exists) continue;
    const isUrl = /^https?:\/\//i.test(m.image);
    let imageHash = null; let perceptualHash = null;
    if (!isUrl) {
      const full = path.join(referenceDir, path.basename(m.image));
      if (!fs.existsSync(full)) continue;
      try { imageHash = sha256File(full); perceptualHash = (await Jimp.read(full)).hash(); } catch { continue; }
      if (imageHash && await ReferenceImage.exists({ imageHash })) continue;
    }
    await ReferenceImage.create({
      medicineId: m._id, imageType: 'FRONT', imageUrl: m.image, isLocalFile: !isUrl, imageHash, perceptualHash,
      source: 'seed', verificationStatus: 'approved', enabled: true, retrievedAt: new Date(),
      metadata: { note: 'Migrated from legacy Medicine.image' },
    });
    created += 1;
  }
  return created;
}
