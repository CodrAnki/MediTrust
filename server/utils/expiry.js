import { parseMonthYear } from '../services/labelParser.js';

// Packaging prints expiry as MM/YYYY, MM/YY or a named month (OCT-2025). An absent
// value remains "not verified"; an unreadable value is never treated as a
// counterfeit signal. A real, expired date is surfaced separately.
//
// A bare year ("2027") is deliberately UNREADABLE: it cannot say which month the
// product expires, and guessing January would wrongly report a medicine that
// expires in December as EXPIRED.
//
// Expiry is the END of the printed month (a product marked 03/2027 is usable
// through 31 March 2027).
export function validateExpiry(value, now = new Date()) {
  if (!value) return { status: 'NOT_FOUND', expired: false };
  const parsed = parseMonthYear(value);
  if (!parsed || !parsed.valid || parsed.precision !== 'MONTH') return { status: 'UNREADABLE', expired: false };
  const endOfMonth = new Date(parsed.year, parsed.month, 0, 23, 59, 59, 999);
  const expired = endOfMonth < now;
  return { status: expired ? 'EXPIRED' : 'VALID', expired, normalized: parsed.normalized };
}
