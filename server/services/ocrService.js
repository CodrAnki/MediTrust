import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createWorker } from 'tesseract.js';
import Jimp from 'jimp';
import { env } from '../config/env.js';
import { withTimeout, TimeoutError } from '../utils/timeout.js';
import { extractBatch, extractDates } from './labelParser.js';

// ---------------------------------------------------------------------------
// REAL OCR — Tesseract.js (Phase 7.5 replacement for Google Cloud Vision)
//
// Google Cloud Vision required billing to be enabled on the Google Cloud
// project (403 PERMISSION_DENIED: "This API method requires billing to be
// enabled"). Since we don't want to enable Google Cloud billing, this now
// runs OCR locally/server-side with Tesseract.js — no external API, no API
// key, no billing.
//
// Nothing here invents a medicine name, batch number, or date — every
// field is either read from the real OCR text or explicitly marked as not
// detected. If Tesseract can't read something, it's null. Never guessed.
// ---------------------------------------------------------------------------

export const OCR_STATUS = {
  OK: 'OK',
  NO_TEXT_DETECTED: 'NO_TEXT_DETECTED',
  OCR_FAILED: 'OCR_FAILED',
  OCR_UNAVAILABLE: 'OCR_UNAVAILABLE',
};

export const OCR_STATUS_MESSAGES = {
  [OCR_STATUS.NO_TEXT_DETECTED]:
    'No valid medicine information detected. This does not appear to be a medicine package label.',
  [OCR_STATUS.OCR_FAILED]:
    'Text extraction failed for this image. Please try a clearer, well-lit photo.',
  [OCR_STATUS.OCR_UNAVAILABLE]:
    'OCR service is not configured on this server. Please contact support.',
};

function emptyFields() {
  return {
    fieldStatus: {}, unassignedDates: [], invalidValues: {}, notes: [],
    medicineName: null,
    strength: null,
    genericName: null,
    manufacturer: null,
    batchNumber: null,
    manufacturingDate: null,
    expiryDate: null,
  };
}

// --- Image preprocessing ---------------------------------------------------
// Tesseract accuracy is very sensitive to input quality. We apply a few
// cheap, generally-safe transforms before OCR:
//   - upscale small images (OCR struggles below ~1000px on the long edge)
//   - grayscale
//   - normalize/contrast boost
// This never alters what text says — only how legible it is to the engine.
// Aggressive thresholding/convolution erased fine label text on phone images,
// so it is deliberately not used.
//
// Rotations are rendered LAZILY (one at a time) so an upright, clearly-read photo
// does not pay for four full render+OCR passes.
const ROTATION_ORDER = [0, 90, 270, 180];
const EARLY_EXIT_CONFIDENCE = 0.7;
const SCALAR_FIELDS = ['medicineName', 'genericName', 'strength', 'manufacturer', 'batchNumber', 'manufacturingDate', 'expiryDate'];

async function loadSource(imagePath) {
  try {
    // Jimp 0.22 applies EXIF orientation while decoding.
    return await Jimp.read(imagePath);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Tesseract OCR] Preprocessing failed, using original image:', err.message);
    return null;
  }
}

async function renderRotation(source, angle) {
  const image = source.clone().rotate(angle, false);
  const longEdge = Math.max(image.bitmap.width, image.bitmap.height);
  if (longEdge < 1800) image.scale(1800 / longEdge, Jimp.RESIZE_BICUBIC);
  image.grayscale().normalize().contrast(0.3);
  // Temp derivatives live in the OS temp dir, never beside (publicly served) uploads.
  const outPath = path.join(os.tmpdir(), `meditrust-ocr-${crypto.randomUUID()}-${angle}.png`);
  await image.writeAsync(outPath);
  return outPath;
}

// --- Tesseract.js OCR call --------------------------------------------------

let workerPromise = null;
let workerQueue = Promise.resolve();

// A single reusable worker avoids re-initializing the Tesseract engine
// (loading the language model, etc.) on every request.
//
// A FAILED initialisation is NOT cached: previously one transient failure (e.g. the
// language file could not be fetched) left a rejected promise in place and every later
// verification failed until the server was restarted.
function getWorker() {
  if (!workerPromise) {
    const created = createWorker('eng');
    workerPromise = created;
    created.catch(() => { if (workerPromise === created) workerPromise = null; });
  }
  return workerPromise;
}

