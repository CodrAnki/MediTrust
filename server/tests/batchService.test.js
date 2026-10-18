import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBatchNumber,
  checkBatch,
  checkBatchMedicineConsistency,
  BATCH_MATCH_TYPE,
} from '../services/batchService.js';

// In-memory fake standing in for the real Batch collection, so
// checkBatch's exact/normalized/fuzzy matching logic — the actual fix
// under test for item 2 ("do not falsely report 'not found' when the OCR
// batch corresponds to an ACTIVE DB batch") — is testable without a live
// MongoDB.
function fakeBatchModel(records) {
  return {
    findOne: async (query) => {
      if (query.batchNumber && typeof query.batchNumber === 'string') {
        return records.find((r) => r.batchNumber === query.batchNumber) || null;
      }
      const pattern = new RegExp(query.batchNumber.$regex, query.batchNumber.$options);
      return records.find((r) => pattern.test(r.batchNumber)) || null;
    },
  };
}

describe('batchService.normalizeBatchNumber', () => {
  test('trims, uppercases, and strips separators without changing characters', () => {
    assert.equal(normalizeBatchNumber(' gt-286/24f '), 'GT28624F');
  });
  test('null/empty input normalizes to null', () => {
    assert.equal(normalizeBatchNumber(''), null);
    assert.equal(normalizeBatchNumber(null), null);
  });
});

describe('batchService.checkBatch', () => {
  const medicineId = 'medicine-1';

  test('exact match against an ACTIVE trusted batch is verified', async () => {
    const BatchModel = fakeBatchModel([{ batchNumber: 'GT28624F', status: 'ACTIVE', medicineId, qrCode: null }]);
    const result = await checkBatch('GT28624F', { BatchModel });
    assert.equal(result.verified, true);
    assert.equal(result.matchType, BATCH_MATCH_TYPE.EXACT);
    assert.equal(result.medicineId, medicineId);
  });

  test('genuine OCR case/punctuation noise still matches via normalization (item 2)', async () => {
    const BatchModel = fakeBatchModel([{ batchNumber: 'GT28624F', status: 'ACTIVE', medicineId, qrCode: null }]);
    const result = await checkBatch('gt-286/24f', { BatchModel });
    assert.equal(result.verified, true);
    assert.equal(result.matchType, BATCH_MATCH_TYPE.NORMALIZED);
  });

  test('a single OCR character-confusion (8 misread as B) still resolves to the real ACTIVE batch', async () => {
    const BatchModel = fakeBatchModel([{ batchNumber: 'GT28624F', status: 'ACTIVE', medicineId, qrCode: null }]);
    // OCR misread the '8' as 'B' — a real, common dot-matrix confusion.
    const result = await checkBatch('GT2B624F', { BatchModel });
    assert.equal(result.matchType, BATCH_MATCH_TYPE.FUZZY);
    assert.equal(result.verified, true);
    assert.equal(result.matchedBatchNumber, 'GT28624F');
  });

  test('a genuinely unrecognized batch number correctly reports NONE / not verified', async () => {
    const BatchModel = fakeBatchModel([{ batchNumber: 'GT28624F', status: 'ACTIVE', medicineId, qrCode: null }]);
    const result = await checkBatch('COMPLETELY-UNKNOWN-123', { BatchModel });
    assert.equal(result.verified, false);
    assert.equal(result.matchType, BATCH_MATCH_TYPE.NONE);
    assert.equal(result.medicineId, null);
  });

  test('a matched but non-ACTIVE batch is not verified, but still reports its matchType/medicineId', async () => {
    const BatchModel = fakeBatchModel([{ batchNumber: 'SZ-2618', status: 'RECALLED', medicineId, qrCode: null }]);
    const result = await checkBatch('SZ-2618', { BatchModel });
    assert.equal(result.verified, false);
    assert.equal(result.matchType, BATCH_MATCH_TYPE.EXACT);
    assert.equal(result.medicineId, medicineId);
  });

  test('no batch number extracted at all -> NONE, no DB call implied', async () => {
    const result = await checkBatch(null, { BatchModel: fakeBatchModel([]) });
    assert.equal(result.matchType, BATCH_MATCH_TYPE.NONE);
  });
});

describe('batchService.checkBatchMedicineConsistency (item 3)', () => {
  test('matched batch and matched medicine agree -> CONSISTENT', () => {
    const result = checkBatchMedicineConsistency({ medicineId: 'abc' }, { _id: 'abc' });
    assert.equal(result, 'CONSISTENT');
  });

  test('matched batch belongs to a DIFFERENT medicine than OCR/reference identified -> INCONSISTENT', () => {
    const result = checkBatchMedicineConsistency({ medicineId: 'abc' }, { _id: 'xyz' });
    assert.equal(result, 'INCONSISTENT');
  });

  test('no batch match or no medicine match -> NOT_APPLICABLE (never fabricated as a failure)', () => {
    assert.equal(checkBatchMedicineConsistency({ medicineId: null }, { _id: 'xyz' }), 'NOT_APPLICABLE');
    assert.equal(checkBatchMedicineConsistency({ medicineId: 'abc' }, null), 'NOT_APPLICABLE');
  });
});
