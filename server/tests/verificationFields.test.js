import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfirmedFields, parseConfirmedFields, VERIFICATION_FIELDS } from '../services/verificationFields.js';

describe('parseConfirmedFields', () => {
  test('keeps supported, trimmed values and allows a field to be cleared', () => {
    const fields = parseConfirmedFields(JSON.stringify({
      medicineName: '  Corrected medicine  ',
      batchNumber: '',
    }));
    assert.deepEqual(fields, { medicineName: 'Corrected medicine', batchNumber: null });
  });

  test('rejects malformed data, unknown keys, non-text, and overlong values', () => {
    for (const value of [
      '{invalid json',
      JSON.stringify({ unexpected: 'value' }),
      JSON.stringify({ manufacturer: 42 }),
      JSON.stringify({ strength: 'x'.repeat(161) }),
    ]) {
      assert.throws(() => parseConfirmedFields(value), { code: 'INVALID_CONFIRMED_FIELDS', status: 400 });
    }
  });

  test('leaves legacy verification requests without confirmed fields unchanged', () => {
    assert.equal(parseConfirmedFields(undefined), null);
    assert.equal(VERIFICATION_FIELDS.length, 7);
  });

  test('confirmed values replace OCR suggestions for the final verification inputs', () => {
    const result = mergeConfirmedFields(
      { medicineName: 'OCR suggestion', batchNumber: 'OCR batch' },
      { medicineName: 'Corrected medicine', batchNumber: null }
    );
    assert.deepEqual(result.fields, { medicineName: 'Corrected medicine', batchNumber: null });
    assert.deepEqual(result.fieldSources, { medicineName: 'USER_CONFIRMED', batchNumber: 'USER_CONFIRMED' });
  });
});
