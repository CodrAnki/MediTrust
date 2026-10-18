// Pure (no I/O) parsing of batch numbers and MFG/EXP dates from OCR text.
//
// Design rules (these are deliberate; see tests/labelParser.test.js):
//  1. A value is only reported if it is SHAPED like the field AND passes validation.
//     A date-looking token can never become a batch number; a month > 12 is never a date.
//  2. Every field carries a status that distinguishes WHY a value is absent:
//       DETECTED      a validated value was read
//       NOT_DETECTED  the label itself does not appear in the text
//       UNREADABLE    the label appears but no legible/valid value was found next to it
//       INVALID       a value was read but is impossible (e.g. MFG in the future, EXP before MFG)
//  3. Stacked "labels in one column, values in another" layouts (very common on Indian
//     cartons; Tesseract flattens them into two runs of text) are assigned by position ONLY
//     when the number of value tokens equals the number of labels. Otherwise the tokens are
//     returned as `unassignedDates` for the user to confirm — never guessed into a field.
//  4. Nothing is invented: raw text is untouched and callers keep it.

const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function monthFromName(word) {
  const w = String(word || '').toUpperCase().replace(/\./g, '');
  if (w.length < 3) return null;
  const index = MONTH_NAMES.findIndex((name) => name.startsWith(w) || (w === 'SEPT' && name === 'SEPTEMBER'));
  return index === -1 ? null : index + 1;
}

const pad = (n) => String(n).padStart(2, '0');
const fullYear = (text) => (text.length === 2 ? 2000 + Number(text) : Number(text));

/**
 * Parses a month/year expression.
 * @returns {null | {valid: boolean, reason?: string, month?: number, year?: number, precision?: 'MONTH'|'YEAR', normalized?: string, raw: string}}
 *   null = not date-shaped at all; valid:false = date-shaped but impossible.
 */
export function parseMonthYear(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
  if (!text) return null;

  let m = text.match(/^(\d{1,2}) ?[/\-.] ?(\d{4}|\d{2})$/);
  if (m) {
    const month = Number(m[1]);
    const year = fullYear(m[2]);
    if (month < 1 || month > 12) return { valid: false, reason: 'MONTH_OUT_OF_RANGE', raw: text };
    if (year < 2000 || year > 2099) return { valid: false, reason: 'YEAR_OUT_OF_RANGE', raw: text };
    return { valid: true, month, year, precision: 'MONTH', normalized: `${year}-${pad(month)}`, raw: text };
  }

  m = text.match(/^([A-Z]{3,9})\.? ?[/\-.]? ?(\d{4}|\d{2})$/);
  if (m) {
    const month = monthFromName(m[1]);
    if (!month) return null; // an ordinary word followed by digits, not a date
    const year = fullYear(m[2]);
    if (year < 2000 || year > 2099) return { valid: false, reason: 'YEAR_OUT_OF_RANGE', raw: text };
    return { valid: true, month, year, precision: 'MONTH', normalized: `${year}-${pad(month)}`, raw: text };
  }

  m = text.match(/^(\d{4})$/);
  if (m) {
    const year = Number(m[1]);
    if (year < 2000 || year > 2099) return null;
    return { valid: true, year, precision: 'YEAR', normalized: String(year), raw: text };
  }
  return null;
}

// --- Batch ---------------------------------------------------------------------------------

const BATCH_LABEL = /\b(?:batch\s*(?:no\.?|number)?|b\.?\s?no\.?|lot\s*(?:no\.?)?)(?=\W|$)/i;
const BATCH_INLINE = /\b(?:batch\s*(?:no\.?|number)?|b\.?\s?no\.?|lot\s*(?:no\.?)?)\s*[:\-;]?\s*([A-Z0-9][A-Z0-9\-/]{3,14})/gi;
const BATCH_SHAPE = /(?=[A-Z0-9\-/]*\d)[A-Z0-9][A-Z0-9\-/]{3,14}/i;
const LICENCE_LINE = /\blic(?:en[cs]e)?\b/i;

