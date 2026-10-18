import Batch from '../models/Batch.js';
import ManufacturerQr from '../models/ManufacturerQr.js';
import { decodeQrDetailed, decodeQrFromImage } from './qrDecoder.js';

export { decodeQrDetailed, decodeQrFromImage };

// ---------------------------------------------------------------------------
// QR / barcode verification.
//
// Phase 8.5: real QR decoding (jsQR against real image pixels via jimp).
// Phase 12: QR ARCHITECTURE FIX.
//
// The previous version only knew two outcomes for a decoded code:
// VERIFIED (equals some batch's own qrCode) or MISMATCH (anything else).
// That is wrong for this product line: most real packaging here carries a
// single QR shared across every unit of every product from a manufacturer
// (a marketing/portal URL, e.g. https://zoxvinabiotech.com/), not a
// payload unique to one batch. Comparing that real, genuine value against
// one specific batch's own qrCode field will never match — so every
// genuine scan was reported as a QR "mismatch", which is false negative
// evidence, not a real failure.
//
// This version distinguishes FOUR real outcomes and never claims
// batch-specific verification for a manufacturer-level code:
//   - BATCH_QR_VERIFIED         decoded code equals an ACTUAL batch's own
//                                 unique qrCode (genuine per-batch proof).
//   - MANUFACTURER_QR_TRUSTED   decoded code matches a known-genuine
//                                 manufacturer-level QR (see
//                                 models/ManufacturerQr.js) — real,
//                                 positive evidence, just not batch-level.
//   - QR_NOT_DETECTED           no QR could be decoded from the image at
//                                 all. Not negative evidence.
//   - QR_UNTRUSTED              a code WAS decoded, but it matches neither
//                                 a real batch nor a known manufacturer QR
//                                 — a genuine, real failure.
//
// What's still REAL / unchanged: decoding genuinely reads pixels (see
// services/qrDecoder.js — multi-scale / tiled / preprocessed jsQR search, which
// fixed small printed QRs being reported as "not detected"); nothing here
// invents a code or a classification. No Math.random(), no fabricated match.
// ---------------------------------------------------------------------------

export const QR_SOURCE = {
  REAL: 'REAL', // decode was actually attempted against real image pixels
};

export const QR_STATUS = {
  BATCH_QR_VERIFIED: 'BATCH_QR_VERIFIED',
  MANUFACTURER_QR_TRUSTED: 'MANUFACTURER_QR_TRUSTED',
  QR_NOT_DETECTED: 'QR_NOT_DETECTED',
  QR_UNTRUSTED: 'QR_UNTRUSTED',
};

// --- Real: image decode lives in ./qrDecoder.js (re-exported above) ------------

export function normalizeQrPayload(raw) {
  // Trim only — unlike batch numbers, QR payloads are frequently
  // case-sensitive (e.g. URLs, base64-ish tokens), so no uppercasing here.
  if (!raw) return null;
  return String(raw).trim();
}

// --- Real: DB lookups ---------------------------------------------------
// Exposed as the default lookup implementations, but classifyQrCode()
// accepts overrides so the classification DECISION LOGIC — the actual
// bug that was fixed here — can be unit-tested without a live MongoDB
// connection. See server/tests/qrService.test.js.

async function defaultFindBatchByQr(code) {
  return Batch.findOne({ qrCode: code });
}

async function defaultFindManufacturerQr(code) {
  return ManufacturerQr.findOne({ payload: code, active: { $ne: false } });
}

/**
 * Classifies a single decoded QR payload against real, independent
 * database records. Never invents a match; never treats a manufacturer-
 * level match as batch-specific.
 *
 * @param {string|null} code
 * @param {object} [deps]
 * @param {(code: string) => Promise<object|null>} [deps.findBatchByQr]
 * @param {(code: string) => Promise<object|null>} [deps.findManufacturerQr]
 * @returns {Promise<{status: string, verified: boolean, batch: object|null, manufacturerMatch: object|null}>}
 */
