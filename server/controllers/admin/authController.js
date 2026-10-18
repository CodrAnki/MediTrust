import User from '../../models/User.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { signToken } from '../../utils/jwt.js';
import bcrypt from 'bcryptjs';
import { comparePassword, toSafeUser, isEmailVerified } from '../../services/userService.js';
import { audit, AUDIT } from '../../services/auditService.js';
import { str, httpError } from '../../utils/adminHelpers.js';

// A throwaway bcrypt hash so a login for an unknown email takes about as long
// as one for a real account (reduces user-enumeration via timing).
const DUMMY_HASH = bcrypt.hashSync('meditrust-timing-equalizer', 10);

export const adminLogin = asyncHandler(async (req, res) => {
  const email = str(req.body?.email, { required: true, field: 'Email', max: 200 }).toLowerCase();
  const password = str(req.body?.password, { required: true, field: 'Password', max: 200 });

  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await comparePassword(password, user?.passwordHash || DUMMY_HASH).catch(() => false);
  const allowed = Boolean(user && ok && user.role === 'admin' && user.isActive !== false && isEmailVerified(user));

  if (!allowed) {
    await audit(req, AUDIT.ADMIN_LOGIN, { resource: 'auth', result: 'failure', details: { email }, admin: { email } });
    throw httpError(401, 'Invalid email or password.');
  }

  user.lastLogin = new Date();
  await user.save();
  const safe = toSafeUser(user);
  await audit(req, AUDIT.ADMIN_LOGIN, { resource: 'auth', admin: safe });
  return res.status(200).json({ success: true, token: signToken({ sub: safe.id, role: safe.role }), user: safe });
});

// JWTs are stateless: logout is recorded for the audit trail and the client
// discards the token (it expires on its own per JWT_EXPIRES_IN).
export const adminLogout = asyncHandler(async (req, res) => {
  await audit(req, AUDIT.ADMIN_LOGOUT, { resource: 'auth' });
  return res.status(200).json({ success: true, message: 'Logged out.' });
});

export const adminMe = asyncHandler(async (req, res) => res.status(200).json({ success: true, user: req.user }));
