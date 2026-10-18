import Setting from '../models/Setting.js';

// Safe, validated runtime configuration. Only these keys are accepted — there
// is no way to store arbitrary values or code here, and no secrets.
export const DEFAULT_SETTINGS = {
  risk: {
    lowRiskMin: 80,          // score >= this  -> low risk
    mediumRiskMin: 50,       // score >= this  -> medium risk, below -> high
    verifiedMinConfidence: 85,
    packagingMatchMin: 82,   // similarity >= this -> PACKAGING_MATCH
    packagingPartialMin: 60, // similarity >= this -> PACKAGING_PARTIAL_MATCH
    duplicateThreshold: 3,   // scans of the same code inside the window
    duplicateWindowMinutes: 10,
    // Relative signal weights (0-100). Renormalised over the checks that are available.
    weightMedicineIdentity: 20, weightManufacturer: 10, weightBatch: 30, weightExpiry: 12,
    weightManufacturingDate: 8, weightQr: 10, weightPackaging: 5, weightDuplicate: 5,
  },
  system: {
    qrVerificationEnabled: true,
  },
};

// Bounds enforced on the backend for every numeric setting.
const BOUNDS = {
  risk: {
    lowRiskMin: [1, 100], mediumRiskMin: [1, 100], verifiedMinConfidence: [1, 100],
    packagingMatchMin: [1, 100], packagingPartialMin: [1, 100],
    duplicateThreshold: [2, 100], duplicateWindowMinutes: [1, 1440],
    weightMedicineIdentity: [0, 100], weightManufacturer: [0, 100], weightBatch: [0, 100], weightExpiry: [0, 100],
    weightManufacturingDate: [0, 100], weightQr: [0, 100], weightPackaging: [0, 100], weightDuplicate: [0, 100],
  },
};
const BOOLEANS = { system: ['qrVerificationEnabled'] };

let cache = null;
let cacheAt = 0;
const TTL_MS = 15_000;

function merge(stored) {
  return {
    risk: { ...DEFAULT_SETTINGS.risk, ...(stored?.risk || {}) },
    system: { qrVerificationEnabled: stored?.system?.qrVerificationEnabled ?? DEFAULT_SETTINGS.system.qrVerificationEnabled },
  };
}

/** settings.risk.weight* (0-100) -> the engine's 0-1 weights. */
export function weightsFromSettings(risk) {
  const pick = (key, setting) => (Number.isFinite(risk?.[setting]) ? { [key]: risk[setting] / 100 } : {});
  return {
    ...pick('medicineIdentity', 'weightMedicineIdentity'), ...pick('manufacturer', 'weightManufacturer'), ...pick('batch', 'weightBatch'),
    ...pick('expiry', 'weightExpiry'), ...pick('manufacturingDate', 'weightManufacturingDate'), ...pick('qr', 'weightQr'),
    ...pick('packaging', 'weightPackaging'), ...pick('duplicate', 'weightDuplicate'),
  };
}

export async function getSettings() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  try {
    const doc = await Setting.findOne({ key: 'config' }).lean();
    cache = merge(doc?.value);
  } catch {
    cache = merge(null); // never let a settings read failure break verification
  }
  cacheAt = Date.now();
  return cache;
}

/** Validates a partial patch. Returns { value } or { error }. */
export function validatePatch(patch, section) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { error: 'Invalid settings payload.' };
  const out = {};
  for (const [key, raw] of Object.entries(patch)) {
    if (BOUNDS[section]?.[key]) {
      const n = Number(raw);
      const [min, max] = BOUNDS[section][key];
      if (!Number.isFinite(n) || n < min || n > max) return { error: `${key} must be a number between ${min} and ${max}.` };
      out[key] = n;
    } else if (BOOLEANS[section]?.includes(key)) {
      if (typeof raw !== 'boolean') return { error: `${key} must be true or false.` };
      out[key] = raw;
    } else {
      return { error: `Unknown setting: ${key}.` };
    }
  }
  return { value: out };
}

export async function updateSettings(section, patch, adminId) {
  const { value, error } = validatePatch(patch, section);
  if (error) return { error };
  const current = await getSettings();
  const next = { ...current, [section]: { ...current[section], ...value } };
  const r = next.risk;
  if (r.mediumRiskMin >= r.lowRiskMin) return { error: 'mediumRiskMin must be lower than lowRiskMin.' };
  if (r.packagingPartialMin >= r.packagingMatchMin) return { error: 'packagingPartialMin must be lower than packagingMatchMin.' };
  const weights = Object.entries(r).filter(([k]) => k.startsWith('weight')).map(([, v]) => v);
  if (weights.length && weights.every((w) => w === 0)) return { error: 'At least one signal weight must be greater than zero.' };
  await Setting.findOneAndUpdate({ key: 'config' }, { value: next, updatedBy: adminId }, { upsert: true, new: true });
  cache = next; cacheAt = Date.now();
  return { value: next };
}
