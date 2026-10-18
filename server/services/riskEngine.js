// MediTrust risk engine v2 — evidence assessment against LOCAL reference data.
//
// WHAT THIS IS NOT: it does not detect counterfeits and it is not a probability. The numeric
// `score` measures how strongly the *available* checks agree with the reference records; it has
// not been statistically calibrated against known genuine/counterfeit samples. A QR code or
// barcode that decodes, or a package that looks similar, is never proof of authenticity.
//
// Rules enforced here (each has tests in tests/riskEngine.v2.test.js):
//   R1  Missing / unreadable / unmatched evidence is UNAVAILABLE — it never counts as a mismatch
//       and never counts as support.
//   R2  Only a conflict between a value READ from the package and a TRUSTED reference is MISMATCH.
//   R3  VERIFIED_AGAINST_REFERENCE needs: identity + manufacturer + batch matched to trusted
//       records, a readable not-expired expiry, no flags, OCR not low-confidence, and
//       score >= verifiedMin. QR and packaging are supporting signals and are not required.
//   R4  EXPIRED is reported as EXPIRED whatever else matches. Never presented as safe to use.
//   R5  A repeated scan, an unknown QR, or a dissimilar package can only raise NEEDS_REVIEW —
//       never MISMATCH_DETECTED and never "counterfeit".
//   R6  The score is withheld (null) when essential inputs (identity, batch, expiry) are unavailable.
//   R7  One underlying problem is counted once in the score (checks share a `cause`).

import { parseMonthYear } from './labelParser.js';

export const ENGINE_VERSION = '2.0.0';

/** The public status contract (backend + frontend). Legacy values are mapped by LEGACY_STATUS. */
export const STATUS = Object.freeze({
  VERIFIED_AGAINST_REFERENCE: 'VERIFIED_AGAINST_REFERENCE',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  MISMATCH_DETECTED: 'MISMATCH_DETECTED',
  EXPIRED: 'EXPIRED',
  REFERENCE_NOT_FOUND: 'REFERENCE_NOT_FOUND',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  NOT_DETECTED: 'NOT_DETECTED',
  INVALID_INPUT: 'INVALID_INPUT',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
});

/** How records saved before v2 map onto the contract (display/filters only; stored data is untouched). */
export const LEGACY_STATUS = Object.freeze({
  VERIFIED: STATUS.VERIFIED_AGAINST_REFERENCE,
  HIGH_CONFIDENCE: STATUS.NEEDS_REVIEW, // never fully checked: required evidence was missing
  SUSPICIOUS: STATUS.NEEDS_REVIEW,
  HIGH_RISK: STATUS.MISMATCH_DETECTED,
  MISMATCH: STATUS.MISMATCH_DETECTED,
  UNVERIFIED: STATUS.NEEDS_REVIEW,
  UNKNOWN: STATUS.NEEDS_REVIEW,
});
export const normalizeStatus = (status) => LEGACY_STATUS[status] || status;

/** Every stored value that means `status` — the status itself plus legacy values that map onto it (for DB filters). */
export function storedStatusesFor(status) {
  const target = normalizeStatus(status);
  return [...new Set([target, status, ...Object.entries(LEGACY_STATUS).filter(([, v]) => v === target).map(([k]) => k)])];
}

/**
 * Signal weights: relative importance only. They are renormalised over the checks that are
 * actually available, so an unavailable check never lowers the score. Overridable through
 * settings.risk.weight* (see settingsService.js).
 */
export const SIGNAL_WEIGHTS = Object.freeze({
  medicineIdentity: 0.2, manufacturer: 0.1, batch: 0.3, expiry: 0.12,
  manufacturingDate: 0.08, qr: 0.1, packaging: 0.05, duplicate: 0.05,
});

