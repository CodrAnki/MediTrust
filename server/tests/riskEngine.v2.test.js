import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assessVerification, STATUS, SIGNAL_WEIGHTS, LIMITATIONS } from '../services/riskEngine.js';

// ---- fixtures -------------------------------------------------------------------------------
const MATCHED = { status: 'MATCH', medicine: { _id: 'm1', medicineName: 'ZOXFER-XT PLUS', manufacturer: 'Zoxvina Biotech Pvt. Ltd.' }, identityConfidence: 0.98, manufacturerConfidence: 0.97 };
const NO_REF = { status: 'REFERENCE_NOT_FOUND', medicine: null, identityConfidence: 0, manufacturerConfidence: 0 };
const BATCH_OK = { verified: true, matchType: 'EXACT', matchedBatchNumber: 'GT28624F', medicineId: 'm1', status: 'ACTIVE', referenceManufacturingDate: '10/2025', referenceExpiryDate: '03/2027' };
const BATCH_NONE = { verified: false, matchType: 'NONE', matchedBatchNumber: null, medicineId: null, status: null };
const OCR = { medicineName: 'ZOXFER-XT PLUS', manufacturer: 'Zoxvina Biotech Pvt. Ltd.', batchNumber: 'GT28624F', expiryDate: '03/2027', manufacturingDate: '10/2025', consistent: true };
const base = {
  medicineMatch: MATCHED, batch: BATCH_OK, qr: { status: 'QR_NOT_DETECTED' }, packaging: { similarity: null, status: 'PACKAGING_NOT_AVAILABLE' },
  expiry: { status: 'VALID', expired: false }, manufacturingDate: '10/2025', duplicate: { detected: false }, ocr: OCR, medicineConsistency: 'CONSISTENT',
};
const run = (over = {}) => assessVerification({ ...base, ...over, ocr: { ...OCR, ...(over.ocr || {}) } });
const check = (a, key) => a.checks.find((c) => c.key === key);

describe('VERIFIED_AGAINST_REFERENCE (R3)', () => {
  test('all required checks match a trusted reference, with no QR or packaging at all', () => {
    const a = run();
    assert.equal(a.status, STATUS.VERIFIED_AGAINST_REFERENCE);
    assert.equal(a.completeness, 'COMPLETE');
    assert.ok(a.score >= 85);
    assert.equal(a.missing.length, 0);
  });
  test('always carries the limitation that this is not a guarantee', () => {
    assert.ok(run().limitations.some((l) => /cannot guarantee/i.test(l)));
    assert.equal(LIMITATIONS.length >= 3, true);
    assert.match(run().explanation, /not a guarantee/i);
  });
  test('a decoded QR + similar packaging do NOT verify anything when batch/expiry are unreadable', () => {
    const a = run({
      batch: BATCH_NONE, expiry: { status: 'NOT_FOUND', expired: false }, manufacturingDate: null,
      ocr: { batchNumber: null, expiryDate: null, manufacturingDate: null, fieldStatus: { batchNumber: 'UNREADABLE', expiryDate: 'UNREADABLE' } },
      qr: { status: 'MANUFACTURER_QR_TRUSTED', code: 'https://zoxvinabiotech.com/' }, packaging: { similarity: 95, status: 'PACKAGING_MATCH' },
    });
    // Regression for audit defect O1: this used to be HIGH_CONFIDENCE.
    assert.equal(a.status, STATUS.NEEDS_REVIEW);
    assert.equal(a.score, null);
    assert.match(a.scoreWithheldReason, /batch/);
    assert.deepEqual(a.missing.map((m) => m.key).sort(), ['batch', 'expiry']);
    assert.match(a.missing.find((m) => m.key === 'batch').why, /could not be read/, 'explains UNREADABLE vs absent');
  });
  test('a batch QR alone never verifies', () => {
    const a = run({ batch: BATCH_NONE, medicineMatch: NO_REF, expiry: { status: 'NOT_FOUND' }, ocr: { medicineName: null, manufacturer: null, batchNumber: null, expiryDate: null }, qr: { status: 'BATCH_QR_VERIFIED', code: 'X', batch: { batchNumber: 'GT28624F' } } });
    assert.notEqual(a.status, STATUS.VERIFIED_AGAINST_REFERENCE);
  });
  test('low OCR confidence blocks VERIFIED', () => {
    assert.equal(run({ ocr: { consistent: false } }).status, STATUS.NEEDS_REVIEW);
  });
  test('the configurable minimum score is enforced', () => {
    assert.equal(run({ verifiedMin: 101 }).status, STATUS.NEEDS_REVIEW);
  });
  test('a fuzzy (OCR-confusion) batch match needs confirmation', () => {
    const a = run({ batch: { ...BATCH_OK, matchType: 'FUZZY' } });
    assert.equal(a.status, STATUS.NEEDS_REVIEW);
    assert.match(check(a, 'batch').evidence, /confirm it by eye/);
  });
  test('a recalled/suspended batch is never verified', () => {
    assert.equal(run({ batch: { ...BATCH_OK, status: 'RECALLED' } }).status, STATUS.NEEDS_REVIEW);
  });
});