// Drops (and terminates) the shared worker so the next call starts a fresh one.
async function resetWorker() {
  const current = workerPromise;
  workerPromise = null;
  try {
    const worker = await current;
    await worker?.terminate();
  } catch { /* nothing to terminate */ }
}

function runTesseract(imagePath) {
  const task = workerQueue.then(async () => {
    const worker = await getWorker();
    try {
      // A wedged recognize() previously blocked this queue — and therefore every
      // verification after it — forever. Bound it and recycle the worker.
      const { data } = await withTimeout(worker.recognize(imagePath), env.limits.ocrTimeoutMs, 'OCR recognition');
      const text = data?.text || '';
      const words = data?.words || [];
      const confidences = words.map((w) => w.confidence).filter((c) => typeof c === 'number');
      const avgConfidence = confidences.length
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length / 100
        : null;
      return { text, avgConfidence, words };
    } catch (err) {
      if (err instanceof TimeoutError) await resetWorker();
      throw err;
    }
  });
  workerQueue = task.then(() => undefined, () => undefined);
  return task;
}

// --- Parsing raw OCR text into structured fields ---------------------------
// This is necessarily heuristic — Tesseract returns text, not a structured
// "medicine name" field. Patterns below look for common packaging label
// conventions. Anything not confidently found stays null rather than being
// guessed.

const MANUFACTURER_PATTERNS = [
  /\b(?:mfd\.?\s*by|manufactured\s*by|marketed\s*by|mkt\.?\s*by)\s*[:\-]?\s*([A-Za-z][A-Za-z0-9 &.,\-]{2,60})/i,
];
const COMPANY_PATTERN = /\b([A-Za-z][A-Za-z0-9 &.,-]{2,60}\b(?:Pvt\.?\s*Ltd\.?|Limited|Pharma|Laboratories|Labs))\b/i;

function matchFirst(patterns, text) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// Scores a single candidate line for how "product-name-shaped" it is.
// Returns null when the line is disqualified outright, otherwise a
// numeric score (higher = more name-like). Pulled out of guessMedicineName
// so the exact same eligibility/scoring rules can be applied both to
// individual lines and to a line joined with a following "badge" line
// (see guessMedicineName) — the rules themselves are unchanged from
// before, just no longer duplicated.
const NAME_SKIP_WORDS = /\b(batch|lot|mfg|exp|manufactured|marketed|mrp|price|storage|store|keep)\b/i;

function scoreNameLine(trimmed) {
  if (trimmed.length < 3 || trimmed.length > 60) return null;
  if (/^\d+$/.test(trimmed)) return null;
  if (NAME_SKIP_WORDS.test(trimmed)) return null;
  // Needs at least one letter to be a name, not just symbols/numbers.
  if (!/[A-Za-z]/.test(trimmed)) return null;
  // Reject lines that are mostly digits/symbols with a stray letter or
  // two mixed in (e.g. OCR noise on a non-medicine image) — a real
  // product name is predominantly alphabetic.
  const nonSpace = trimmed.replace(/\s/g, '');
  const letterCount = (nonSpace.match(/[A-Za-z]/g) || []).length;
  if (letterCount / nonSpace.length < 0.75) return null;
  // A real product name has at least one genuine word (a contiguous run
  // of letters, 4+ chars) — rejects noise like "ws -- OM ij ' ' y",
  // where every "word" is a 1-2 letter OCR fragment.
  const words = trimmed.split(/[^A-Za-z]+/).filter(Boolean);
  const hasRealWord = words.some((w) => w.length >= 4);
  if (!hasRealWord) return null;
  // Product brands are usually compact and often have a hyphen or a
  // distinctive TitleCase word; long ingredient/descriptive lines are not
  // discarded, just ranked lower. This remains generic and never relies on
  // a product-specific word list.
  let score = 0;
  if (trimmed.length <= 32) score += 10;
  if (/[A-Za-z]+-[A-Za-z0-9]+/.test(trimmed)) score += 25;
  if (/^[A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+){0,2}$/.test(trimmed)) score += 12;
  if (/\b(capsule|tablet|softgel|injection|syrup|extract|oxide)\b/i.test(trimmed)) score -= 18;
  return score;
}

