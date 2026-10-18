import AuditLog from '../models/AuditLog.js';

export const AUDIT = {
  ADMIN_LOGIN: 'ADMIN_LOGIN', ADMIN_LOGOUT: 'ADMIN_LOGOUT',
  MEDICINE_CREATED: 'MEDICINE_CREATED', MEDICINE_UPDATED: 'MEDICINE_UPDATED', MEDICINE_DELETED: 'MEDICINE_DELETED',
  DRUGSETU_IMPORT: 'DRUGSETU_IMPORT',
  REFERENCE_IMAGE_UPLOADED: 'REFERENCE_IMAGE_UPLOADED', REFERENCE_IMAGE_UPDATED: 'REFERENCE_IMAGE_UPDATED',
  REFERENCE_IMAGE_APPROVED: 'REFERENCE_IMAGE_APPROVED', REFERENCE_IMAGE_REJECTED: 'REFERENCE_IMAGE_REJECTED',
  REFERENCE_IMAGE_DELETED: 'REFERENCE_IMAGE_DELETED',
  BATCH_CREATED: 'BATCH_CREATED', BATCH_UPDATED: 'BATCH_UPDATED', BATCH_DELETED: 'BATCH_DELETED',
  MANUFACTURER_QR_CREATED: 'MANUFACTURER_QR_CREATED', MANUFACTURER_QR_DELETED: 'MANUFACTURER_QR_DELETED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
};

const SECRET_KEYS = /pass|secret|token|key|hash|authorization/i;
function scrub(details) {
  if (!details || typeof details !== 'object') return {};
  return Object.fromEntries(Object.entries(details).filter(([k]) => !SECRET_KEYS.test(k)));
}

// Fire-and-forget by design: an audit write failure must never break the
// admin action it describes. Secrets are scrubbed from `details`.
export async function audit(req, action, { resource, resourceId, result = 'success', details, admin } = {}) {
  try {
    const actor = admin || req.user || {};
    await AuditLog.create({
      adminId: actor.id || null,
      adminEmail: actor.email,
      action, resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      result,
      ip: req.ip,
      details: scrub(details),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Audit] write failed:', err.message);
  }
}
