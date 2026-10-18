import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// One response shape for every rate-limit rejection, matching errorHandler.js.
function limited(message, code = 'RATE_LIMITED') {
  return (req, res, _next, options) => {
    res.status(options.statusCode).json({ success: false, code, message, requestId: req.id });
  };
}

const byUserOrIp = (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip));

// Progress polling is high-frequency by design (it is how the processing page
// shows REAL stage progress) and must never consume the general API budget —
// before this fix a handful of verifications exhausted the 300/15min allowance
// and the processing page silently stopped updating (or the upload itself got a 429).
const PROGRESS_PATH = /^\/verification\/progress\//;

export function createApiLimiter({ windowMs = 15 * 60 * 1000, limit = 300 } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => PROGRESS_PATH.test(req.path),
    handler: limited('Too many requests. Please try again later.'),
  });
}
export const apiLimiter = createApiLimiter();

// Dedicated, more generous ceiling for progress polling (about 4 requests/second).
export function createProgressLimiter({ windowMs = 60 * 1000, limit = 240 } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: byUserOrIp,
    handler: limited('Progress is being polled too quickly. Please slow down.', 'PROGRESS_RATE_LIMITED'),
  });
}
export const progressLimiter = createProgressLimiter();

// Starting a verification is CPU-heavy (OCR + image decoding). Per authenticated user.
export function createVerificationLimiter({ windowMs = 15 * 60 * 1000, limit = 30 } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: byUserOrIp,
    handler: limited('You have started too many verifications recently. Please wait a few minutes and try again.', 'VERIFICATION_RATE_LIMITED'),
  });
}
export const verificationLimiter = createVerificationLimiter();
export const verificationPreviewLimiter = createVerificationLimiter({ limit: 30 });

// Tighter limit specifically on auth routes to slow down credential
// stuffing / brute-force attempts against /login and /register.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limited('Too many attempts. Please wait a few minutes and try again.', 'AUTH_RATE_LIMITED'),
});

// Verification-code endpoints. Per-account attempt limits (5 wrong codes) and the
// 60s resend cooldown are enforced in services/emailVerificationService.js; this
// is the additional per-IP ceiling.
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limited('Too many verification requests. Please wait a few minutes and try again.', 'OTP_RATE_LIMITED'),
});