describe('missing evidence is not a mismatch (R1)', () => {
  for (const [name, over, key] of [
    ['batch not read', { batch: BATCH_NONE, ocr: { batchNumber: null } }, 'batch'],
    ['expiry not read', { expiry: { status: 'NOT_FOUND' }, ocr: { expiryDate: null } }, 'expiry'],
    ['expiry unreadable', { expiry: { status: 'UNREADABLE' } }, 'expiry'],
    ['manufacturer not read', { ocr: { manufacturer: null } }, 'manufacturer'],
  ]) {
    test(`${name} -> NEEDS_REVIEW with no MISMATCH check`, () => {
      const a = run(over);
      assert.equal(a.status, STATUS.NEEDS_REVIEW);
      assert.equal(a.checks.some((c) => c.status === 'MISMATCH'), false);
      assert.equal(check(a, key).available, false);
    });
  }
  test('batch read but not in the reference: UNKNOWN, not fake', () => {
    const a = run({ batch: BATCH_NONE });
    assert.equal(check(a, 'batch').status, 'UNKNOWN');
    assert.equal(a.status, STATUS.NEEDS_REVIEW);
    assert.match(check(a, 'batch').evidence, /does not mean it is fake/i);
  });
  test('no reference for the medicine or batch -> REFERENCE_NOT_FOUND, score withheld', () => {
    const a = run({ medicineMatch: NO_REF, batch: BATCH_NONE, medicineConsistency: 'NOT_APPLICABLE' });
    assert.equal(a.status, STATUS.REFERENCE_NOT_FOUND);
    assert.equal(a.score, null);
    assert.equal(a.checks.some((c) => c.status === 'MISMATCH'), false);
  });
  test('nothing readable at all -> NOT_DETECTED', () => {
    const a = run({ medicineMatch: NO_REF, batch: BATCH_NONE, expiry: { status: 'NOT_FOUND' }, ocr: { medicineName: null, manufacturer: null, batchNumber: null, expiryDate: null, manufacturingDate: null } });
    assert.equal(a.status, STATUS.NOT_DETECTED);
  });
  test('missing optional evidence (QR, packaging, repeats) does not change the score', () => {
    const plain = run();
    const withClear = run({ duplicate: { detected: false } });
    assert.equal(plain.score, withClear.score);
    assert.equal(check(plain, 'qr').available, false);
    assert.equal(check(plain, 'packaging').available, false);
  });
});

describe('real conflicts (R2)', () => {
  test('identity mismatch against a plausible reference candidate', () => {
    const a = run({ medicineMatch: { ...MATCHED, identityConfidence: 0.7 } });
    assert.equal(a.status, STATUS.MISMATCH_DETECTED);
    assert.equal(check(a, 'medicineIdentity').status, 'MISMATCH');
  });
  test('manufacturer mismatch names what differs, side by side', () => {
    const a = run({ medicineMatch: { ...MATCHED, manufacturerConfidence: 0.3 }, ocr: { manufacturer: 'Acme Labs' } });
    assert.equal(a.status, STATUS.MISMATCH_DETECTED);
    const c = check(a, 'manufacturer');
    assert.equal(c.scanned, 'Acme Labs');
    assert.equal(c.reference, 'Zoxvina Biotech Pvt. Ltd.');
  });
  test('batch belonging to a different medicine', () => {
    const a = run({ medicineConsistency: 'INCONSISTENT' });
    assert.equal(a.status, STATUS.MISMATCH_DETECTED);
    assert.match(a.reasons.find((r) => r.code === 'BATCH_MISMATCH').message, /different medicine/);
  });
  test('printed expiry differs from the registered batch expiry', () => {
    const a = run({ ocr: { expiryDate: '03/2029' } });
    assert.equal(a.status, STATUS.MISMATCH_DETECTED);
    assert.match(check(a, 'expiry').evidence, /differs from the registered expiry/);
    assert.equal(check(a, 'expiry').reference, '03/2027');
  });
  test('printed manufacturing date differs from the registered one', () => {
    const a = run({ manufacturingDate: '01/2024' });
    assert.equal(a.status, STATUS.MISMATCH_DETECTED);
    assert.equal(check(a, 'manufacturingDate').status, 'MISMATCH');
  });
  test('a registered batch QR that belongs to a DIFFERENT batch than printed is a conflict', () => {
    const a = run({ qr: { status: 'BATCH_QR_VERIFIED', code: 'Q', batch: { batchNumber: 'ZZ99999' } } });
    assert.equal(a.status, STATUS.MISMATCH_DETECTED);
    assert.match(check(a, 'qr').evidence, /ZZ99999/);
  });
});

