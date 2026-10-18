import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateExpiry } from '../utils/expiry.js';

describe('validateExpiry (item 6)', () => {
  for (const date of ['03/2027', '11/2027', '02/2028', '07/2027']) {
    test(`clearly-extracted future date ${date} validates as VALID, no false expiry issue`, () => {
      const result = validateExpiry(date);
      assert.equal(result.status, 'VALID');
      assert.equal(result.expired, false);
    });
  }

  test('a genuinely past date is reported EXPIRED', () => {
    const result = validateExpiry('01/2020');
    assert.equal(result.status, 'EXPIRED');
    assert.equal(result.expired, true);
  });

  test('malformed/impossible date (month > 12) is UNREADABLE, not silently accepted or invented', () => {
    const result = validateExpiry('13/2027');
    assert.equal(result.status, 'UNREADABLE');
  });

  test('no expiry text extracted at all -> NOT_FOUND, distinct from UNREADABLE', () => {
    const result = validateExpiry(null);
    assert.equal(result.status, 'NOT_FOUND');
  });

  test('named-month format is also accepted', () => {
    const result = validateExpiry('NOV 2027');
    assert.equal(result.status, 'VALID');
  });

  test('a bare year is UNREADABLE — it must not be read as January and wrongly reported EXPIRED', () => {
    assert.equal(validateExpiry('2027', new Date('2027-06-01')).status, 'UNREADABLE');
  });

  test('named month with a dash (the format printed on real cartons) is parsed', () => {
    assert.equal(validateExpiry('MAR-2027', new Date('2026-10-16')).status, 'VALID');
    assert.equal(validateExpiry('MAR-2027', new Date('2027-04-01')).status, 'EXPIRED');
  });

  test('a product is usable through the last day of the printed month', () => {
    assert.equal(validateExpiry('03/2027', new Date('2027-03-31T12:00:00')).status, 'VALID');
    assert.equal(validateExpiry('03/2027', new Date('2027-04-01T00:00:01')).status, 'EXPIRED');
  });
});
