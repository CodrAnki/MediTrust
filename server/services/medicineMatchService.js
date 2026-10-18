import Medicine from '../models/Medicine.js';

export function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Normalized Levenshtein similarity, 0..1. Exported for testing.
export function similarity(a, b) {
  const left = normalize(a); const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const rows = Array.from({ length: left.length + 1 }, (_, i) => i);
  for (let j = 1; j <= right.length; j += 1) {
    let previous = rows[0]; rows[0] = j;
    for (let i = 1; i <= left.length; i += 1) {
      const saved = rows[i];
      rows[i] = Math.min(rows[i] + 1, rows[i - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return 1 - rows[left.length] / Math.max(left.length, right.length);
}

export const IDENTITY_MATCH_THRESHOLD = 0.88;
export const MANUFACTURER_MATCH_THRESHOLD = 0.88;

// A bounded in-memory fuzzy comparison against the trusted medicine records.
// It is never used to manufacture a match: both identity and manufacturer
// must independently be reasonably similar.
//
// @param {object} [deps] injectable Medicine model, for testing without a live DB
export async function matchMedicine({ medicineName, manufacturer, strength }, { MedicineModel = Medicine } = {}) {
  const medicines = await MedicineModel.find({ active: { $ne: false } }, 'medicineName brandName genericName composition manufacturer strength image').lean();
  if (!medicines.length) return { status: 'REFERENCE_NOT_FOUND', medicine: null, identityConfidence: 0, manufacturerConfidence: 0 };
  const candidates = medicines.map((medicine) => ({
    medicine,
    identityConfidence: similarity(medicineName, medicine.medicineName),
    manufacturerConfidence: similarity(manufacturer, medicine.manufacturer),
    strengthMatches: !strength || !medicine.strength || normalize(strength) === normalize(medicine.strength),
  })).sort((a, b) => (b.identityConfidence + b.manufacturerConfidence) - (a.identityConfidence + a.manufacturerConfidence));
  const best = candidates[0];
  const identityMatch = best.identityConfidence >= IDENTITY_MATCH_THRESHOLD;
  const manufacturerMatch = best.manufacturerConfidence >= MANUFACTURER_MATCH_THRESHOLD;
  return {
    status: identityMatch && manufacturerMatch && best.strengthMatches ? 'MATCH' : 'MISMATCH',
    medicine: best.medicine,
    identityConfidence: best.identityConfidence,
    manufacturerConfidence: best.manufacturerConfidence,
  };
}
