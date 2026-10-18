import Batch from '../models/Batch.js';

// REAL as of Phase 7.5: ocrService.js returns an actual extracted batch
// number (or null), and this does a genuine database check — no random
// fallback, ever. An unknown or missing batch number is never verified.
//
// Phase 8 additions: normalization + a bounded fuzzy retry. Real-world OCR
// on a physical label routinely misreads O/0, I/1/l, S/5, B/8, and picks
// up stray spaces/hyphens that aren't part of the actual printed code.
// Without normalization, a genuine medicine could get marked "not found"
// purely because of an OCR artifact, not because the batch is actually
// unrecognized. This never invents a match — it only tries a small,
// well-defined set of alternate readings of the SAME extracted text
// against the SAME real database, and always reports which strategy (if
// any) produced the match so the result stays honest about how it found
// what it found.

const OCR_CONFUSIONS = [
  ['0', 'O'],
  ['1', 'I'],
  ['1', 'L'],
  ['5', 'S'],
  ['8', 'B'],
];

export const BATCH_MATCH_TYPE = {
  EXACT: 'EXACT',
  NORMALIZED: 'NORMALIZED',
  FUZZY: 'FUZZY',
  NONE: 'NONE',
};

// Trim, uppercase, and collapse internal whitespace/hyphen inconsistencies
// that OCR commonly introduces. Does not change any character's identity
// (no O/0 guessing here) — this step is safe and lossless.
export function normalizeBatchNumber(raw) {
  if (!raw) return null;
  return String(raw).trim().toUpperCase().replace(/\s+/g, '').replace(/[-_/]/g, '');
}

// Generates a small, bounded set of alternate readings by swapping
// commonly-confused OCR character pairs one at a time. Deliberately does
// NOT explode into every combination (that would risk false-positive
// matches) — just single-character substitutions, applied one at a time,
// against a real database lookup. If none of these happen to match a real
// record either, the batch is correctly reported as not found.
function fuzzyVariants(normalized) {
  const variants = new Set();
  for (const [a, b] of OCR_CONFUSIONS) {
    if (normalized.includes(a)) variants.add(normalized.replaceAll(a, b));
    if (normalized.includes(b)) variants.add(normalized.replaceAll(b, a));
  }
  variants.delete(normalized);
  return [...variants];
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fromDoc(doc, matchType) {
  return {
    verified: doc.status === 'ACTIVE',
    matchType,
    matchedBatchNumber: doc.batchNumber,
    medicineId: doc.medicineId,
    qrCode: doc.qrCode || null,
    status: doc.status,
    // Registered dates, so the risk engine can compare them with what was printed.
    referenceManufacturingDate: doc.manufacturingDate || null,
    referenceExpiryDate: doc.expiryDate || null,
  };
}

const EMPTY_RESULT = {
  verified: false,
  matchType: BATCH_MATCH_TYPE.NONE,
  matchedBatchNumber: null,
  medicineId: null,
  qrCode: null,
  status: null,
  referenceManufacturingDate: null,
  referenceExpiryDate: null,
};

/**
 * @param {string|null} batchNumber raw batch number as extracted by OCR (may be null)
 * @param {object} [deps] injectable Batch model, for testing without a live DB
 * @returns {Promise<{verified: boolean, matchType: string, matchedBatchNumber: string|null, medicineId: any, qrCode: string|null, status: string|null}>}
 */
export async function checkBatch(batchNumber, { BatchModel = Batch } = {}) {
  const normalized = normalizeBatchNumber(batchNumber);
  if (!normalized) {
    return { ...EMPTY_RESULT };
  }

  // 1. Exact match against what was actually extracted (most common case
  //    for a clean, well-lit label).
  const exact = await BatchModel.findOne({ batchNumber });
  if (exact) return fromDoc(exact, BATCH_MATCH_TYPE.EXACT);

  // 2. Same text, normalized (case/whitespace/punctuation only — no
  //    character substitution). Case-insensitive exact match.
  const normalizedMatch = await BatchModel.findOne({
    batchNumber: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' },
  });
  if (normalizedMatch) return fromDoc(normalizedMatch, BATCH_MATCH_TYPE.NORMALIZED);

  // 3. Bounded single-character OCR-confusion retry.
  for (const variant of fuzzyVariants(normalized)) {
    const fuzzyMatch = await BatchModel.findOne({
      batchNumber: { $regex: `^${escapeRegExp(variant)}$`, $options: 'i' },
    });
    if (fuzzyMatch) return fromDoc(fuzzyMatch, BATCH_MATCH_TYPE.FUZZY);
  }

  return { ...EMPTY_RESULT };
}

// --- Batch <-> medicine cross-check (Phase 12, item 3) ---------------------
//
// A batch number matching a real DB record is not, by itself, proof that
// the record belongs to the SAME medicine the label/OCR/reference match
// identified. Without this check, a genuine batch number belonging to
// medicine A could be presented alongside a label that OCR/fuzzy-matched
// to medicine B, and the pipeline would silently accept both signals as
// independently "good" instead of flagging the real inconsistency.
//
// Pure function, no DB access — safe and cheap to call unconditionally,
// and trivially unit-testable.
//
// @param {{medicineId: any}} batch result from checkBatch()
// @param {{_id: any}|null} matchedMedicine the `medicine` from matchMedicine()
// @returns {'CONSISTENT'|'INCONSISTENT'|'NOT_APPLICABLE'}
export function checkBatchMedicineConsistency(batch, matchedMedicine) {
  if (!batch?.medicineId || !matchedMedicine?._id) return 'NOT_APPLICABLE';
  return String(batch.medicineId) === String(matchedMedicine._id) ? 'CONSISTENT' : 'INCONSISTENT';
}
