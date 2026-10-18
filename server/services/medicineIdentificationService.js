import { matchMedicine, similarity, normalize, IDENTITY_MATCH_THRESHOLD } from './medicineMatchService.js';

// Below this name similarity there is no plausible local candidate at all:
// the medicine simply isn't in the database, which must read as "reference not
// found" — never as a mismatch against some unrelated medicine.
const PLAUSIBLE_CANDIDATE_MIN = 0.6;

function compositionMatched(ocrGeneric, medicine) {
  const target = medicine?.composition || medicine?.genericName;
  if (!ocrGeneric || !target) return null;
  return similarity(ocrGeneric, target) >= 0.8 || normalize(target).includes(normalize(ocrGeneric));
}

function strengthMatched(ocrStrength, strength) {
  if (!ocrStrength || !strength) return null;
  return normalize(ocrStrength) === normalize(strength);
}

async function localLookup(ocr, MedicineModel) {
  const raw = await matchMedicine(ocr, MedicineModel ? { MedicineModel } : undefined);
  const medicine = raw.medicine;

  if (raw.status === 'REFERENCE_NOT_FOUND') return { medicineMatch: raw, found: false };

  if (raw.status === 'MISMATCH' && raw.identityConfidence < PLAUSIBLE_CANDIDATE_MIN) {
    return { medicineMatch: { status: 'REFERENCE_NOT_FOUND', medicine: null, identityConfidence: 0, manufacturerConfidence: 0 }, found: false };
  }

  if (medicine && !medicine.manufacturer) {
    const identityOk = raw.identityConfidence >= IDENTITY_MATCH_THRESHOLD;
    const strengthOk = strengthMatched(ocr.strength, medicine.strength) !== false;
    return {
      medicineMatch: { ...raw, manufacturerConfidence: null, status: identityOk && strengthOk ? 'MATCH' : 'MISMATCH' },
      found: true,
    };
  }
  return { medicineMatch: raw, found: true };
}

/**
 * Identifies a medicine using only the local MediTrust reference database.
 * @param {object} ocr extracted fields (medicineName, genericName, strength, manufacturer)
 * @param {{ MedicineModel?: object }} [opts]
 */
export async function identifyMedicine(ocr, { MedicineModel } = {}) {
  const { medicineMatch, found } = await localLookup(ocr, MedicineModel);
  const medicine = medicineMatch.medicine;
  const matched = medicineMatch.status === 'MATCH';
  const localConfidence = found
    ? medicineMatch.identityConfidence * 0.6 + (medicineMatch.manufacturerConfidence ?? medicineMatch.identityConfidence) * 0.4
    : 0;

  const medicineIdentification = {
    source: matched ? 'local' : 'none',
    medicineId: found && medicine ? String(medicine._id) : null,
    confidence: Math.round(localConfidence * 100) / 100,
    nameMatched: found ? medicineMatch.identityConfidence >= IDENTITY_MATCH_THRESHOLD : false,
    compositionMatched: found ? compositionMatched(ocr.genericName, medicine) : null,
    manufacturerMatched: found ? (medicineMatch.manufacturerConfidence == null ? null : medicineMatch.manufacturerConfidence >= 0.88) : null,
    strengthMatched: found ? strengthMatched(ocr.strength, medicine?.strength) : null,
    matchReasons: [],
  };
  if (found) {
    medicineIdentification.matchReasons.push(`Local database candidate "${medicine?.medicineName}" (name similarity ${Math.round(medicineMatch.identityConfidence * 100)}%).`);
  } else {
    medicineIdentification.matchReasons.push('No plausible medicine in the MediTrust local database.');
  }

  return { medicineMatch, medicineIdentification };
}
