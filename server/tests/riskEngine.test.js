import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assessVerification, buildDetectedIssues } from '../services/riskEngine.js';

const GENUINE_MEDICINE_MATCH = { status: 'MATCH', medicine: { _id: 'med-1' }, identityConfidence: 0.98, manufacturerConfidence: 0.97 };
const GENUINE_OCR = { medicineName: 'ZOXFER-XT PLUS', manufacturer: 'Zoxvina Biotech Pvt. Ltd.', batchNumber: 'GT28624F' };
const ACTIVE_BATCH = { verified: true, matchType: 'EXACT', matchedBatchNumber: 'GT28624F', medicineId: 'med-1', qrCode: null, status: 'ACTIVE' };
const VALID_EXPIRY = { status: 'VALID', expired: false };
const GOOD_PACKAGING = { similarity: 91.4, status: 'PACKAGING_MATCH' };
const NO_DUPLICATE = { detected: false, reason: null };

describe('riskEngine: genuine saved medicine end-to-end (item 8)', () => {
  test('genuine medicine + correct OCR + active batch + manufacturer-trusted QR + matching packaging scores high with NO false issues', () => {
    const qr = { status: 'MANUFACTURER_QR_TRUSTED', verified: true, code: 'https://zoxvinabiotech.com/' };
    const assessment = assessVerification({
      medicineMatch: GENUINE_MEDICINE_MATCH, batch: ACTIVE_BATCH, qr, packaging: GOOD_PACKAGING,
      expiry: VALID_EXPIRY, manufacturingDate: '12/2025', duplicate: NO_DUPLICATE, ocr: GENUINE_OCR,
      medicineConsistency: 'CONSISTENT',
    });
    assert.ok(assessment.confidence >= 85, `expected high confidence, got ${assessment.confidence}`);
    assert.equal(assessment.status, 'VERIFIED_AGAINST_REFERENCE');

    const issues = buildDetectedIssues({
      qr, batch: ACTIVE_BATCH, packaging: GOOD_PACKAGING, ocrConsistent: true, duplicate: NO_DUPLICATE,
      medicineConsistency: 'CONSISTENT',
    });
    assert.deepEqual(issues, [], `expected no false issues, got: ${JSON.stringify(issues)}`);
  });

  test('a genuine per-batch QR match scores at least as high as a manufacturer-level one', () => {
    const batchQr = { status: 'BATCH_QR_VERIFIED', verified: true, code: 'REAL-BATCH-QR' };
    const manufacturerQr = { status: 'MANUFACTURER_QR_TRUSTED', verified: true, code: 'https://zoxvinabiotech.com/' };
    const base = {
      medicineMatch: GENUINE_MEDICINE_MATCH, batch: ACTIVE_BATCH, packaging: GOOD_PACKAGING,
      expiry: VALID_EXPIRY, manufacturingDate: '12/2025', duplicate: NO_DUPLICATE, ocr: GENUINE_OCR,
      medicineConsistency: 'CONSISTENT',
    };
    const withBatchQr = assessVerification({ ...base, qr: batchQr }).confidence;
    const withManufacturerQr = assessVerification({ ...base, qr: manufacturerQr }).confidence;
    assert.ok(withBatchQr >= withManufacturerQr);
  });
});

describe('riskEngine: real failures are still caught (item 7)', () => {
  test('QR_UNTRUSTED is a real issue', () => {
    const qr = { status: 'QR_UNTRUSTED', verified: false, code: 'https://fake-counterfeit-site.example/' };
    const issues = buildDetectedIssues({
      qr, batch: ACTIVE_BATCH, packaging: GOOD_PACKAGING, ocrConsistent: true, duplicate: NO_DUPLICATE,
      medicineConsistency: 'CONSISTENT',
    });
    assert.ok(issues.some((issue) => issue.toLowerCase().includes('did not match')));
  });

  test('QR_NOT_DETECTED is flagged as informational, not negative evidence, and excluded from the score denominator', () => {
    const qr = { status: 'QR_NOT_DETECTED', verified: false, code: null };
    const assessment = assessVerification({
      medicineMatch: GENUINE_MEDICINE_MATCH, batch: ACTIVE_BATCH, qr, packaging: GOOD_PACKAGING,
      expiry: VALID_EXPIRY, manufacturingDate: '12/2025', duplicate: NO_DUPLICATE, ocr: GENUINE_OCR,
      medicineConsistency: 'CONSISTENT',
    });
    assert.ok(assessment.confidence >= 85, `missing QR should not tank the score, got ${assessment.confidence}`);
    const qrEvidence = assessment.evidence.find((e) => e.key === 'qr');
    assert.equal(qrEvidence.available, false);
  });

  test('batch/medicine INCONSISTENT is a real, reported failure (item 3 + item 7)', () => {
    const qr = { status: 'MANUFACTURER_QR_TRUSTED', verified: true, code: 'https://zoxvinabiotech.com/' };
    const assessment = assessVerification({
      medicineMatch: GENUINE_MEDICINE_MATCH, batch: ACTIVE_BATCH, qr, packaging: GOOD_PACKAGING,
      expiry: VALID_EXPIRY, manufacturingDate: '12/2025', duplicate: NO_DUPLICATE, ocr: GENUINE_OCR,
      medicineConsistency: 'INCONSISTENT',
    });
    assert.equal(assessment.status, 'MISMATCH_DETECTED'); // batch belongs to a different medicine: a real conflict
    const issues = buildDetectedIssues({
      qr, batch: ACTIVE_BATCH, packaging: GOOD_PACKAGING, ocrConsistent: true, duplicate: NO_DUPLICATE,
      medicineConsistency: 'INCONSISTENT',
    });
    assert.ok(issues.some((issue) => issue.includes('different medicine')));
  });

  test('an actually expired medicine is still reported EXPIRED regardless of other good signals', () => {
    const qr = { status: 'MANUFACTURER_QR_TRUSTED', verified: true, code: 'https://zoxvinabiotech.com/' };
    const assessment = assessVerification({
      medicineMatch: GENUINE_MEDICINE_MATCH, batch: ACTIVE_BATCH, qr, packaging: GOOD_PACKAGING,
      expiry: { status: 'EXPIRED', expired: true }, manufacturingDate: '12/2020', duplicate: NO_DUPLICATE,
      ocr: GENUINE_OCR, medicineConsistency: 'CONSISTENT',
    });
    assert.equal(assessment.status, 'EXPIRED');
  });
});