/** Documentation of every signal: what it measures, thresholds, and its effect on the result. */
export const SIGNAL_RULES = Object.freeze({
  medicineIdentity: 'MATCH if name similarity >= 0.88 to the matched reference; MISMATCH if a plausible (>= 0.6) candidate is below that; UNKNOWN if no reference exists. Required for VERIFIED.',
  manufacturer: 'Same threshold as identity. NOT_AVAILABLE if the reference has no manufacturer. Required for VERIFIED when the reference has one.',
  batch: 'MATCH only for an exact/normalised match to an ACTIVE batch of the same medicine. PARTIAL for an OCR-confusion (fuzzy) match. FLAGGED for a recalled/suspended batch. MISMATCH if the batch belongs to a different medicine. UNKNOWN if not in reference. Required for VERIFIED.',
  expiry: 'VALID if a readable month/year is in the future, EXPIRED if past, MISMATCH if it disagrees with the trusted batch record. Required for VERIFIED.',
  manufacturingDate: 'Informative only when the trusted batch record has a date to compare with; MISMATCH if they differ, FLAGGED if the value read is impossible.',
  qr: 'A batch QR matching the batch record supports (never proves). Manufacturer-level QR is a weak PARTIAL. Unknown QR is FLAGGED. A batch QR for a DIFFERENT batch than the printed one is MISMATCH. Not required.',
  packaging: 'Visual similarity to approved reference images. MATCH/PARTIAL support; dissimilar is FLAGGED. Supporting signal only. Not required.',
  duplicate: 'Repeated scans of one identifier inside the window FLAG for review. Absence of repeats carries no weight.',
});

export const LIMITATIONS = Object.freeze([
  'Automated checks cannot guarantee that a medicine is genuine or safe to use.',
  'Results compare what could be read from your photos with MediTrust’s own reference records, which may be incomplete.',
  'A QR code or barcode that decodes, or a package that looks similar, is not proof of authenticity — both can be copied.',
]);

const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[\s\-_/]/g, '');

/** true / false when both are comparable month-year values, null when either is not. */
function sameMonth(a, b) {
  const pa = parseMonthYear(a); const pb = parseMonthYear(b);
  if (!pa?.valid || !pb?.valid || pa.precision !== 'MONTH' || pb.precision !== 'MONTH') return null;
  return pa.normalized === pb.normalized;
}

function check(key, label, weight, c) {
  return {
    key, label, weight,
    status: c.status, confidence: c.confidence ?? 0, evidence: c.evidence,
    available: Boolean(c.available), // true = takes part in the score
    effect: c.effect || 'NEUTRAL', // SUPPORTS | CONTRADICTS | FLAGS | NEUTRAL
    cause: c.cause || key, // checks sharing a cause are scored once (R7)
    required: Boolean(c.required),
    reference: c.reference ?? null, scanned: c.scanned ?? null, // side-by-side values for the result page
  };
}

const whyMissing = (fieldStatus, field, what) => (
  fieldStatus?.[field] === 'UNREADABLE' ? `A ${what} label was found but its value could not be read.`
    : fieldStatus?.[field] === 'INVALID' ? `The ${what} that was read is not a possible value.`
      : `No ${what} was found in the photos.`);

/**
 * @param {object} input
 * @param {number} [input.verifiedMin=85] minimum score for VERIFIED_AGAINST_REFERENCE
 * @param {Partial<typeof SIGNAL_WEIGHTS>} [input.weights]
 */
