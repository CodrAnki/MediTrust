import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// End-to-end: real Express app + real Tesseract OCR + real database.
// Needs a MongoDB-compatible database; skipped unless TEST_MONGO_URI is set (the database
// is DROPPED at start and end — never point this at real data):
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017/meditrust_test npm test
const URI = process.env.TEST_MONGO_URI;
const skip = URI ? false : 'TEST_MONGO_URI is not set';
const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, 'fixtures', 'zoxfer-xt-plus-box-with-qr.jpg');

let base; let httpServer; let mongoose; let models; let env; let tokenA; let tokenB; let userA;

const json = async (res) => ({ status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) });
const get = (url, token) => fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(json);
async function postImage(token, jobId, file = FIXTURE, qrFile = null, confirmedFields = null) {
  const form = new FormData();
  if (jobId) form.append('jobId', jobId);
  form.append('images', new Blob([await fs.readFile(file)], { type: 'image/jpeg' }), 'box.jpg');
  if (qrFile) form.append('qrImage', new Blob([await fs.readFile(qrFile)], { type: 'image/jpeg' }), 'qr.jpg');
  if (confirmedFields) form.append('confirmedFields', JSON.stringify(confirmedFields));
  return fetch(`${base}/verification`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }).then(json);
}

async function previewImage(token, file = FIXTURE, qrFile = null) {
  const form = new FormData();
  form.append('images', new Blob([await fs.readFile(file)], { type: 'image/jpeg' }), 'box.jpg');
  if (qrFile) form.append('qrImage', new Blob([await fs.readFile(qrFile)], { type: 'image/jpeg' }), 'qr.jpg');
  return fetch(`${base}/verification/preview`, {
    method: 'POST',
    headers: { Authorization: ['Bearer', token].join(' ') },
    body: form,
  }).then(json);
}