// Exported for testing (same convention as medicineMatchService.js's
// `similarity`/`normalize`) — not otherwise used outside this module.
export function guessMedicineName(lines) {
  // Best-effort heuristic: the best-scoring line that looks like a product
  // name — reasonably short, not a pure date/number/instruction line, and
  // not one of the label words we already parse separately.
  const candidates = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const score = scoreNameLine(trimmed);
    if (score !== null) candidates.push({ value: trimmed, score });
  }

  // Real cartons frequently wrap a short brand suffix — "PLUS", "XT",
  // "FORTE", "SR", "DSR", "GOLD", "PRO", etc. — onto the very next
  // printed line instead of keeping the whole brand name on one line
  // (e.g. "ZOXFER-XT" on one line, "PLUS" directly beneath it as a
  // badge). Considering only one line at a time, as above, silently
  // truncates that suffix off the extracted name — harmless for a
  // single-token name like "Zoxvitaz-L", but it drops the last word of
  // any name that legitimately spans two printed lines.
  //
  // This adds an ADDITIONAL candidate — never a replacement for the
  // single-line ones above — that joins a name-shaped line with an
  // immediately-following short, ALL-CAPS/digits "badge" line, scored by
  // the exact same rules plus a small completeness bonus so a genuinely
  // fuller name wins a tie against its own truncated fragment. The badge
  // line must be short and not itself a label word, so this never merges
  // two lines that already look like unrelated names or sentences.
  for (let i = 0; i < lines.length - 1; i += 1) {
    const base = lines[i].trim();
    const suffix = lines[i + 1].trim();
    if (scoreNameLine(base) === null) continue;
    if (suffix.length < 2 || suffix.length > 8) continue;
    if (!/^[A-Z0-9]+$/.test(suffix)) continue; // short badge-like token only
    if (NAME_SKIP_WORDS.test(suffix)) continue;
    const joined = `${base} ${suffix}`;
    const joinedScore = scoreNameLine(joined);
    if (joinedScore === null) continue;
    candidates.push({ value: joined, score: joinedScore + 5 });
  }

  const selected = candidates.sort((a, b) => b.score - a.score)[0]?.value;
  return selected?.replace(/^[^A-Za-z]+|[^A-Za-z0-9-]+$/g, '') || null;
}

function normalizeOcrText(rawText) {
  return rawText
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses raw OCR text into structured fields plus a per-field status.
 * Batch number and MFG/EXP dates are delegated to labelParser.js, which validates
 * every value (a date can never become a batch number) and distinguishes
 * DETECTED / NOT_DETECTED / UNREADABLE / INVALID. Everything absent is null.
 *
 * @param {string} rawText
 * @param {{ now?: Date }} [opts]
 */
export function parsePackagingText(rawText, { now = new Date() } = {}) {
  const normalizedText = normalizeOcrText(rawText);
  const lines = normalizedText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const batch = extractBatch(lines);
  const dates = extractDates(lines, { now });
  const medicineName = guessMedicineName(lines);
  const manufacturer = matchFirst(MANUFACTURER_PATTERNS, normalizedText) || normalizedText.match(COMPANY_PATTERN)?.[1]?.trim() || null;
  const strength = (normalizedText.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%))\b/i) || [])[1] || null;
  const present = (value) => (value ? 'DETECTED' : 'NOT_DETECTED');

  return {
    medicineName,
    genericName: null, // not reliably distinguishable from medicineName via text alone
    manufacturer,
    strength,
    batchNumber: batch.value,
    manufacturingDate: dates.manufacturingDate,
    expiryDate: dates.expiryDate,
    // Why a field is empty: NOT_DETECTED (label absent) vs UNREADABLE (label present, no valid
    // value) vs INVALID (impossible value). Callers must never treat these as a mismatch.
    fieldStatus: {
      medicineName: present(medicineName),
      genericName: 'NOT_DETECTED',
      manufacturer: present(manufacturer),
      strength: present(strength),
      batchNumber: batch.status,
      manufacturingDate: dates.status.manufacturingDate,
      expiryDate: dates.status.expiryDate,
    },
    unassignedDates: dates.unassignedDates,
    invalidValues: dates.invalid,
    notes: [
      ...dates.notes,
      ...(batch.status === 'UNREADABLE' ? ['A batch label was found but no valid batch number could be read next to it.'] : []),
    ],
  };
}

function fieldConfidence(value, words) {
  if (!value) return null;
  const normalizedValue = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalizedValue) return null;
  const matched = words.filter((word) => {
    const token = String(word.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return token.length >= 2 && normalizedValue.includes(token) && typeof word.confidence === 'number';
  });
  if (!matched.length) return null;
  return Math.round(matched.reduce((sum, word) => sum + word.confidence, 0) / matched.length);
}