export function assessVerification({
  medicineMatch, batch, qr, packaging, expiry, manufacturingDate, duplicate, ocr = {},
  medicineConsistency = 'NOT_APPLICABLE', verifiedMin = 85, weights = {},
}) {
  const W = { ...SIGNAL_WEIGHTS, ...weights };
  const fs = ocr.fieldStatus || {};
  const medicineRefMissing = medicineMatch?.status === 'REFERENCE_NOT_FOUND';
  const referenceMedicine = !medicineRefMissing ? medicineMatch?.medicine : null;
  const hasIdentity = Boolean(ocr.medicineName);
  const hasManufacturer = Boolean(ocr.manufacturer);
  const hasBatch = Boolean(ocr.batchNumber || batch?.extractedBatchNumber);
  const batchFound = Boolean(batch?.matchType && batch.matchType !== 'NONE');
  const checks = [];

  // --- Medicine identity ---------------------------------------------------------------------
  if (medicineRefMissing) {
    checks.push(check('medicineIdentity', 'Medicine identity', W.medicineIdentity, {
      status: hasIdentity ? 'UNKNOWN' : 'NOT_DETECTED', required: true, scanned: ocr.medicineName || null,
      evidence: hasIdentity ? 'A medicine name was read, but there is no reference record to compare it with.' : whyMissing(fs, 'medicineName', 'medicine name'),
    }));
  } else {
    const ok = medicineMatch.identityConfidence >= 0.88;
    checks.push(check('medicineIdentity', 'Medicine identity', W.medicineIdentity, {
      status: ok ? 'MATCH' : 'MISMATCH', confidence: medicineMatch.identityConfidence * 100, available: true, required: true,
      effect: ok ? 'SUPPORTS' : 'CONTRADICTS', scanned: ocr.medicineName || null, reference: referenceMedicine?.medicineName || null,
      evidence: `Name similarity to the reference: ${Math.round(medicineMatch.identityConfidence * 100)}%.`,
    }));
  }

  // --- Manufacturer --------------------------------------------------------------------------
  {
    let c;
    if (medicineRefMissing) c = { status: hasManufacturer ? 'UNKNOWN' : 'NOT_DETECTED', evidence: hasManufacturer ? 'A manufacturer was read, but there is no reference record to compare it with.' : whyMissing(fs, 'manufacturer', 'manufacturer') };
    else if (medicineMatch.manufacturerConfidence == null) c = { status: 'NOT_AVAILABLE', evidence: 'The matched reference record has no manufacturer to compare against.' };
    else if (!hasManufacturer) c = { status: 'NOT_DETECTED', required: true, evidence: whyMissing(fs, 'manufacturer', 'manufacturer') };
    else {
      const ok = medicineMatch.manufacturerConfidence >= 0.88;
      c = { status: ok ? 'MATCH' : 'MISMATCH', confidence: medicineMatch.manufacturerConfidence * 100, available: true, required: true, effect: ok ? 'SUPPORTS' : 'CONTRADICTS', evidence: `Manufacturer similarity to the reference: ${Math.round(medicineMatch.manufacturerConfidence * 100)}%.` };
    }
    checks.push(check('manufacturer', 'Manufacturer', W.manufacturer, { ...c, scanned: ocr.manufacturer || null, reference: referenceMedicine?.manufacturer || null }));
  }

  // --- Batch ---------------------------------------------------------------------------------
  {
    let c;
    const printed = ocr.batchNumber || null;
    if (medicineConsistency === 'INCONSISTENT') {
      c = { status: 'MISMATCH', available: true, effect: 'CONTRADICTS', required: true, cause: 'BATCH', evidence: `Trusted batch ${batch.matchedBatchNumber} exists but belongs to a different medicine than the one identified from this label.` };
    } else if (batchFound && batch.status && batch.status !== 'ACTIVE') {
      c = { status: 'FLAGGED', available: true, effect: 'FLAGS', required: true, cause: 'BATCH', confidence: 0, evidence: `Batch ${batch.matchedBatchNumber} is registered with status ${batch.status}. Do not use it until a pharmacist or the manufacturer confirms.` };
    } else if (batchFound && batch.matchType === 'FUZZY') {
      c = { status: 'PARTIAL', available: true, effect: 'FLAGS', required: true, cause: 'BATCH', confidence: 70, evidence: `The printed batch “${printed}” matched ${batch.matchedBatchNumber} only after correcting common OCR confusions (such as O/0). Please confirm it by eye.` };
    } else if (batchFound) {
      c = { status: 'MATCH', available: true, effect: 'SUPPORTS', required: true, cause: 'BATCH', confidence: 100, evidence: `Batch ${batch.matchedBatchNumber} matches an active registered batch.` };
    } else if (hasBatch) {
      c = { status: 'UNKNOWN', required: true, evidence: 'A batch number was read, but it is not in MediTrust’s reference records. That does not mean it is fake — the records may be incomplete.' };
    } else {
      c = { status: 'NOT_DETECTED', required: true, evidence: whyMissing(fs, 'batchNumber', 'batch number') };
    }
    checks.push(check('batch', 'Batch', W.batch, { ...c, scanned: printed, reference: batchFound ? batch.matchedBatchNumber : null }));
  }

  // --- Expiry --------------------------------------------------------------------------------
  {
    const refExpiry = batchFound ? batch.referenceExpiryDate : null;
    const dateAgrees = expiry.status === 'VALID' || expiry.status === 'EXPIRED' ? sameMonth(ocr.expiryDate, refExpiry) : null;
    let c;
    if (dateAgrees === false) {
      c = { status: 'MISMATCH', available: true, effect: 'CONTRADICTS', required: true, cause: 'EXPIRY_DATE', evidence: `The printed expiry (${ocr.expiryDate}) differs from the registered expiry for this batch (${refExpiry}).` };
    } else if (expiry.status === 'EXPIRED') {
      c = { status: 'EXPIRED', available: true, effect: 'CONTRADICTS', required: true, evidence: `The expiry date read from the package (${ocr.expiryDate}) has passed. Do not use this medicine.` };
    } else if (expiry.status === 'VALID') {
      c = { status: 'VALID', available: true, effect: 'SUPPORTS', confidence: 100, required: true, evidence: dateAgrees ? 'A readable, future expiry date that agrees with the registered batch.' : 'A readable expiry date that has not passed. (No registered expiry was available to compare it with.)' };
    } else {
      c = { status: 'NOT_DETECTED', required: true, evidence: whyMissing(fs, 'expiryDate', 'expiry date') };
    }
    checks.push(check('expiry', 'Expiry', W.expiry, { ...c, scanned: ocr.expiryDate || null, reference: refExpiry || null }));
  }

  // --- Manufacturing date --------------------------------------------------------------------
  {
    const refMfg = batchFound ? batch.referenceManufacturingDate : null;
    const agrees = manufacturingDate ? sameMonth(manufacturingDate, refMfg) : null;
    let c;
    if (fs.manufacturingDate === 'INVALID') c = { status: 'FLAGGED', effect: 'FLAGS', evidence: 'The manufacturing date that was read is not possible (for example, it is in the future). It may be misread.' };
    else if (agrees === true) c = { status: 'MATCH', available: true, effect: 'SUPPORTS', confidence: 100, evidence: 'The manufacturing date agrees with the registered batch.' };
    else if (agrees === false) c = { status: 'MISMATCH', available: true, effect: 'CONTRADICTS', cause: 'MFG_DATE', evidence: `The printed manufacturing date (${manufacturingDate}) differs from the registered one (${refMfg}).` };
    else if (manufacturingDate) c = { status: 'UNKNOWN', evidence: 'A manufacturing date was read, but there is no registered date to compare it with.' };
    else c = { status: 'NOT_DETECTED', evidence: whyMissing(fs, 'manufacturingDate', 'manufacturing date') };
    checks.push(check('manufacturingDate', 'Manufacturing date', W.manufacturingDate, { ...c, scanned: manufacturingDate || null, reference: refMfg || null }));
  }

  // --- QR / barcode (supporting; copying a code is trivial) ----------------------------------
  {
    let c;
    switch (qr?.status) {
      case 'BATCH_QR_VERIFIED': {
        const regBatch = qr.batch?.batchNumber;
        if (ocr.batchNumber && regBatch && normalizeCode(regBatch) !== normalizeCode(ocr.batchNumber)) {
          c = { status: 'MISMATCH', available: true, effect: 'CONTRADICTS', cause: 'BATCH', evidence: `The QR code is registered to batch ${regBatch}, but the printed batch reads ${ocr.batchNumber}.` };
        } else {
          c = { status: 'MATCH', available: true, effect: 'SUPPORTS', confidence: 100, evidence: 'The decoded QR matches the code registered for this batch. A copied code would match too, so this alone proves nothing.' };
        }
        break;
      }
      case 'MANUFACTURER_QR_TRUSTED':
        c = { status: 'PARTIAL', available: true, effect: 'NEUTRAL', confidence: 60, evidence: 'The QR is a known manufacturer-level code (shared by many packs, not specific to this batch).' };
        break;
      case 'QR_UNTRUSTED':
        c = { status: 'FLAGGED', available: true, effect: 'FLAGS', confidence: 30, evidence: 'A QR code was decoded but is not in MediTrust’s records, so it could not be checked against an authoritative source. That is not proof of a problem.' };
        break;
      default:
        c = { status: 'NOT_DETECTED', evidence: 'No readable QR code was found in the photos. This is not negative evidence.' };
    }
    checks.push(check('qr', 'QR verification', W.qr, c));
  }

  // --- Packaging (supporting only) -----------------------------------------------------------
  {
    const sim = typeof packaging?.similarity === 'number' ? packaging.similarity : null;
    let c;
    if (sim === null) c = { status: 'NOT_AVAILABLE', evidence: 'No approved reference image was available for this medicine, so packaging could not be compared.' };
    else if (packaging.status === 'PACKAGING_MATCH') c = { status: 'MATCH', available: true, effect: 'SUPPORTS', confidence: sim, evidence: `Visual similarity ${sim}%. Similar packaging is a supporting signal, not proof.` };
    else if (packaging.status === 'PACKAGING_PARTIAL_MATCH') c = { status: 'PARTIAL', available: true, effect: 'NEUTRAL', confidence: sim, evidence: `Visual similarity ${sim}%: a partial resemblance (angle, lighting or a different pack version can cause this).` };
    else c = { status: 'FLAGGED', available: true, effect: 'FLAGS', confidence: sim, evidence: `Visual similarity ${sim}%: the photo differs noticeably from the reference image. Photo angle, lighting or a newer pack design can also cause this.` };
    checks.push(check('packaging', 'Packaging', W.packaging, c));
  }

  // --- Duplicate activity --------------------------------------------------------------------
  checks.push(check('duplicate', 'Repeated scans', W.duplicate, duplicate?.detected
    ? { status: 'FLAGGED', available: true, effect: 'FLAGS', confidence: 20, evidence: `${duplicate.reason} Repeated scanning alone does not mean a medicine is counterfeit.` }
    : { status: 'CLEAR', evidence: 'No unusual repeated scanning of this identifier was seen.' }));

  // --- OCR quality gate (not scored) ---------------------------------------------------------
  checks.push(check('ocrQuality', 'Text reading quality', 0, ocr.consistent === false
    ? { status: 'LOW_CONFIDENCE', effect: 'FLAGS', evidence: 'The text was read with low confidence or differed between photos, so extracted values may be wrong. Please review them.' }
    : { status: 'OK', evidence: 'The text was read with acceptable confidence.' }));

  // ================= overall decision =================
  const by = Object.fromEntries(checks.map((e) => [e.key, e]));
  const mismatches = checks.filter((e) => e.status === 'MISMATCH');
  const flags = checks.filter((e) => e.effect === 'FLAGS');
  const requiredMissing = checks.filter((e) => e.required && !e.available);
  const nothingRead = !ocr.medicineName && !ocr.batchNumber && !qr?.code;
  const noReferenceAtAll = medicineRefMissing && !batchFound;

  const reasons = [];
  for (const e of mismatches) reasons.push({ code: `${e.key.toUpperCase()}_MISMATCH`, severity: 'critical', message: e.evidence, checks: [e.key] });
  if (by.expiry.status === 'EXPIRED') reasons.push({ code: 'EXPIRED', severity: 'critical', message: by.expiry.evidence, checks: ['expiry'] });
  for (const e of flags) reasons.push({ code: `${e.key.toUpperCase()}_FLAG`, severity: 'warning', message: e.evidence, checks: [e.key] });
  for (const e of requiredMissing) reasons.push({ code: `${e.key.toUpperCase()}_UNAVAILABLE`, severity: 'warning', message: e.evidence, checks: [e.key] });

  // Score (R6, R7)
  const unavailableEssentials = ['medicineIdentity', 'batch', 'expiry'].filter((k) => !by[k].available);
  let score = null; let scoreWithheldReason = null;
  if (unavailableEssentials.length) {
    scoreWithheldReason = `Not enough evidence for a meaningful score: ${unavailableEssentials.map((k) => by[k].label.toLowerCase()).join(', ')} could not be checked against reference data.`;
  } else {
    const seenCauses = new Set();
    let sum = 0; let total = 0;
    for (const e of checks.filter((x) => x.available && x.weight > 0)) {
      if (seenCauses.has(e.cause)) continue; // R7: one underlying problem, one vote
      seenCauses.add(e.cause);
      sum += e.weight * e.confidence; total += e.weight;
    }
    score = total > 0 ? Math.round((sum / total) * 10) / 10 : null;
  }

  let status;
  if (nothingRead) status = STATUS.NOT_DETECTED;
  else if (by.expiry.status === 'EXPIRED') status = STATUS.EXPIRED;
  else if (mismatches.length) status = STATUS.MISMATCH_DETECTED;
  else if (noReferenceAtAll) status = STATUS.REFERENCE_NOT_FOUND;
  else if (flags.length || requiredMissing.length || score === null || score < verifiedMin) status = STATUS.NEEDS_REVIEW;
  else status = STATUS.VERIFIED_AGAINST_REFERENCE;

  // Defence in depth for R3: every required check must be a genuine match (or not applicable).
  if (status === STATUS.VERIFIED_AGAINST_REFERENCE) {
    const allGood = checks.filter((e) => e.required).every((e) => (e.available && ['MATCH', 'VALID'].includes(e.status)) || e.status === 'NOT_AVAILABLE');
    if (!allGood) status = STATUS.NEEDS_REVIEW;
  }

  const missing = requiredMissing.map((e) => ({ key: e.key, label: e.label, why: e.evidence }));
  const explanations = {
    [STATUS.VERIFIED_AGAINST_REFERENCE]: 'The medicine name, manufacturer, batch and expiry date read from your photos agree with MediTrust’s reference records, and nothing looked unusual. This is not a guarantee that the medicine is genuine.',
    [STATUS.NEEDS_REVIEW]: missing.length && !flags.length
      ? 'No conflicts were found, but some required details could not be checked, so MediTrust cannot confirm this medicine. This does not mean it is fake.'
      : 'Some checks need a human look. This does not mean the medicine is fake — please review the points below.',
    [STATUS.MISMATCH_DETECTED]: 'Something printed on the package disagrees with MediTrust’s reference records. The exact differences are listed below. A misread photo can also cause this, so retake the photo and check with a pharmacist.',
    [STATUS.EXPIRED]: 'The expiry date read from the package has passed. Do not use this medicine.',
    [STATUS.REFERENCE_NOT_FOUND]: 'MediTrust has no reference record for this medicine or batch, so it cannot be compared. This does not mean it is fake.',
    [STATUS.NOT_DETECTED]: 'No usable medicine information could be read from the photos. Try clearer, well-lit photos of the front, the batch/expiry label and the QR code.',
  };
  const steps = {
    [STATUS.VERIFIED_AGAINST_REFERENCE]: ['Still check that the seal is intact and the pack looks normal.', 'Buy from a licensed pharmacy.'],
    [STATUS.NEEDS_REVIEW]: ['Retake photos of the batch and expiry label, flat and in good light.', 'Confirm the details by eye on the pack.', 'Ask a pharmacist or the manufacturer if anything is unclear.'],
    [STATUS.MISMATCH_DETECTED]: ['Retake the photo to rule out a misread.', 'Do not use the medicine until a pharmacist or the manufacturer confirms it.', 'Use “Report a suspicious medicine” if you still have concerns.'],
    [STATUS.EXPIRED]: ['Do not use it.', 'Return it to a pharmacy for safe disposal.'],
    [STATUS.REFERENCE_NOT_FOUND]: ['Ask a pharmacist or the manufacturer to confirm this product.'],
    [STATUS.NOT_DETECTED]: ['Retake the photos in good light, close enough to read the text.'],
  };

  return {
    engineVersion: ENGINE_VERSION,
    status,
    score, // evidence-agreement score 0-100, or null when withheld. NOT a probability of counterfeiting.
    scoreWithheldReason,
    confidence: score, // legacy alias
    completeness: requiredMissing.length ? 'INCOMPLETE' : 'COMPLETE',
    checks,
    evidence: checks, // legacy alias used by older clients
    reasons, missing,
    explanation: explanations[status] || '',
    nextSteps: steps[status] || [],
    limitations: LIMITATIONS,
    weights: W,
  };
}

