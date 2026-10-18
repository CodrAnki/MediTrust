import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';
import { findByEmail, comparePassword, toSafeUser, isEmailVerified } from '../services/userService.js';
import { issueOtp, verifyOtp, needsNewOtp, cooldownRemainingSeconds, OtpError, OTP_RESEND_COOLDOWN_SECONDS } from '../services/emailVerificationService.js';
import { MailError } from '../services/mailService.js';

const mailFailure = (res, err, email) => {
  const status = err.code === 'MAIL_NOT_CONFIGURED' ? 503 : 502;
  return res.status(status).json({ success: false, code: err.code, message: err.message, email, requiresEmailVerification: true });
};

const otpFailure = (res, err) => res.status(err.status || 400).json({
  success: false, code: err.code, message: err.message,
  ...(err.remainingAttempts !== undefined && { remainingAttempts: err.remainingAttempts }),
});

// Registration creates an UNVERIFIED account and emails a code. No token is issued
// until the code is confirmed (POST /auth/verify-email).
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  let user = await findByEmail(email);
  if (user && isEmailVerified(user)) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  if (user) {
    // Unverified account for this address already exists. It is unusable until the
    // code (sent only to the real mailbox) is entered, so refreshing its details
    // cannot hand anyone access. Respect the resend cooldown.
    const wait = cooldownRemainingSeconds(user);
    if (wait > 0) {
      return res.status(429).json({ success: false, code: 'OTP_COOLDOWN', message: `Please wait ${wait}s before requesting another code.`, retryAfterSeconds: wait, email: user.email, requiresEmailVerification: true });
    }
    user.name = name; user.passwordHash = passwordHash;
    await user.save();
  } else {
    user = await User.create({ name, email: email.toLowerCase(), passwordHash, role: 'user', emailVerified: false });
  }

  try {
    const sent = await issueOtp(user);
    return res.status(201).json({ success: true, requiresEmailVerification: true, email: user.email, ...sent, message: 'We sent a 6-digit verification code to your email.' });
  } catch (err) {
    if (err instanceof MailError) return mailFailure(res, err, user.email);
    throw err;
  }
});

export const verifyEmail = asyncHandler(async (req, res) => {
  try {
    const user = await verifyOtp(req.body.email, req.body.otp);
    user.lastLogin = new Date();
    await user.save();
    const safe = toSafeUser(user);
    return res.status(200).json({ success: true, token: signToken({ sub: safe.id, role: safe.role }), user: safe });
  } catch (err) {
    if (err instanceof OtpError) return otpFailure(res, err);
    throw err;
  }
});

export const resendOtp = asyncHandler(async (req, res) => {
  const generic = { success: true, message: 'If this email is awaiting verification, a new code has been sent.', resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS };
  const user = await User.findOne({ email: String(req.body.email).toLowerCase() });
  if (!user || isEmailVerified(user) || user.isActive === false) return res.status(200).json(generic); // no account enumeration
  const wait = cooldownRemainingSeconds(user);
  if (wait > 0) return res.status(429).json({ success: false, code: 'OTP_COOLDOWN', message: `Please wait ${wait}s before requesting another code.`, retryAfterSeconds: wait });
  try {
    await issueOtp(user);
    return res.status(200).json(generic);
  } catch (err) {
    if (err instanceof MailError) return mailFailure(res, err, user.email);
    throw err;
  }
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await findByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (user.isActive === false) {
    return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
  }

  if (!isEmailVerified(user)) {
    // Correct password but unconfirmed email: send a fresh code if none is outstanding, then
    // let the client route to the verification screen.
    if (needsNewOtp(user) && cooldownRemainingSeconds(user) === 0) {
      try { await issueOtp(user); } catch { /* the verify screen offers "Resend" and shows the real error */ }
    }
    return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email to continue.', email: user.email, requiresEmailVerification: true });
  }

  user.lastLogin = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLogin: user.lastLogin } });
  const token = signToken({ sub: user.id, role: user.role });
  return res.status(200).json({ token, user: toSafeUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  // req.user is populated by the requireAuth middleware.
  return res.status(200).json({ user: req.user });
});