function fieldConfidences(fields, words) {
  return Object.fromEntries(SCALAR_FIELDS.map((key) => [key, fieldConfidence(fields[key], words)]));
}

function normalizeFields(fields) {
  return Object.fromEntries(SCALAR_FIELDS.map((key) => [
    key,
    fields[key] ? String(fields[key]).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-US') : null,
  ]));
}

// --- Public entry point ----------------------------------------------------

/**
 * Runs real OCR on an uploaded image file and returns extracted, structured
 * fields. Never fabricates data — fields that weren't found are null, and
 * `status` tells the caller whether the result is usable at all.
 *
 * @param {string} imagePath absolute path to the uploaded file on disk
 */
export async function extractMedicineInfo(imagePath) {
  let exists = true;
  try {
    await fs.access(imagePath);
  } catch {
    exists = false;
  }
  if (!exists) {
    return { status: OCR_STATUS.OCR_FAILED, ...emptyFields(), rawText: null, normalizedText: null, confidence: null, fieldConfidence: {} };
  }

  const source = await loadSource(imagePath);
  const tempFiles = [];
  let ocrResult;
  try {
    const attempts = [];
    // Without a decodable source we still OCR the original file once.
    const angles = source ? ROTATION_ORDER : [null];
    for (const angle of angles) {
      const pathToOcr = source ? await renderRotation(source, angle) : imagePath;
      if (source) tempFiles.push(pathToOcr);
      // A worker is intentionally shared; run sequentially because tesseract
      // workers are not safe for simultaneous recognize calls.
      const result = await runTesseract(pathToOcr);
      const fields = parsePackagingText(result.text || '');
      const fieldCount = SCALAR_FIELDS.filter((key) => fields[key]).length;
      attempts.push({ ...result, fields, angle, score: fieldCount * 100 + (result.avgConfidence || 0) * 1000 + Math.min((result.text || '').length, 500) / 10 });
      // Stop as soon as an orientation reads confidently AND yields identity + a verifiable field.
      if ((result.avgConfidence || 0) >= EARLY_EXIT_CONFIDENCE && fields.medicineName && (fields.batchNumber || fields.expiryDate)) break;
    }
    ocrResult = attempts.sort((a, b) => b.score - a.score)[0];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Tesseract OCR] OCR call failed:', err.message);
    return {
      status: OCR_STATUS.OCR_FAILED,
      ...emptyFields(),
      rawText: null,
      normalizedText: null,
      confidence: null,
      fieldConfidence: {},
      error: err instanceof TimeoutError ? 'OCR_TIMEOUT' : 'OCR_ERROR',
    };
  } finally {
    await Promise.all(tempFiles.map(async (file) => {
      try {
        await fs.unlink(file);
      } catch (err) {
        if (err.code !== 'ENOENT') console.error('[Tesseract OCR] Could not remove temporary image:', err.message);
      }
    }));
  }

  const { text, avgConfidence, words } = ocrResult;
  const normalizedText = normalizeOcrText(text || '');

  if (!text || text.trim().length < 4) {
    return {
      status: OCR_STATUS.NO_TEXT_DETECTED,
      ...emptyFields(),
      rawText: text || '',
      normalizedText,
      confidence: avgConfidence,
      fieldConfidence: {},
    };
  }

  const parsed = ocrResult.fields || parsePackagingText(text);

  if (!parsed.medicineName) {
    // Tesseract found text, but nothing that looks like a product name —
    // most likely a non-medicine image (a receipt, a random document, etc).
    return {
      status: OCR_STATUS.NO_TEXT_DETECTED,
      ...parsed,
      rawText: text,
      normalizedText,
      confidence: avgConfidence,
      fieldConfidence: fieldConfidences(parsed, words),
      normalizedFields: normalizeFields(parsed),
    };
  }

  return {
    status: OCR_STATUS.OK,
    ...parsed,
    normalizedText,
    // Treat "consistent" as reasonably high real OCR confidence, defaulting
    // to true when Tesseract doesn't report word-level confidence at all.
    consistent: avgConfidence === null ? true : avgConfidence >= 0.6,
    rawText: text,
    confidence: avgConfidence,
    fieldConfidence: fieldConfidences(parsed, words),
    normalizedFields: normalizeFields(parsed),
  };
}

// Cleanly shuts down the Tesseract worker. Call on server shutdown so the
// process can exit without a lingering worker thread.
export async function shutdownOcrWorker() {
  await resetWorker(); // tolerates a worker that failed to start
}