/** Risk level derived from the score; 'unknown' when the score is withheld. */
export function riskLevelFromScore(score, { lowRiskMin = 80, mediumRiskMin = 50 } = {}) {
  if (score === null || score === undefined) return 'unknown';
  return score >= lowRiskMin ? 'low' : score >= mediumRiskMin ? 'medium' : 'high';
}

/** Kept for v1 callers: the engine itself now decides the public status. */
export function toPublicStatus(assessment) {
  return assessment.status;
}

/** @deprecated v1 helper, kept for compatibility. The controller now uses assessment.reasons. */
export function buildDetectedIssues({ qr, batch, packaging, ocrConsistent, duplicate, medicineConsistency = 'NOT_APPLICABLE' }) {
  const issues = [];
  if (qr.status === 'QR_NOT_DETECTED') issues.push('QR not detected; this is not negative evidence.');
  else if (qr.status === 'QR_UNTRUSTED') issues.push('Decoded QR did not match any trusted batch or manufacturer record.');
  if (medicineConsistency === 'INCONSISTENT') issues.push('Trusted batch reference belongs to a different medicine than the one identified from this label.');
  else if (batch.matchType === 'NONE') issues.push('Trusted batch reference not found.');
  if (packaging.status === 'PACKAGING_NOT_AVAILABLE') issues.push('Packaging reference unavailable.');
  if (!ocrConsistent) issues.push('Some OCR text was low-confidence; extracted fields were retained only when label-aware parsing found them.');
  if (duplicate.detected) issues.push(duplicate.reason);
  return issues;
}
