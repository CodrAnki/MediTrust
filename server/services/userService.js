import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// Replaces the Phase 5 in-memory services/userStore.js. Function names and
// shapes were kept identical on purpose so authController.js only needed
// its import path changed.

export function findByEmail(email) {
  // passwordHash is select:false on the schema, so we opt back in here —
  // this is the one place (login) that actually needs to compare it.
  return User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
}

export function findById(id) {
  return User.findById(id);
}

export async function createUser({ name, email, password, role = 'user', emailVerified }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ name, email: email.toLowerCase(), passwordHash, role, ...(emailVerified !== undefined && { emailVerified }) });
}

// Legacy accounts (created before OTP existed) have no emailVerified field and
// stay usable; only an explicit `false` means "registered but not yet confirmed".
export function isEmailVerified(user) {
  return user?.emailVerified !== false;
}

export function comparePassword(plain, passwordHash) {
  return bcrypt.compare(plain, passwordHash);
}

export function listUsers() {
  return User.find();
}

// Strips the password hash (and Mongoose internals) before a user object
// is ever sent in a response, and normalizes Mongoose's `_id` to a plain
// `id` string so the rest of the app (JWT payloads, req.user.id in
// controllers, the frontend) never has to think about ObjectId shapes.
export function toSafeUser(user) {
  if (!user) return null;
  const obj = typeof user.toObject === 'function' ? user.toObject() : user;
  // eslint-disable-next-line no-unused-vars
  const { _id, passwordHash, __v, emailVerificationOtpHash, emailVerificationAttempts, emailVerificationOtpExpiresAt, emailVerificationLastSentAt, ...safe } = obj;
  return { id: String(_id), ...safe };
}
