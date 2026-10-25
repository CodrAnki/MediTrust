import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Always load server/.env, regardless of the directory the process was started
// from (npm scripts, tests, `node dataSeed.js` from elsewhere...).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

const nodeEnv = clean(process.env.NODE_ENV) || 'development';
const isProduction = nodeEnv === 'production';

// --- JWT secret ---------------------------------------------------------------
// Never a hardcoded fallback. In production a strong secret is mandatory. In
// development/test a missing secret is replaced by a random per-process one
// (sessions simply don't survive a restart) with a loud warning, instead of a
// guessable constant that could silently end up in production.
const MIN_JWT_SECRET_LENGTH = 32;
let jwtSecret = clean(process.env.JWT_SECRET);
if (isProduction) {
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    // eslint-disable-next-line no-console
    console.error(`JWT_SECRET must be set to a random string of at least ${MIN_JWT_SECRET_LENGTH} characters in production.`);
    process.exit(1);
  }
} else if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(48).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn('[env] JWT_SECRET is not set: using a random temporary secret (all logins reset on restart). Set JWT_SECRET in server/.env.');
  }
}

const smtpPort = Number(process.env.SMTP_PORT) || 587;

// Positive-integer env var with a safe default. Anything unusable (NaN, <= 0)
// falls back to the default rather than silently disabling a safety timeout.
function positiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: clean(process.env.MONGO_URI),
  jwtSecret,
  jwtExpiresIn: clean(process.env.JWT_EXPIRES_IN) || '7d',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean),
  get clientUrl() { return this.clientUrls[0]; },
  nodeEnv,
  isProduction,

  // Processing limits. OCR of one photo normally takes a few seconds; these are
  // ceilings that stop a wedged OCR worker from hanging a request forever.
  limits: {
    ocrTimeoutMs: positiveInt('OCR_TIMEOUT_MS', 45_000), // one Tesseract recognize() call
    verificationTimeoutMs: positiveInt('VERIFICATION_TIMEOUT_MS', 150_000), // whole pipeline
  },

  // Super admin: the ONLY source of admin credentials. Read by dataSeed.js; never
  // logged, never returned by any API, stored only as a bcrypt hash.
  superAdmin: {
    name: clean(process.env.SUPER_ADMIN_NAME) || 'Super Admin',
    email: clean(process.env.SUPER_ADMIN_EMAIL).toLowerCase(),
    password: process.env.SUPER_ADMIN_PASSWORD || '', // not trimmed: whitespace may be intentional
  },

  // SMTP (email OTP). Server-side only.
  smtp: {
    host: clean(process.env.SMTP_HOST),
    port: smtpPort,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465,
    user: clean(process.env.SMTP_USER),
    password: process.env.SMTP_PASSWORD || '',
    from: clean(process.env.SMTP_FROM) || clean(process.env.SMTP_USER),
  },

};
