import Scan from '../models/Scan.js';

// This one is genuinely real, not mocked: it queries the Scan collection
// for how many times this exact code has been scanned recently. QR codes
// are now really decoded (Phase 8.5, see qrService.js), so this now flags
// genuine repeated-code activity rather than coincidental simulated-code
// collisions.
//
// Repeated scans must never automatically imply "fake" on their own —
// this only flags the pattern; the risk engine decides how much weight
// it carries.
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const SUSPICIOUS_THRESHOLD = 3; // this many recent scans of the same code

// TODO(Phase 9/admin): make WINDOW_MS/SUSPICIOUS_THRESHOLD configurable
// rules (excessive scans, unusually rapid scans, impossible travel
// patterns) rather than fixed constants.
export async function checkDuplicateActivity({ qrCode }, { threshold = SUSPICIOUS_THRESHOLD, windowMinutes = WINDOW_MS / 60000 } = {}) {
  if (!qrCode) return { detected: false, reason: null };

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const recentCount = await Scan.countDocuments({
    'signals.qr.code': qrCode,
    createdAt: { $gte: since },
  });

  const detected = recentCount >= threshold;
  return {
    detected,
    reason: detected
      ? `This code has been scanned ${recentCount + 1} times in the last ${windowMinutes} minutes.`
      : null,
  };
}
