import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS, normalizeStatus, riskLevelFromScore, assessVerification } from '../services/riskEngine.js';

describe('status contract', () => {
  test('exposes exactly the documented public statuses', () => {
    assert.deepEqual(Object.values(STATUS).sort(), [
      'EXPIRED', 'INVALID_INPUT', 'MISMATCH_DETECTED', 'NEEDS_REVIEW', 'NOT_AVAILABLE', 'NOT_DETECTED',
      'PROCESSING_FAILED', 'REFERENCE_NOT_FOUND', 'VERIFIED_AGAINST_REFERENCE',
    ]);
  });
  test('legacy stored statuses map onto the contract; HIGH_CONFIDENCE is no longer a pass', () => {
    assert.equal(normalizeStatus('VERIFIED'), 'VERIFIED_AGAINST_REFERENCE');
    assert.equal(normalizeStatus('HIGH_CONFIDENCE'), 'NEEDS_REVIEW');
    assert.equal(normalizeStatus('HIGH_RISK'), 'MISMATCH_DETECTED');
    assert.equal(normalizeStatus('EXPIRED'), 'EXPIRED');
    assert.equal(normalizeStatus('SOMETHING_NEW'), 'SOMETHING_NEW');
  });
});

describe('riskLevelFromScore', () => {
  test('thresholds are configurable', () => {
    assert.equal(riskLevelFromScore(75), 'medium');
    assert.equal(riskLevelFromScore(75, { lowRiskMin: 70 }), 'low');
  });
  test('a withheld score has an unknown level, never a made-up one', () => {
    assert.equal(riskLevelFromScore(null), 'unknown');
    assert.equal(riskLevelFromScore(undefined), 'unknown');
  });
});

describe('riskEngine extensions', () => {
  test('a reference with no manufacturer is NOT_AVAILABLE, not a mismatch', () => {
    const a = assessVerification({
      medicineMatch: { status: 'MATCH', medicine: { _id: '1' }, identityConfidence: 1, manufacturerConfidence: null },
      batch: { verified: true, matchType: 'EXACT', matchedBatchNumber: 'B1', status: 'ACTIVE' },
      qr: { status: 'QR_NOT_DETECTED' }, packaging: { similarity: null, status: 'PACKAGING_NOT_AVAILABLE' },
      expiry: { status: 'VALID', expired: false }, duplicate: { detected: false }, ocr: { medicineName: 'X', batchNumber: 'B1', consistent: true },
    });
    const m = a.checks.find((e) => e.key === 'manufacturer');
    assert.equal(m.status, 'NOT_AVAILABLE');
    assert.equal(m.available, false);
  });
});
