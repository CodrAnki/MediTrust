import { statusMessages } from '../data/siteContent.js';

// Display-only copy. The decision itself is made server-side by the risk engine
// (server/services/riskEngine.js); the frontend never invents or upgrades a result.
// `icon` is a shape name so status is never conveyed by colour alone.
export const riskLevelCopy = {
  low: { label: 'Higher agreement', statusLabel: 'Consistent with available records', color: 'verified' },
  medium: { label: 'Partial agreement', statusLabel: 'Requires review', color: 'warning' },
  high: { label: 'Low agreement', statusLabel: 'Little agreement with reference records', color: 'danger' },
  unknown: { label: 'Score withheld', statusLabel: 'Not enough evidence for a meaningful score', color: 'warning' },
};

const STATUS = {
  VERIFIED_AGAINST_REFERENCE: { label: 'Verified against reference', color: 'verified', icon: 'check' },
  NEEDS_REVIEW: { label: 'Needs review', color: 'warning', icon: 'warn' },
  MISMATCH_DETECTED: { label: 'Mismatch detected', color: 'danger', icon: 'cross' },
  EXPIRED: { label: 'Expired — do not use', color: 'danger', icon: 'cross' },
  REFERENCE_NOT_FOUND: { label: 'Reference not found', color: 'warning', icon: 'help' },
  NOT_AVAILABLE: { label: 'Not available', color: 'warning', icon: 'help' },
  NOT_DETECTED: { label: 'Not detected', color: 'warning', icon: 'help' },
  INVALID_INPUT: { label: 'Invalid input', color: 'warning', icon: 'warn' },
  PROCESSING_FAILED: { label: 'Processing failed', color: 'danger', icon: 'cross' },
};

// Records saved before the v2 contract keep their stored value; they are DISPLAYED as the closest
// current status. HIGH_CONFIDENCE was awarded without a verified batch/expiry, so it is not a pass.
export const LEGACY_STATUS = {
  VERIFIED: 'VERIFIED_AGAINST_REFERENCE', HIGH_CONFIDENCE: 'NEEDS_REVIEW', SUSPICIOUS: 'NEEDS_REVIEW',
  HIGH_RISK: 'MISMATCH_DETECTED', MISMATCH: 'MISMATCH_DETECTED', UNVERIFIED: 'NEEDS_REVIEW', UNKNOWN: 'NEEDS_REVIEW',
};
export const normalizeStatus = (status) => LEGACY_STATUS[status] || status;

export function statusMeta(status) {
  const key = normalizeStatus(status);
  const base = STATUS[key] || { label: String(status || 'Unknown'), color: 'warning', icon: 'help' };
  return { ...base, key, message: statusMessages[key] || statusMessages.NEEDS_REVIEW };
}

// Per-check labels for the result table (text + icon, never colour alone).
const CHECK = {
  MATCH: { text: 'Match', tone: 'good' }, VALID: { text: 'Valid', tone: 'good' }, OK: { text: 'OK', tone: 'good' },
  CLEAR: { text: 'None seen', tone: 'neutral' }, PARTIAL: { text: 'Partial', tone: 'warn' },
  MISMATCH: { text: 'Mismatch', tone: 'bad' }, EXPIRED: { text: 'Expired', tone: 'bad' },
  FLAGGED: { text: 'Needs attention', tone: 'warn' }, LOW_CONFIDENCE: { text: 'Low confidence', tone: 'warn' },
  UNKNOWN: { text: 'Unknown', tone: 'neutral' }, NOT_DETECTED: { text: 'Not read', tone: 'neutral' }, NOT_AVAILABLE: { text: 'Not available', tone: 'neutral' },
};
export const checkMeta = (status) => CHECK[status] || { text: String(status || 'Unknown'), tone: 'neutral' };
