export const VERIFICATION_FIELDS = [
  'medicineName',
  'genericName',
  'strength',
  'manufacturer',
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
];

export function parseConfirmedFields(value) {
  if (value === undefined) return null;

  let fields;
  try {
    fields = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw Object.assign(new Error('Confirmed medicine details are invalid. Please review the fields and try again.'), {
      status: 400,
      code: 'INVALID_CONFIRMED_FIELDS',
    });
  }

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw Object.assign(new Error('Confirmed medicine details are invalid. Please review the fields and try again.'), {
      status: 400,
      code: 'INVALID_CONFIRMED_FIELDS',
    });
  }

  const allowed = new Set(VERIFICATION_FIELDS);
  if (Object.keys(fields).some((key) => !allowed.has(key))) {
    throw Object.assign(new Error('Confirmed medicine details contain an unsupported field.'), {
      status: 400,
      code: 'INVALID_CONFIRMED_FIELDS',
    });
  }

  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (typeof value !== 'string' || value.length > 160) {
      throw Object.assign(new Error('Each confirmed field must be text and no longer than 160 characters.'), {
        status: 400,
        code: 'INVALID_CONFIRMED_FIELDS',
      });
    }
    return [key, value.trim() || null];
  }));
}

export function mergeConfirmedFields(extracted, confirmedFields) {
  if (!confirmedFields) return { fields: { ...extracted }, fieldSources: {} };
  const fields = { ...extracted };
  const fieldSources = {};
  for (const [field, value] of Object.entries(confirmedFields)) {
    fields[field] = value;
    fieldSources[field] = 'USER_CONFIRMED';
  }
  return { fields, fieldSources };
}
