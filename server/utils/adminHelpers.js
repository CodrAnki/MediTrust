// Small helpers shared by the admin controllers: strict input coercion (no
// objects sneaking into Mongo queries -> NoSQL-injection safe), paging, and
// regex escaping for search.

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Coerces to a trimmed string. Objects/arrays are rejected (query-operator injection). */
export function str(value, { max = 200, required = false, field = 'value' } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `${field} is required.`);
    return undefined;
  }
  if (typeof value === 'object') throw httpError(400, `${field} is invalid.`);
  const out = String(value).trim();
  if (!out && required) throw httpError(400, `${field} is required.`);
  if (out.length > max) throw httpError(400, `${field} must be at most ${max} characters.`);
  return out || undefined;
}

export function num(value, { min = 0, max = 1e9, field = 'value' } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `${field} must be a number between ${min} and ${max}.`);
  return n;
}

export function bool(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw httpError(400, 'Invalid boolean value.');
}

export function oneOf(value, allowed, field = 'value') {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) throw httpError(400, `${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

export function escapeRegex(text) { return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function paging(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta({ page, limit }, total) {
  return { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) };
}

// "MM/YYYY" with a valid month, as used by Batch dates.
export function monthYear(value, field) {
  const v = str(value, { required: true, field, max: 7 });
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(v);
  if (!m) throw httpError(400, `${field} must be in MM/YYYY format.`);
  return v;
}

export function monthYearToNumber(v) { const [m, y] = v.split('/'); return Number(y) * 12 + Number(m); }