/** True only if `token` could be a batch/lot number (not a date, year, licence number, or word). */
export function isPlausibleBatch(token) {
  const t = String(token || '').trim();
  if (!/^[A-Z0-9][A-Z0-9\-/]{3,14}$/i.test(t)) return false;
  if (!/\d/.test(t)) return false; // real batch codes contain at least one digit
  if (parseMonthYear(t)) return false; // MAR-2027, 03/2027 ... are dates
  if (/^(?:19|20)\d{2}$/.test(t)) return false; // a bare year
  if ((t.match(/\//g) || []).length >= 2) return false; // MNB/15/906 is a licence number
  return true;
}

/**
 * @returns {{ value: string|null, status: 'DETECTED'|'NOT_DETECTED'|'UNREADABLE', source: 'inline'|'stacked'|null, rejected: string[] }}
 */
export function extractBatch(lines) {
  const text = lines.join('\n');
  const labelSeen = BATCH_LABEL.test(text);
  const rejected = [];

  // 1. "Batch No: ABC123" on one line (label and value adjacent).
  for (const match of text.matchAll(BATCH_INLINE)) {
    if (isPlausibleBatch(match[1])) return { value: match[1].trim(), status: 'DETECTED', source: 'inline', rejected };
    rejected.push(match[1]);
  }

  // 2. Label on its own line, value on one of the next few lines (stacked layout).
  for (let i = 0; i < lines.length; i += 1) {
    if (!BATCH_LABEL.test(lines[i])) continue;
    const remainder = lines[i].replace(BATCH_LABEL, '');
    for (const candidateLine of [remainder, ...lines.slice(i + 1, i + 4)]) {
      if (LICENCE_LINE.test(candidateLine)) continue;
      const token = candidateLine.match(BATCH_SHAPE)?.[0];
      if (!token) continue;
      if (isPlausibleBatch(token)) return { value: token.trim(), status: 'DETECTED', source: 'stacked', rejected };
      rejected.push(token);
    }
  }

  return { value: null, status: labelSeen ? 'UNREADABLE' : 'NOT_DETECTED', source: null, rejected };
}

// --- Dates ---------------------------------------------------------------------------------

const MFG_LABEL = /\b(?:mfg|mig|mfd|manufactured)\.?\s*date\b/i;
const EXP_LABEL = /\b(?:exp|expiry|use\s*before)\.?\s*(?:date)?\b/i;
const MONTH_WORDS = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC';
const DATE_TOKEN = new RegExp(
  `(?<![/\\w])(?:(?:0?[1-9]|1[0-2]) ?[/\\-.] ?(?:\\d{4}|\\d{2})|(?:${MONTH_WORDS})[A-Z]*\\.? ?(?:\\d{4}|[/\\-.] ?\\d{2}|[/\\-.] ?\\d{4}))(?![/\\w])`,
  'gi',
);
const MFG_INLINE = /\b(?:mfg|mig|mfd|manufactured)\.?\s*(?:date)?\s*[:\-;]?[ \t]*(\d{1,2} ?[/\-.] ?(?:\d{4}|\d{2})(?!\d)|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*\.? ?[/\-.]? ?\d{2,4}|\d{4})/i;
const EXP_INLINE = /\b(?:exp|expiry|exp\.?\s*date|use\s*before)\.?\s*(?:date)?\s*[:\-;]?[ \t]*(\d{1,2} ?[/\-.] ?(?:\d{4}|\d{2})(?!\d)|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*\.? ?[/\-.]? ?\d{2,4}|\d{4})/i;

const monthIndex = (p) => p.year * 12 + p.month;

/**
 * @param {string[]} lines
 * @param {{ now?: Date }} [opts]
 */
export function extractDates(lines, { now = new Date() } = {}) {
  const text = lines.join('\n');
  const notes = [];
  const result = {
    manufacturingDate: null,
    expiryDate: null,
    parsed: { manufacturingDate: null, expiryDate: null },
    status: { manufacturingDate: 'NOT_DETECTED', expiryDate: 'NOT_DETECTED' },
    invalid: {},
    unassignedDates: [],
    notes,
  };

  const labels = { manufacturingDate: MFG_LABEL.exec(text), expiryDate: EXP_LABEL.exec(text) };
  const consumed = new Set();

  // 1. Inline "Label: value".
  const take = (field, pattern) => {
    const raw = text.match(pattern)?.[1]?.trim();
    if (!raw) return;
    const parsed = parseMonthYear(raw);
    consumed.add(raw.toUpperCase());
    if (!parsed) return;
    if (!parsed.valid) { result.status[field] = 'INVALID'; result.invalid[field] = raw; return; }
    if (parsed.precision === 'YEAR') {
      // A bare year cannot establish a month-level expiry/manufacture date.
      result.status[field] = 'UNREADABLE';
      notes.push(`Only a year (${raw}) was readable next to the ${field === 'expiryDate' ? 'expiry' : 'manufacturing'} label; a full month and year is required.`);
      return;
    }
    result[field] = raw;
    result.parsed[field] = parsed;
    result.status[field] = 'DETECTED';
  };
  take('manufacturingDate', MFG_INLINE);
  take('expiryDate', EXP_INLINE);

  // 2. Stacked layout: assign remaining date-shaped tokens by label order, only if counts match.
  const missingFields = ['manufacturingDate', 'expiryDate']
    .filter((field) => labels[field] && result.status[field] === 'NOT_DETECTED')
    .sort((a, b) => labels[a].index - labels[b].index);

  const tokens = [...text.matchAll(DATE_TOKEN)]
    .map((match) => ({ raw: match[0].trim(), parsed: parseMonthYear(match[0]) }))
    .filter((t) => t.parsed?.valid && t.parsed.precision === 'MONTH' && !consumed.has(t.raw.toUpperCase()));

  if (missingFields.length && tokens.length === missingFields.length) {
    missingFields.forEach((field, i) => {
      result[field] = tokens[i].raw;
      result.parsed[field] = tokens[i].parsed;
      result.status[field] = 'DETECTED';
    });
    notes.push('Dates were matched to labels by position in a stacked label/value layout.');
  } else if (tokens.length) {
    // Cannot align values to labels reliably. Surface them as suggestions, never as fields.
    const nowIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
    for (const t of tokens) {
      const future = monthIndex(t.parsed) > nowIndex + 1;
      result.unassignedDates.push({
        raw: t.raw,
        normalized: t.parsed.normalized,
        // A future date cannot be a manufacturing date; a past one could be either.
        plausibleAs: future ? ['expiryDate'] : ['manufacturingDate', 'expiryDate'],
      });
    }
    if (missingFields.length) {
      notes.push(`${tokens.length} date value(s) were readable but could not be reliably matched to the ${missingFields.length} date label(s); please confirm them.`);
    }
  }

  for (const field of missingFields) {
    if (result.status[field] === 'NOT_DETECTED') result.status[field] = 'UNREADABLE';
  }

  // 3. Plausibility.
  const nowIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
  const mfg = result.parsed.manufacturingDate;
  const exp = result.parsed.expiryDate;
  if (mfg && monthIndex(mfg) > nowIndex + 1) {
    result.invalid.manufacturingDate = result.manufacturingDate;
    result.manufacturingDate = null; result.parsed.manufacturingDate = null; result.status.manufacturingDate = 'INVALID';
    notes.push('The manufacturing date is in the future, which is not possible for a manufactured product.');
  }
  if (result.parsed.manufacturingDate && exp && monthIndex(exp) < monthIndex(result.parsed.manufacturingDate)) {
    result.invalid.manufacturingDate = result.manufacturingDate;
    result.invalid.expiryDate = result.expiryDate;
    for (const field of ['manufacturingDate', 'expiryDate']) {
      result[field] = null; result.parsed[field] = null; result.status[field] = 'INVALID';
    }
    notes.push('The expiry date is earlier than the manufacturing date; neither value can be trusted.');
  }

  return result;
}