export async function classifyQrCode(
  code,
  { findBatchByQr = defaultFindBatchByQr, findManufacturerQr = defaultFindManufacturerQr } = {}
) {
  if (!code) {
    return { status: QR_STATUS.QR_NOT_DETECTED, verified: false, batch: null, manufacturerMatch: null };
  }

  // 1. A genuine, batch-specific QR always outranks a manufacturer-level
  //    one: it is stronger evidence (proves this exact batch, not just
  //    "some product from this manufacturer").
  const batchMatch = await findBatchByQr(code);
  if (batchMatch) {
    return {
      status: QR_STATUS.BATCH_QR_VERIFIED,
      verified: batchMatch.status === 'ACTIVE',
      batch: batchMatch,
      manufacturerMatch: null,
    };
  }

  // 2. Known-genuine shared manufacturer/marketing QR. Real positive
  //    evidence — never downgraded to "mismatch" just because it isn't
  //    tied to one specific batch.
  const manufacturerMatch = await findManufacturerQr(code);
  if (manufacturerMatch) {
    return {
      status: QR_STATUS.MANUFACTURER_QR_TRUSTED,
      verified: true,
      batch: null,
      manufacturerMatch,
    };
  }

  // 3. A code really was decoded, but it corresponds to nothing trusted —
  //    this is a genuine, real failure, not a missing-signal case.
  return { status: QR_STATUS.QR_UNTRUSTED, verified: false, batch: null, manufacturerMatch: null };
}

/**
 * Classifies every unique QR payload decoded across a set of uploaded
 * images (a multi-photo submission may decode different codes per photo)
 * and returns the single best-classified result. Priority:
 * BATCH_QR_VERIFIED > MANUFACTURER_QR_TRUSTED > QR_UNTRUSTED > QR_NOT_DETECTED.
 * A genuine match found in one photo is never discarded just because
 * another photo in the same submission didn't decode anything trusted.
 *
 * @param {string[]} codes unique decoded QR payloads (already de-duplicated)
 * @param {object} [deps] see classifyQrCode
 */
export async function classifyQrCodes(codes, deps) {
  const uniqueCodes = [...new Set((codes || []).filter(Boolean))];
  if (!uniqueCodes.length) {
    return {
      status: QR_STATUS.QR_NOT_DETECTED,
      verified: false,
      code: null,
      batch: null,
      manufacturerMatch: null,
      source: QR_SOURCE.REAL,
    };
  }

  const classified = await Promise.all(
    uniqueCodes.map(async (code) => ({ code, ...(await classifyQrCode(code, deps)) }))
  );

  const PRIORITY = {
    [QR_STATUS.BATCH_QR_VERIFIED]: 3,
    [QR_STATUS.MANUFACTURER_QR_TRUSTED]: 2,
    [QR_STATUS.QR_UNTRUSTED]: 1,
    [QR_STATUS.QR_NOT_DETECTED]: 0,
  };
  const best = classified.sort((a, b) => PRIORITY[b.status] - PRIORITY[a.status])[0];
  return { ...best, source: QR_SOURCE.REAL };
}

// --- Public entry points ----------------------------------------------------

/**
 * Decodes (but does not classify) the QR code in a single uploaded image.
 * Classification needs cross-image + batch/medicine context, so it happens
 * once per submission via classifyQrCodes(), not per image here.
 *
 * @param {string} [imagePath] absolute path to the uploaded image
 * @returns {Promise<{code: string|null, source: string}>}
 */
export async function decodeQr(imagePath) {
  if (!imagePath) return { code: null, source: QR_SOURCE.REAL };

  // A corrupt/unreadable image must never crash the whole verification request
  // — it is reported as "no QR found" — but the reason is logged server-side so
  // it can actually be debugged (never the payload bytes of the image itself).
  const result = await decodeQrDetailed(imagePath);
  const file = String(imagePath).split(/[\\/]/).pop();
  if (result.code) {
    console.info(`[QR] decoded file=${file} ${result.width}x${result.height} strategy=${result.strategy} attempts=${result.attempts} ${result.durationMs}ms`);
  } else if (result.error) {
    console.error(`[QR] decode failed file=${file}: ${result.error}`);
  } else {
    console.info(`[QR] no QR decoded file=${file} ${result.width}x${result.height} attempts=${result.attempts} ${result.durationMs}ms${result.timedOut ? ' (time budget reached)' : ''}`);
  }

  return { code: normalizeQrPayload(result.code), source: QR_SOURCE.REAL };
}

/**
 * Convenience one-shot: decode a single image's QR and classify it
 * immediately against real DB records, with no batch/manufacturer cross-
 * image context. Used where only one image is available.
 *
 * @param {string} [imagePath] absolute path to the uploaded image
 */
export async function checkQr(imagePath) {
  const { code, source } = await decodeQr(imagePath);
  const classified = await classifyQrCode(code);
  return { ...classified, code, source };
}
