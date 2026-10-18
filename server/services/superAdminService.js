import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { env } from '../config/env.js';

// Creates / promotes the single super-admin account from server/.env
// (SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME). There is no other
// source of admin credentials anywhere in the project. The password is only ever
// handled as a bcrypt hash: it is not stored in plaintext, logged, or returned.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_SUPER_ADMIN_PASSWORD_LENGTH = 10;
const BCRYPT_ROUNDS = 12;

export class SuperAdminConfigError extends Error {}

export function validateSuperAdminConfig(cfg = env.superAdmin) {
  const problems = [];
  if (!cfg.email) problems.push('SUPER_ADMIN_EMAIL is not set.');
  else if (!EMAIL_RE.test(cfg.email)) problems.push('SUPER_ADMIN_EMAIL is not a valid email address.');
  if (!cfg.password) problems.push('SUPER_ADMIN_PASSWORD is not set.');
  else if (cfg.password.length < MIN_SUPER_ADMIN_PASSWORD_LENGTH) problems.push(`SUPER_ADMIN_PASSWORD must be at least ${MIN_SUPER_ADMIN_PASSWORD_LENGTH} characters.`);
  else if (cfg.email && cfg.password.toLowerCase() === cfg.email.toLowerCase()) problems.push('SUPER_ADMIN_PASSWORD must not equal the email address.');
  if (problems.length) throw new SuperAdminConfigError(problems.join(' '));
}

/**
 * @returns {Promise<{action: 'created'|'promoted'|'updated'|'unchanged', email: string}>}
 */
export async function ensureSuperAdmin(cfg = env.superAdmin) {
  validateSuperAdminConfig(cfg);
  const email = cfg.email.toLowerCase();
  const existing = await User.findOne({ email }).select('+passwordHash');

  if (!existing) {
    const passwordHash = await bcrypt.hash(cfg.password, BCRYPT_ROUNDS);
    await User.create({ name: cfg.name, email, passwordHash, role: 'admin', isActive: true, emailVerified: true, emailVerifiedAt: new Date() });
    return { action: 'created', email };
  }

  const wasAdmin = existing.role === 'admin';
  const passwordSame = await bcrypt.compare(cfg.password, existing.passwordHash).catch(() => false);
  const needsChange = !wasAdmin || existing.isActive === false || existing.emailVerified !== true || !passwordSame;
  if (!needsChange) return { action: 'unchanged', email };

  existing.role = 'admin';
  existing.isActive = true;
  existing.emailVerified = true;
  existing.emailVerifiedAt = existing.emailVerifiedAt || new Date();
  if (!existing.name) existing.name = cfg.name;
  if (!passwordSame) existing.passwordHash = await bcrypt.hash(cfg.password, BCRYPT_ROUNDS);
  await existing.save();
  return { action: wasAdmin ? 'updated' : 'promoted', email };
}