describe('weaker signals can only ask for review (R5)', () => {
  test('unknown QR -> NEEDS_REVIEW, and says it is not proof of a problem', () => {
    const a = run({ qr: { status: 'QR_UNTRUSTED', code: 'https://x.example' } });
    assert.equal(a.status, STATUS.NEEDS_REVIEW);
    assert.match(check(a, 'qr').evidence, /not proof of a problem/);
  });
  test('dissimilar packaging alone -> NEEDS_REVIEW, never MISMATCH_DETECTED', () => {
    const a = run({ packaging: { similarity: 20, status: 'PACKAGING_MISMATCH' } });
    assert.equal(a.status, STATUS.NEEDS_REVIEW);
  });
  test('repeated scans alone -> NEEDS_REVIEW and never calls it counterfeit', () => {
    const a = run({ duplicate: { detected: true, reason: 'Scanned 4 times in 10 minutes.' } });
    assert.equal(a.status, STATUS.NEEDS_REVIEW);
    assert.match(check(a, 'duplicate').evidence, /does not mean a medicine is counterfeit/);
    assert.doesNotMatch(JSON.stringify(a.explanation), /counterfeit/i);
  });
  test('an impossible manufacturing date is flagged for review, not trusted', () => {
    assert.equal(run({ manufacturingDate: null, ocr: { manufacturingDate: null, fieldStatus: { manufacturingDate: 'INVALID' } } }).status, STATUS.NEEDS_REVIEW);
  });
});

describe('expired (R4)', () => {
  test('EXPIRED wins even when everything else matches, and tells the user not to use it', () => {
    const a = run({ expiry: { status: 'EXPIRED', expired: true } });
    assert.equal(a.status, STATUS.EXPIRED);
    assert.match(a.explanation, /Do not use/);
    assert.ok(a.nextSteps.some((s) => /Do not use/.test(s)));
    assert.notEqual(a.status, STATUS.VERIFIED_AGAINST_REFERENCE);
  });
  test('an expired pack that also conflicts keeps both findings visible', () => {
    const a = run({ expiry: { status: 'EXPIRED', expired: true }, medicineConsistency: 'INCONSISTENT' });
    assert.equal(a.status, STATUS.EXPIRED);
    assert.ok(a.reasons.some((r) => r.code === 'EXPIRED'));
    assert.ok(a.reasons.some((r) => r.code === 'BATCH_MISMATCH'));
  });
});

describe('score (R6, R7) and configuration', () => {
  test('the same underlying batch problem is counted once even if the QR also disagrees', () => {
    const batchOnly = run({ medicineConsistency: 'INCONSISTENT' });
    const batchAndQr = run({ medicineConsistency: 'INCONSISTENT', qr: { status: 'BATCH_QR_VERIFIED', code: 'Q', batch: { batchNumber: 'ZZ99999' } } });
    assert.equal(batchAndQr.score, batchOnly.score);
  });
  test('weights are configurable and change the score', () => {
    const noisy = { packaging: { similarity: 10, status: 'PACKAGING_MISMATCH' } };
    const defaultScore = run(noisy).score;
    const ignoringPackaging = run({ ...noisy, weights: { packaging: 0 } }).score;
    assert.ok(ignoringPackaging > defaultScore);
  });
  test('default weights are exposed and sum to a sane total', () => {
    const total = Object.values(SIGNAL_WEIGHTS).reduce((x, y) => x + y, 0);
    assert.ok(total > 0.9 && total < 1.1);
    assert.deepEqual(run().weights, { ...SIGNAL_WEIGHTS });
  });
  test('the score is never a probability: the field says so', () => {
    assert.equal('probability' in run(), false);
  });
});

