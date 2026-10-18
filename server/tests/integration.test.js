import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Needs a real MongoDB-compatible database. Skipped unless TEST_MONGO_URI is set, e.g.
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017/meditrust_test npm test
// The database is DROPPED at the start and end, so never point this at real data.
const URI = process.env.TEST_MONGO_URI;
const skip = URI ? false : 'TEST_MONGO_URI is not set';
const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ADMIN = { SUPER_ADMIN_NAME: 'Root', SUPER_ADMIN_EMAIL: 'root.admin@example.test', SUPER_ADMIN_PASSWORD: 'integration-Pass-77' };
let base; let httpServer; let mongoose; let sent; let models;

const call = async (method, url, body, token) => {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const lastOtp = () => /code is (\d{6})/.exec(sent.at(-1).text)[1];

before(async () => {
  if (skip) return;
  Object.assign(process.env, ADMIN, { NODE_ENV: 'test', JWT_SECRET: 'integration-secret-integration-secret-99', MONGO_URI: URI });
  mongoose = (await import('mongoose')).default;
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  const mail = await import('../services/mailService.js');
  sent = [];
  mail.setMailTransportForTests({ sendMail: async (m) => { sent.push(m); } });
  models = { User: (await import('../models/User.js')).default, Batch: (await import('../models/Batch.js')).default, Medicine: (await import('../models/Medicine.js')).default, ManufacturerQr: (await import('../models/ManufacturerQr.js')).default };
  const app = (await import('../app.js')).default;
  await new Promise((r) => { httpServer = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${httpServer.address().port}/api`;
});
after(async () => {
  if (skip) return;
  await new Promise((r) => httpServer.close(r));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('data:seed', { skip }, () => {
  const seed = () => execFileSync('node', ['dataSeed.js'], { cwd: serverDir, env: { ...process.env, ...ADMIN, MONGO_URI: URI }, encoding: 'utf8' });
  test('seeds everything and is idempotent', async () => {
    const out1 = seed();
    assert.match(out1, /Super admin configured \(created\)/);
    assert.match(out1, /Medicines seeded: 5/);
    assert.match(out1, /Data seed completed successfully/);
    const counts = async () => [await models.User.countDocuments(), await models.Medicine.countDocuments(), await models.Batch.countDocuments(), await models.ManufacturerQr.countDocuments()];
    const first = await counts();
    assert.deepEqual(first, [1, 5, 5, 1]);
    assert.match(seed(), /Super admin configured \(unchanged\)/);
    assert.deepEqual(await counts(), first, 'second run must not create duplicates');
  });
  test('every batch links to a medicine; no null qrCode/barcode; super admin is bcrypt-hashed', async () => {
    for (const b of await models.Batch.find().lean()) {
      assert.ok(await models.Medicine.exists({ _id: b.medicineId }));
      assert.ok(!('qrCode' in b) && !('barcode' in b));
    }
    const admin = await models.User.findOne({ email: ADMIN.SUPER_ADMIN_EMAIL }).select('+passwordHash').lean();
    assert.equal(admin.role, 'admin'); assert.equal(admin.emailVerified, true);
    assert.match(admin.passwordHash, /^\$2[aby]\$/); assert.ok(!JSON.stringify(admin).includes(ADMIN.SUPER_ADMIN_PASSWORD));
  });
  test('refuses to run without a valid super admin config', () => {
    assert.throws(() => execFileSync('node', ['dataSeed.js'], { cwd: serverDir, env: { ...process.env, ...ADMIN, SUPER_ADMIN_PASSWORD: 'short', MONGO_URI: URI }, stdio: 'pipe' }));
  });
});

describe('register -> OTP -> login', { skip }, () => {
  const u = { name: 'Pat', email: 'pat@example.test', password: 'Passw0rd!long' };
  test('register issues no token, stores only a hash, sends a 6-digit code', async () => {
    const r = await call('POST', '/auth/register', u);
    assert.equal(r.status, 201); assert.equal(r.body.requiresEmailVerification, true);
    assert.ok(!r.body.token && !JSON.stringify(r.body).match(/\b\d{6}\b/), 'no token and no OTP in the response');
    const doc = await models.User.findOne({ email: u.email }).select('+emailVerificationOtpHash').lean();
    assert.equal(doc.emailVerified, false);
    assert.ok(!JSON.stringify(doc).includes(lastOtp()));
    assert.match(doc.emailVerificationOtpHash, /^\$2[aby]\$/);
  });
  test('login is blocked until verified', async () => {
    const r = await call('POST', '/auth/login', { email: u.email, password: u.password });
    assert.equal(r.status, 403); assert.equal(r.body.code, 'EMAIL_NOT_VERIFIED');
  });
  test('wrong code counts attempts; correct code verifies once and returns a JWT', async () => {
    const code = lastOtp(); const wrong = code === '111111' ? '222222' : '111111';
    const bad = await call('POST', '/auth/verify-email', { email: u.email, otp: wrong });
    assert.equal(bad.status, 400); assert.equal(bad.body.remainingAttempts, 4);
    const good = await call('POST', '/auth/verify-email', { email: u.email, otp: code });
    assert.equal(good.status, 200); assert.ok(good.body.token); assert.equal(good.body.user.emailVerified, true);
    assert.equal((await call('POST', '/auth/verify-email', { email: u.email, otp: code })).status, 409, 'code is single-use');
    assert.equal((await call('GET', '/auth/me', null, good.body.token)).body.user.email, u.email);
  });
  test('five wrong codes lock the code; resend is rate-limited by cooldown', async () => {
    const e = 'lock@example.test';
    await call('POST', '/auth/register', { ...u, email: e });
    const code = lastOtp(); const wrong = code === '123456' ? '654321' : '123456';
    let last; for (let i = 0; i < 5; i += 1) last = await call('POST', '/auth/verify-email', { email: e, otp: wrong });
    assert.equal(last.body.code, 'OTP_TOO_MANY_ATTEMPTS');
    assert.equal((await call('POST', '/auth/verify-email', { email: e, otp: code })).body.code, 'OTP_TOO_MANY_ATTEMPTS', 'even the right code is refused after lockout');
    assert.equal((await call('POST', '/auth/resend-otp', { email: e })).body.code, 'OTP_COOLDOWN');
  });
  test('expired code is rejected', async () => {
    const e = 'exp@example.test';
    await call('POST', '/auth/register', { ...u, email: e });
    const code = lastOtp();
    await models.User.updateOne({ email: e }, { $set: { emailVerificationOtpExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call('POST', '/auth/verify-email', { email: e, otp: code })).body.code, 'OTP_EXPIRED');
  });
  test('legacy user without emailVerified can still log in', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    await models.User.collection.insertOne({ name: 'Old', email: 'old@example.test', passwordHash: await bcrypt.hash('Passw0rd!long', 10), role: 'user', isActive: true, createdAt: new Date(), updatedAt: new Date() });
    assert.equal((await call('POST', '/auth/login', { email: 'old@example.test', password: 'Passw0rd!long' })).status, 200);
  });
  test('mail not configured -> clear 503 error, never the OTP', async () => {
    const mail = await import('../services/mailService.js');
    mail.setMailTransportForTests(null);
    const { env } = await import('../config/env.js');
    const saved = { ...env.smtp }; Object.assign(env.smtp, { host: '', user: '', password: '', from: '' });
    const r = await call('POST', '/auth/register', { ...u, email: 'nomail@example.test' });
    Object.assign(env.smtp, saved); mail.setMailTransportForTests({ sendMail: async (m) => { sent.push(m); } });
    assert.equal(r.status, 503); assert.equal(r.body.code, 'MAIL_NOT_CONFIGURED'); assert.ok(!JSON.stringify(r.body).match(/\b\d{6}\b/));
  });
});

describe('admin access (JWT + role)', { skip }, () => {
  test('admin logs in with the .env super-admin credentials; guards hold', async () => {
    const login = await call('POST', '/admin/auth/login', { email: ADMIN.SUPER_ADMIN_EMAIL, password: ADMIN.SUPER_ADMIN_PASSWORD });
    assert.equal(login.status, 200); assert.equal(login.body.user.role, 'admin');
    assert.ok(!JSON.stringify(login.body).includes('passwordHash'));
    assert.equal((await call('GET', '/admin/medicines', null, login.body.token)).status, 200);
    assert.equal((await call('GET', '/admin/medicines')).status, 401);
    const user = await call('POST', '/auth/login', { email: 'old@example.test', password: 'Passw0rd!long' });
    assert.equal((await call('GET', '/admin/medicines', null, user.body.token)).status, 403);
    assert.equal((await call('GET', '/admin/medicines', null, `${login.body.token}x`)).status, 401);
    assert.equal((await call('POST', '/admin/auth/login', { email: ADMIN.SUPER_ADMIN_EMAIL, password: 'wrong-password-123' })).status, 401);
  });
  test('the old hardcoded demo credentials do not work', async () => {
    const r = await call('POST', '/admin/auth/login', { email: ['admin', 'meditrust.demo'].join('@'), password: ['Admin', '123'].join('@') });
    assert.equal(r.status, 401);
  });
});
