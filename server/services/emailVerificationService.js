import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { sendMail } from './mailService.js';

// Email OTP verification. Rules enforced here:
//  - 6-digit code from crypto.randomInt (cryptographically secure)
//  - only a bcrypt HASH is stored; the code is never stored, logged or returned
//  - expires after OTP_TTL_MINUTES, single use, max OTP_MAX_ATTEMPTS wrong guesses
//  - resend cooldown of OTP_RESEND_COOLDOWN_SECONDS

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
const BCRYPT_ROUNDS = 10;

export class OtpError extends Error {
  constructor(code, message, status, extra = {}) {
    super(message);
    this.name = 'OtpError';
    this.code = code; // OTP_INVALID | OTP_EXPIRED | OTP_TOO_MANY_ATTEMPTS | OTP_COOLDOWN | ALREADY_VERIFIED
    this.status = status;
    Object.assign(this, extra);
  }
}

export function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function cooldownRemainingSeconds(user, now = Date.now()) {
  const last = user?.emailVerificationLastSentAt?.getTime?.();
  if (!last) return 0;
  return Math.max(0, Math.ceil((last + OTP_RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000));
}

function emailBody(name, otp) {
  const text = `Hi ${name || 'there'},\n\nYour MediTrust verification code is ${otp}.\nIt expires in ${OTP_TTL_MINUTES} minutes. If you didn't create a MediTrust account, you can ignore this email.\n`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px"><p>Hi ${String(name || 'there').replace(/[<>&"]/g, '')},</p><p>Your MediTrust verification code is:</p><p style="font-size:30px;letter-spacing:8px;font-weight:700">${otp}</p><p>It expires in ${OTP_TTL_MINUTES} minutes. If you didn't create a MediTrust account, you can ignore this email.</p></div>`;
  return { text, html };
}

/**
 * Generates a fresh code, stores its hash on the user and emails it.
 * The state is saved BEFORE sending so a delivered code can always be verified;
 * if sending fails the MailError propagates and the user can use "resend".
 */
export async function issueOtp(user) {
  const otp = generateOtp();
  const hash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const now = new Date();
  await User.updateOne({ _id: user._id }, {
    $set: {
      emailVerificationOtpHash: hash,
      emailVerificationOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000),
      emailVerificationAttempts: 0,
      emailVerificationLastSentAt: now,
    },
  });
  const { text, html } = emailBody(user.name, otp);
  await sendMail({ to: user.email, subject: 'Your MediTrust verification code', text, html });
  return { expiresInMinutes: OTP_TTL_MINUTES, resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

/** True when the user has no unexpired code outstanding. */
export function needsNewOtp(user, now = Date.now()) {
  const exp = user?.emailVerificationOtpExpiresAt?.getTime?.();
  return !exp || exp <= now;
}

/**
 * Verifies a submitted code. On success marks the email verified and clears all
 * OTP state atomically (one-time use). Returns the updated user document.
 */
export async function verifyOtp(email, submitted) {
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+emailVerificationOtpHash');
  const invalid = () => new OtpError('OTP_INVALID', 'That code is not correct.', 400);
  if (!user) throw invalid();
  if (user.emailVerified !== false) throw new OtpError('ALREADY_VERIFIED', 'This email is already verified. Please log in.', 409);

  const hash = user.emailVerificationOtpHash;
  if (!hash || !user.emailVerificationOtpExpiresAt) throw new OtpError('OTP_EXPIRED', 'This code has expired. Request a new one.', 400);
  if (user.emailVerificationOtpExpiresAt.getTime() <= Date.now()) throw new OtpError('OTP_EXPIRED', 'This code has expired. Request a new one.', 400);
  if ((user.emailVerificationAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    throw new OtpError('OTP_TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Request a new code.', 429);
  }

  const ok = /^\d{6}$/.test(String(submitted)) && await bcrypt.compare(String(submitted), hash);
  if (!ok) {
    // Atomic increment so parallel guesses can't dodge the attempt limit.
    await User.updateOne({ _id: user._id }, { $inc: { emailVerificationAttempts: 1 } });
    const after = await User.findById(user._id, 'emailVerificationAttempts').lean();
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - (after?.emailVerificationAttempts ?? OTP_MAX_ATTEMPTS));
    throw remaining === 0
      ? new OtpError('OTP_TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Request a new code.', 429)
      : new OtpError('OTP_INVALID', 'That code is not correct.', 400, { remainingAttempts: remaining });
  }

  // One-time use: only the request that still sees the same unused hash can win
  // (modifiedCount is 1 for exactly one of any set of concurrent submissions).
  const won = await User.updateOne(
    { _id: user._id, emailVerified: false, emailVerificationOtpHash: hash },
    { $set: { emailVerified: true, emailVerifiedAt: new Date() }, $unset: { emailVerificationOtpHash: '', emailVerificationOtpExpiresAt: '', emailVerificationLastSentAt: '' } },
  );
  if (won.modifiedCount !== 1) throw new OtpError('OTP_EXPIRED', 'This code has already been used. Request a new one.', 400);
  return User.findById(user._id);
}