describe('invariants over every combination of outcomes', () => {
  const dims = {
    identity: [MATCHED, { ...MATCHED, identityConfidence: 0.7 }, NO_REF],
    batch: [BATCH_OK, { ...BATCH_OK, status: 'RECALLED' }, BATCH_NONE],
    batchText: [OCR.batchNumber, null],
    expiry: [{ status: 'VALID' }, { status: 'EXPIRED' }, { status: 'UNREADABLE' }, { status: 'NOT_FOUND' }],
    qr: [{ status: 'QR_NOT_DETECTED' }, { status: 'QR_UNTRUSTED', code: 'u' }, { status: 'MANUFACTURER_QR_TRUSTED', code: 'm' }, { status: 'BATCH_QR_VERIFIED', code: 'b', batch: { batchNumber: 'GT28624F' } }],
    packaging: [{ similarity: null, status: 'PACKAGING_NOT_AVAILABLE' }, { similarity: 90, status: 'PACKAGING_MATCH' }, { similarity: 20, status: 'PACKAGING_MISMATCH' }],
    duplicate: [{ detected: false }, { detected: true, reason: 'r' }],
    ocrOk: [true, false],
  };
  const combos = [];
  for (const identity of dims.identity) for (const batch of dims.batch) for (const batchText of dims.batchText) for (const expiry of dims.expiry)
    for (const qr of dims.qr) for (const packaging of dims.packaging) for (const duplicate of dims.duplicate) for (const ocrOk of dims.ocrOk) combos.push({ identity, batch, batchText, expiry, qr, packaging, duplicate, ocrOk });

  test(`${combos.length} combinations all satisfy the safety invariants`, () => {
    for (const c of combos) {
      const a = assessVerification({
        medicineMatch: c.identity, batch: c.batch, qr: c.qr, packaging: c.packaging, expiry: c.expiry, duplicate: c.duplicate,
        manufacturingDate: '10/2025', medicineConsistency: c.identity.medicine && c.batch.medicineId ? 'CONSISTENT' : 'NOT_APPLICABLE',
        ocr: { ...OCR, batchNumber: c.batchText, expiryDate: c.expiry.status === 'NOT_FOUND' ? null : '03/2027', consistent: c.ocrOk },
      });
      const label = JSON.stringify({ s: a.status, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v?.status ?? v?.detected ?? v?.identityConfidence ?? v])) });
      assert.ok(Object.values(STATUS).includes(a.status), `unknown status ${label}`);
      if (a.status === STATUS.VERIFIED_AGAINST_REFERENCE) {
        for (const req of a.checks.filter((x) => x.required)) assert.ok(req.available && ['MATCH', 'VALID'].includes(req.status) || req.status === 'NOT_AVAILABLE', `verified with weak required check ${req.key}: ${label}`);
        assert.equal(a.checks.some((x) => x.effect === 'FLAGS' || x.status === 'MISMATCH'), false, label);
        assert.ok(a.score !== null && a.score >= 85, label);
        assert.equal(c.expiry.status, 'VALID', label);
      }
      if (c.expiry.status === 'EXPIRED') assert.equal(a.status, STATUS.EXPIRED, label); // never "safe"
      if (a.status === STATUS.MISMATCH_DETECTED) assert.ok(a.checks.some((x) => x.status === 'MISMATCH'), label);
      // Missing / unknown evidence alone must never be reported as a mismatch.
      if (!a.checks.some((x) => x.status === 'MISMATCH') && a.status !== STATUS.EXPIRED) assert.notEqual(a.status, STATUS.MISMATCH_DETECTED, label);
      // Weak signals alone can never produce a mismatch.
      const weakOnly = !a.checks.some((x) => x.status === 'MISMATCH' && !['packaging', 'duplicate'].includes(x.key));
      if (weakOnly && a.status !== STATUS.EXPIRED) assert.notEqual(a.status, STATUS.MISMATCH_DETECTED, label);
      // The score is withheld whenever an essential input is unavailable.
      if (['medicineIdentity', 'batch', 'expiry'].some((k) => !a.checks.find((x) => x.key === k).available)) assert.equal(a.score, null, label);
      assert.ok(a.limitations.length > 0 && a.explanation !== undefined);
    }
  });
});
