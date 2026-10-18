import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'unit-test-secret-unit-test-secret-1234';
const { generateOtp, cooldownRemainingSeconds, needsNewOtp, OTP_RESEND_COOLDOWN_SECONDS } = await import('../services/emailVerificationService.js');
const { validateSuperAdminConfig, SuperAdminConfigError } = await import('../services/superAdminService.js');
const { signToken, verifyToken } = await import('../utils/jwt.js');
const { isEmailVerified, toSafeUser } = await import('../services/userService.js');

describe('OTP generation', () => {
  test('always exactly 6 digits, including leading zeros', () => {
    for (let i = 0; i < 3000; i += 1) assert.match(generateOtp(), /^\d{6}$/);
  });
  test('is not constant / not trivially sequential', () => {
    const set = new Set(Array.from({ length: 300 }, generateOtp));
    assert.ok(set.size > 280);
  });
});

describe('resend cooldown / expiry helpers', () => {
  test('cooldown counts down and ends', () => {
    const now = Date.now();
    assert.equal(cooldownRemainingSeconds({ emailVerificationLastSentAt: new Date(now) }, now), OTP_RESEND_COOLDOWN_SECONDS);
    assert.equal(cooldownRemainingSeconds({ emailVerificationLastSentAt: new Date(now - 61_000) }, now), 0);
    assert.equal(cooldownRemainingSeconds({}, now), 0);
  });
  test('needsNewOtp is true when none or expired', () => {
    const now = Date.now();
    assert.equal(needsNewOtp({}, now), true);
    assert.equal(needsNewOtp({ emailVerificationOtpExpiresAt: new Date(now - 1) }, now), true);
    assert.equal(needsNewOtp({ emailVerificationOtpExpiresAt: new Date(now + 5000) }, now), false);
  });
});

describe('legacy accounts', () => {
  test('missing emailVerified (pre-OTP user) is treated as verified; only explicit false blocks', () => {
    assert.equal(isEmailVerified({}), true);
    assert.equal(isEmailVerified({ emailVerified: true }), true);
    assert.equal(isEmailVerified({ emailVerified: false }), false);
  });
  test('toSafeUser strips password hash and every OTP field', () => {
    const safe = toSafeUser({ _id: 'x1', name: 'n', passwordHash: 'h', emailVerificationOtpHash: 'o', emailVerificationAttempts: 2, emailVerificationOtpExpiresAt: new Date(), emailVerificationLastSentAt: new Date(), __v: 0 });
    for (const k of ['passwordHash', 'emailVerificationOtpHash', 'emailVerificationAttempts', 'emailVerificationOtpExpiresAt', 'emailVerificationLastSentAt']) assert.ok(!(k in safe), k);
    assert.equal(safe.id, 'x1');
  });
});

describe('super admin config validation', () => {
  const ok = { name: 'A', email: 'root@example.test', password: 'long-enough-pass' };
  test('accepts a valid config', () => assert.doesNotThrow(() => validateSuperAdminConfig(ok)));
  test('rejects missing / malformed email, missing or short password, password == email', () => {
    for (const bad of [{ ...ok, email: '' }, { ...ok, email: 'not-an-email' }, { ...ok, password: '' }, { ...ok, password: 'short' }, { ...ok, password: 'root@example.test' }]) {
      assert.throws(() => validateSuperAdminConfig(bad), SuperAdminConfigError);
    }
  });
});

describe('JWT', () => {
  test('payload holds only sub, role, iat, exp', () => {
    const claims = verifyToken(signToken({ sub: 'u1', role: 'user' }));
    assert.deepEqual(Object.keys(claims).sort(), ['exp', 'iat', 'role', 'sub']);
    assert.equal(claims.sub, 'u1');
  });
  test('rejects a token signed with another secret, an expired token and alg=none', () => {
    assert.throws(() => verifyToken(jwt.sign({ role: 'admin' }, 'other-secret', { subject: 'u1' })));
    assert.throws(() => verifyToken(jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { subject: 'u1', expiresIn: -10 })));
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    assert.throws(() => verifyToken(`${b({ alg: 'none', typ: 'JWT' })}.${b({ sub: 'u1', role: 'admin' })}.`));
  });
});
