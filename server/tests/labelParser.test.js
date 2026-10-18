import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMonthYear, isPlausibleBatch, extractBatch, extractDates } from '../services/labelParser.js';

const NOW = new Date('2026-10-16T00:00:00Z');
const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const here = path.dirname(fileURLToPath(import.meta.url));

describe('parseMonthYear', () => {
  test('numeric and named formats normalise to YYYY-MM', () => {
    assert.equal(parseMonthYear('03/2027').normalized, '2027-03');
    assert.equal(parseMonthYear('3-27').normalized, '2027-03');
    assert.equal(parseMonthYear('MAR-2027').normalized, '2027-03');
    assert.equal(parseMonthYear('Sept 2026').normalized, '2026-09');
    assert.equal(parseMonthYear('October 2025').normalized, '2025-10');
  });
  test('impossible months are INVALID, not silently accepted', () => {
    assert.deepEqual({ valid: false, reason: 'MONTH_OUT_OF_RANGE' }, { valid: parseMonthYear('13/2027').valid, reason: parseMonthYear('13/2027').reason });
  });
  test('ordinary words and licence fragments are not dates', () => {
    assert.equal(parseMonthYear('Storage'), null);
    assert.equal(parseMonthYear('GT28624F'), null);
    assert.equal(parseMonthYear('15/906'), null);
  });
  test('a bare year is recognised as YEAR precision only', () => {
    assert.equal(parseMonthYear('2027').precision, 'YEAR');
  });
});

describe('isPlausibleBatch', () => {
  for (const ok of ['GT28624F', 'US-25361A', '25LC019F', 'UGA-2693B', 'SZ-2618']) {
    test(`accepts real-looking batch ${ok}`, () => assert.equal(isPlausibleBatch(ok), true));
  }
  for (const [bad, why] of [['MAR-2027', 'date'], ['03/2027', 'date'], ['2027', 'year'], ['MNB/15/906', 'licence number'], ['Storage', 'word without digits'], ['AB1', 'too short']]) {
    test(`rejects ${bad} (${why})`, () => assert.equal(isPlausibleBatch(bad), false));
  }
});

describe('extractBatch', () => {
  test('inline label: value', () => assert.deepEqual(
    (({ value, status }) => ({ value, status }))(extractBatch(lines('Batch No.: GT28624F'))), { value: 'GT28624F', status: 'DETECTED' }));
  test('stacked layout (label line, value on a following line)', () => assert.equal(extractBatch(lines('Batch No :\nGT28624F')).value, 'GT28624F'));
  test('a date next to the batch label is NEVER returned as the batch (regression)', () => {
    const result = extractBatch(lines('Batch No: 03/2027\nExp: 03/2027'));
    assert.equal(result.value, null);
    assert.equal(result.status, 'UNREADABLE');
    assert.ok(result.rejected.includes('03/2027'));
  });
  test('a licence number is not a batch number', () => {
    assert.equal(extractBatch(lines('Mfg. Lic. No.: MNB/15/906\nBatch No :\nOther text')).value, null);
  });
  test('NOT_DETECTED when no batch label exists; UNREADABLE when the label exists without a value', () => {
    assert.equal(extractBatch(lines('Take two tablets daily')).status, 'NOT_DETECTED');
    assert.equal(extractBatch(lines('Batch No :')).status, 'UNREADABLE');
  });
});

describe('extractDates', () => {
  test('clean inline MFG/EXP', () => {
    const d = extractDates(lines('Mfg. Date: 10/2025\nExp. Date: 03/2027'), { now: NOW });
    assert.equal(d.manufacturingDate, '10/2025');
    assert.equal(d.expiryDate, '03/2027');
    assert.deepEqual(d.status, { manufacturingDate: 'DETECTED', expiryDate: 'DETECTED' });
  });
  test('stacked layout is assigned by position when the counts match', () => {
    const d = extractDates(lines('Batch No :\nMfg. Date :\nExpiry Date :\nGT28624F\nOCT-2025\nMAR-2027'), { now: NOW });
    assert.equal(d.manufacturingDate, 'OCT-2025');
    assert.equal(d.expiryDate, 'MAR-2027');
  });
  test('stacked layout with fewer values than labels is NOT guessed — values become unassigned candidates', () => {
    const d = extractDates(lines('Mfg. Date :\nExpiry Date :\nMAR-2027'), { now: NOW });
    assert.equal(d.manufacturingDate, null);
    assert.equal(d.expiryDate, null);
    assert.deepEqual(d.status, { manufacturingDate: 'UNREADABLE', expiryDate: 'UNREADABLE' });
    assert.equal(d.unassignedDates.length, 1);
    assert.deepEqual(d.unassignedDates[0].plausibleAs, ['expiryDate'], 'a future date can only be an expiry, never a manufacturing date');
  });
  test('missing labels are NOT_DETECTED, distinct from UNREADABLE', () => {
    assert.deepEqual(extractDates(lines('Store in a cool place'), { now: NOW }).status, { manufacturingDate: 'NOT_DETECTED', expiryDate: 'NOT_DETECTED' });
  });
  test('an impossible month is INVALID, and the raw value is preserved for review', () => {
    const d = extractDates(lines('Mfg. Date: 15/2025\nExp. Date: 03/2027'), { now: NOW });
    assert.equal(d.status.manufacturingDate, 'INVALID');
    assert.equal(d.manufacturingDate, null);
    assert.equal(d.invalid.manufacturingDate, '15/2025');
  });
  test('a manufacturing date in the future is INVALID', () => {
    const d = extractDates(lines('Mfg. Date: 05/2028\nExp. Date: 05/2030'), { now: NOW });
    assert.equal(d.status.manufacturingDate, 'INVALID');
    assert.equal(d.expiryDate, '05/2030');
  });
  test('expiry before manufacture invalidates both rather than trusting either', () => {
    const d = extractDates(lines('Mfg. Date: 10/2025\nExp. Date: 03/2024'), { now: NOW });
    assert.deepEqual(d.status, { manufacturingDate: 'INVALID', expiryDate: 'INVALID' });
    assert.equal(d.expiryDate, null);
  });
  test('a year alone is not accepted as an expiry date', () => {
    const d = extractDates(lines('Exp: 2027'), { now: NOW });
    assert.equal(d.expiryDate, null);
    assert.equal(d.status.expiryDate, 'UNREADABLE');
  });
});

describe('real Tesseract output captured from tests/fixtures/zoxfer-xt-plus-box-with-qr.jpg', () => {
  // The batch and MFG values on this box are dot-matrix printed and not machine-readable.
  // The ONLY date Tesseract read is MAR-2027 (the EXPIRY). The old parser returned it as the
  // batch number and reported MFG "2027". The correct result is: nothing assigned.
  const raw = lines(fs.readFileSync(path.join(here, 'fixtures', 'zoxfer-ocr-raw.txt'), 'utf8'));
  test('batch is unreadable — the expiry date is not mistaken for it', () => {
    const batch = extractBatch(raw);
    assert.equal(batch.value, null);
    assert.equal(batch.status, 'UNREADABLE');
  });
  test('dates are unreadable, with the single readable date offered only as a candidate', () => {
    const d = extractDates(raw, { now: NOW });
    assert.equal(d.manufacturingDate, null);
    assert.equal(d.expiryDate, null);
    assert.deepEqual(d.unassignedDates.map((u) => u.raw), ['MAR-2027']);
  });
});
