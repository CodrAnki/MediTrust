import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyQrCode, classifyQrCodes, normalizeQrPayload, QR_STATUS } from '../services/qrService.js';

const SHARED_MANUFACTURER_QR = 'https://zoxvinabiotech.com/';

// In-memory fakes standing in for the real Batch / ManufacturerQr
// collections, so this decision logic is testable without a live MongoDB.
function fakeLookups({ batches = [], manufacturerQrs = [] } = {}) {
  return {
    findBatchByQr: async (code) => batches.find((b) => b.qrCode === code) || null,
    findManufacturerQr: async (code) => manufacturerQrs.find((m) => m.payload === code && m.active !== false) || null,
  };
}

describe('qrService.classifyQrCode', () => {
  test('no code decoded -> QR_NOT_DETECTED, not negative evidence', async () => {
    const result = await classifyQrCode(null, fakeLookups());
    assert.equal(result.status, QR_STATUS.QR_NOT_DETECTED);
    assert.equal(result.verified, false);
  });

  test('code matches a real batch-specific qrCode -> BATCH_QR_VERIFIED', async () => {
    const deps = fakeLookups({ batches: [{ qrCode: 'BATCH-QR-XYZ', status: 'ACTIVE' }] });
    const result = await classifyQrCode('BATCH-QR-XYZ', deps);
    assert.equal(result.status, QR_STATUS.BATCH_QR_VERIFIED);
    assert.equal(result.verified, true);
  });

  test('batch-specific match but batch is not ACTIVE -> BATCH_QR_VERIFIED, not verified', async () => {
    const deps = fakeLookups({ batches: [{ qrCode: 'BATCH-QR-XYZ', status: 'RECALLED' }] });
    const result = await classifyQrCode('BATCH-QR-XYZ', deps);
    assert.equal(result.status, QR_STATUS.BATCH_QR_VERIFIED);
    assert.equal(result.verified, false);
  });

  test('code matches a known manufacturer QR (not any batch) -> MANUFACTURER_QR_TRUSTED, verified', async () => {
    const deps = fakeLookups({
      manufacturerQrs: [{ payload: SHARED_MANUFACTURER_QR, manufacturer: 'Zoxvina Biotech Pvt. Ltd.', active: true }],
    });
    const result = await classifyQrCode(SHARED_MANUFACTURER_QR, deps);
    assert.equal(result.status, QR_STATUS.MANUFACTURER_QR_TRUSTED);
    assert.equal(result.verified, true, 'a trusted manufacturer QR is real positive evidence, not a failure');
  });

  test('CORE REGRESSION: a genuine manufacturer QR must never be reported as a mismatch just because it is not this batch\'s own qrCode', async () => {
    const deps = fakeLookups({
      batches: [{ qrCode: 'SOME-OTHER-REAL-BATCH-QR', status: 'ACTIVE' }],
      manufacturerQrs: [{ payload: SHARED_MANUFACTURER_QR, manufacturer: 'Zoxvina Biotech Pvt. Ltd.', active: true }],
    });
    const result = await classifyQrCode(SHARED_MANUFACTURER_QR, deps);
    assert.notEqual(result.status, QR_STATUS.QR_UNTRUSTED);
    assert.equal(result.status, QR_STATUS.MANUFACTURER_QR_TRUSTED);
    assert.equal(result.verified, true);
  });

  test('decoded code matches neither a batch nor a manufacturer record -> QR_UNTRUSTED, a real failure', async () => {
    const deps = fakeLookups({
      manufacturerQrs: [{ payload: SHARED_MANUFACTURER_QR, manufacturer: 'Zoxvina Biotech Pvt. Ltd.', active: true }],
    });
    const result = await classifyQrCode('https://totally-unrelated-counterfeit.example/', deps);
    assert.equal(result.status, QR_STATUS.QR_UNTRUSTED);
    assert.equal(result.verified, false);
  });

  test('inactive manufacturer QR record is not trusted', async () => {
    const deps = fakeLookups({
      manufacturerQrs: [{ payload: SHARED_MANUFACTURER_QR, manufacturer: 'Zoxvina Biotech Pvt. Ltd.', active: false }],
    });
    const result = await classifyQrCode(SHARED_MANUFACTURER_QR, deps);
    assert.equal(result.status, QR_STATUS.QR_UNTRUSTED);
  });
});

describe('qrService.classifyQrCodes (multi-image submissions)', () => {
  test('REGRESSION: the same shared manufacturer QR used across MULTIPLE different medicines/products never creates a false mismatch, for any of them', async () => {
    const deps = fakeLookups({
      manufacturerQrs: [{ payload: SHARED_MANUFACTURER_QR, manufacturer: 'Zoxvina Biotech Pvt. Ltd.', active: true }],
    });

    const productsSharingTheQr = ['Zoxvitaz-L', 'Palzit-DSR', 'ZOXFER-XT PLUS', 'Zovifast-AQ'];
    for (const product of productsSharingTheQr) {
      const result = await classifyQrCode(SHARED_MANUFACTURER_QR, deps);
      assert.equal(
        result.status,
        QR_STATUS.MANUFACTURER_QR_TRUSTED,
        `${product}: shared manufacturer QR must classify as trusted, not a mismatch`
      );
      assert.equal(result.verified, true, `${product}: shared manufacturer QR is real positive evidence`);
    }
  });

  test('no codes decoded across any image -> QR_NOT_DETECTED', async () => {
    const result = await classifyQrCodes([], fakeLookups());
    assert.equal(result.status, QR_STATUS.QR_NOT_DETECTED);
  });

  test('a batch-specific match in one photo wins over an untrusted code decoded in another photo of the same submission', async () => {
    const deps = fakeLookups({ batches: [{ qrCode: 'REAL-BATCH-QR', status: 'ACTIVE' }] });
    const result = await classifyQrCodes(['REAL-BATCH-QR', 'garbage-code-from-a-blurry-photo'], deps);
    assert.equal(result.status, QR_STATUS.BATCH_QR_VERIFIED);
    assert.equal(result.code, 'REAL-BATCH-QR');
  });

  test('duplicate codes across photos are de-duplicated, not double-classified', async () => {
    const deps = fakeLookups({
      manufacturerQrs: [{ payload: SHARED_MANUFACTURER_QR, manufacturer: 'Zoxvina Biotech Pvt. Ltd.', active: true }],
    });
    const result = await classifyQrCodes([SHARED_MANUFACTURER_QR, SHARED_MANUFACTURER_QR], deps);
    assert.equal(result.status, QR_STATUS.MANUFACTURER_QR_TRUSTED);
  });
});

describe('qrService.normalizeQrPayload', () => {
  test('trims whitespace but preserves case (URLs/tokens are case-sensitive)', () => {
    assert.equal(normalizeQrPayload('  https://Zoxvinabiotech.com/  '), 'https://Zoxvinabiotech.com/');
  });

  test('empty/null input normalizes to null', () => {
    assert.equal(normalizeQrPayload(''), null);
    assert.equal(normalizeQrPayload(null), null);
  });
});