before(async () => {
  if (skip) return;
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'flow-test-secret-flow-test-secret-1234', MONGO_URI: URI });
  mongoose = (await import('mongoose')).default;
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  models = {
    User: (await import('../models/User.js')).default,
    Medicine: (await import('../models/Medicine.js')).default,
    Batch: (await import('../models/Batch.js')).default,
    ManufacturerQr: (await import('../models/ManufacturerQr.js')).default,
    Scan: (await import('../models/Scan.js')).default,
  };
  env = (await import('../config/env.js')).env;
  const { signToken } = await import('../utils/jwt.js');
  const mk = (email) => models.User.create({ name: email, email, passwordHash: 'x', role: 'user', emailVerified: true });
  userA = await mk('a@example.test');
  const userB = await mk('b@example.test');
  tokenA = signToken({ sub: userA._id, role: 'user' });
  tokenB = signToken({ sub: userB._id, role: 'user' });

  // TEST-ONLY reference records (this database is dropped afterwards). The batch matches what
  // is physically printed on the fixture box, but the dot-matrix print is not machine-readable.
  const medicine = await models.Medicine.create({ medicineName: 'ZOXFER-XT PLUS', manufacturer: 'Zoxvina Biotech Pvt. Ltd.', source: 'seed' });
  await models.Batch.create({ medicineId: medicine._id, batchNumber: 'GT28624F', manufacturingDate: '10/2025', expiryDate: '03/2027', manufacturer: 'Zoxvina Biotech Pvt. Ltd.', status: 'ACTIVE' });
  await models.ManufacturerQr.create({ manufacturer: 'Zoxvina Biotech Pvt. Ltd.', payload: 'https://zoxvinabiotech.com/' });

  const app = (await import('../app.js')).default;
  await new Promise((r) => { httpServer = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${httpServer.address().port}/api`;
});

after(async () => {
  if (skip) return;
  const scans = await models.Scan.find({}, 'imageReferences').lean();
  await Promise.all(scans.flatMap((s) => s.imageReferences || []).map((ref) => fs.unlink(path.join(here, '..', ref)).catch(() => {})));
  await new Promise((r) => httpServer.close(r));
  await (await import('../services/ocrService.js')).shutdownOcrWorker();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('verification workflow (upload -> OCR -> result -> history)', { skip }, () => {
  const jobId = `job-${Date.now()}-flowtest`;
  let scanId;

  test('requires authentication and returns a traceable error envelope', async () => {
    const res = await postImage('not-a-token', null);
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.ok(res.headers.get('x-request-id'), 'X-Request-Id header present');
  });

  test('full flow returns a consistent envelope and never invents a batch number', async () => {
    const res = await postImage(tokenA, jobId, FIXTURE, FIXTURE);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.requestId, res.headers.get('x-request-id'));
    assert.equal(res.body.verificationId, res.body.scan.id, 'verificationId is the id of the saved record');
    scanId = res.body.scan.id;

    const { scan } = res.body;
    assert.equal(scan.imageResults[0].kind, 'medicine');
    assert.equal(scan.imageResults[1].kind, 'qr');
    assert.equal(scan.imageResults[1].ocr, null, 'the dedicated QR photo is not treated as a medicine label');
    assert.equal(scan.imageResults[1].qr.code, 'https://zoxvinabiotech.com/');
    assert.equal(scan.signals.qr.status, 'MANUFACTURER_QR_TRUSTED', 'decoded QR is matched against trusted manufacturer records');
    // Regression: the expiry date MAR-2027 used to be returned as the BATCH number.
    assert.notEqual(scan.batchNumber, 'MAR-2027');
    assert.equal(scan.batchNumber, 'N/A');
    assert.equal(scan.ocr.fieldStatus.batchNumber, 'UNREADABLE');
    assert.equal(scan.ocr.fieldStatus.expiryDate, 'UNREADABLE');
    assert.deepEqual(scan.ocr.unassignedDates.map((d) => d.raw), ['MAR-2027']);
    // Regression for audit defect O1: this box used to come back HIGH_CONFIDENCE.
    assert.equal(scan.verificationStatus, 'NEEDS_REVIEW', 'no batch and no expiry could be read: cannot be verified');
    assert.equal(scan.riskScore, null, 'the score is withheld, not invented');
    assert.equal(scan.riskLevel, 'unknown');
    assert.deepEqual(scan.assessment.missing.map((m) => m.key).sort(), ['batch', 'expiry']);
    assert.equal(scan.assessment.checks.some((c) => c.status === 'MISMATCH'), false, 'unreadable is not a mismatch');
    const codes = scan.assessment.reasons.map((r) => r.code);
    assert.ok(codes.includes('BATCH_UNAVAILABLE') && codes.includes('EXPIRY_UNAVAILABLE'));
    assert.equal(scan.assessment.checks.find((c) => c.key === 'qr').status, 'PASS');
    assert.equal(scan.assessment.checks.find((c) => c.key === 'medicineIdentity').status, 'MATCH');
    assert.match(scan.assessment.explanation, /does not mean (it|the medicine) is fake/i);
  });

  test('review preview exposes OCR fields and confirmed corrections become verification inputs', async () => {
    const preview = await previewImage(tokenA, FIXTURE, FIXTURE);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.success, true);
    assert.ok(Object.hasOwn(preview.body.extracted.fields, 'medicineName'));
    assert.ok(Object.hasOwn(preview.body.extracted.fields, 'expiryDate'));
    assert.equal(preview.body.extracted.images[1].kind, 'qr');
    assert.equal(preview.body.extracted.qrCodes[0], 'https://zoxvinabiotech.com/');

    const correctedName = 'USER CONFIRMED MEDICINE NAME';
    const final = await postImage(tokenA, `job-${Date.now()}-confirm`, FIXTURE, null, { medicineName: correctedName });
    assert.equal(final.status, 201, JSON.stringify(final.body));
    assert.equal(final.body.scan.medicineName, correctedName);
    assert.equal(final.body.scan.ocr.fields.medicineName, correctedName);
    assert.notEqual(final.body.scan.ocr.extractedFields.medicineName, correctedName);
    assert.equal(final.body.scan.ocr.fieldSources.medicineName, 'USER_CONFIRMED');
  });

  test('progress endpoint reports the real, completed job with the saved record id', async () => {
    const res = await get(`/verification/progress/${jobId}`, tokenA);
    assert.equal(res.status, 200);
    assert.equal(res.body.state, 'done');
    assert.equal(res.body.scanId, scanId);
    for (const stage of ['image_received', 'ocr', 'identification', 'batch', 'qr', 'reference', 'duplicate', 'risk', 'result']) {
      assert.equal(res.body.stages[stage], 'done', `stage ${stage}`);
    }
  });

  test("another user cannot read the job's progress, the result, or see it in their history", async () => {
    assert.equal((await get(`/verification/progress/${jobId}`, tokenB)).status, 404);
    assert.equal((await get(`/verification/${scanId}`, tokenB)).status, 403);
    assert.equal((await get(`/scans/${scanId}`, tokenB)).status, 403);
    const history = await get('/scans', tokenB);
    assert.equal(history.body.pagination.total, 0);
    const own = await get('/scans', tokenA);
    assert.equal(own.body.pagination.total, 2);
    assert.equal((await get(`/verification/${scanId}`, tokenA)).status, 200);
  });

  test('resubmitting the same job id is rejected instead of silently restarting', async () => {
    const res = await postImage(tokenA, jobId);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'DUPLICATE_SUBMISSION');
  });

  test('a second concurrent verification for the same user is refused with 409', async () => {
    const [first, second] = await Promise.all([postImage(tokenA, `job-${Date.now()}-c1xxxx`), (async () => { await new Promise((r) => setTimeout(r, 300)); return postImage(tokenA, `job-${Date.now()}-c2xxxx`); })()]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    const refused = first.status === 409 ? first : second;
    assert.equal(refused.body.code, 'VERIFICATION_IN_PROGRESS');
  });

  test('a stuck pipeline times out with 504, marks the job failed, and frees the user', async (t) => {
    const original = env.limits.verificationTimeoutMs;
    env.limits.verificationTimeoutMs = 50;
    t.after(() => { env.limits.verificationTimeoutMs = original; });

    const timeoutJob = `job-${Date.now()}-timeout`;
    const before = await models.Scan.countDocuments();
    const res = await postImage(tokenA, timeoutJob);
    assert.equal(res.status, 504, JSON.stringify(res.body));
    assert.equal(res.body.code, 'VERIFICATION_TIMEOUT');
    assert.equal(res.body.success, false);
    assert.ok(res.body.requestId);

    const progress = await get(`/verification/progress/${timeoutJob}`, tokenA);
    assert.equal(progress.body.state, 'failed');
    assert.equal(progress.body.error.code, 'VERIFICATION_TIMEOUT');
    assert.equal(Object.values(progress.body.stages).includes('failed'), true, 'the stage that was running is marked failed');

    // Give the abandoned pipeline time to hit its abort check; it must not save a record afterwards.
    await new Promise((r) => setTimeout(r, 12_000));
    assert.equal(await models.Scan.countDocuments(), before, 'a timed-out verification must not be persisted late');
    // And the user is not locked out.
    env.limits.verificationTimeoutMs = original;
    const next = await postImage(tokenA, `job-${Date.now()}-after`);
    assert.equal(next.status, 201, JSON.stringify(next.body));
  });
});
