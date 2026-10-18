import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiLimiter, createProgressLimiter, createVerificationLimiter } from '../middleware/rateLimiter.js';
import { requestId } from '../middleware/requestId.js';
import { notFound, errorHandler } from '../middleware/errorHandler.js';

let server; let base;
before(async () => {
  const app = express();
  app.use(requestId);
  // Tiny limits so the regression is observable: the old limiter had no exemption for progress polling.
  app.use('/api', createApiLimiter({ limit: 3 }));
  app.get('/api/verification/progress/:id', createProgressLimiter({ limit: 5 }), (req, res) => res.json({ ok: true }));
  app.get('/api/other', (req, res) => res.json({ ok: true }));
  app.post('/api/verify', createVerificationLimiter({ limit: 1 }), (req, res) => res.json({ ok: true }));
  app.get('/boom', () => { throw new Error('secret internal detail: mongodb://user:pass@host'); });
  app.get('/timeout', () => { throw Object.assign(new Error('Verification took too long.'), { status: 504, code: 'VERIFICATION_TIMEOUT' }); });
  app.use(notFound);
  app.use(errorHandler);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));

const hit = async (p, init) => { const res = await fetch(base + p, init); return { status: res.status, headers: res.headers, body: await res.json() }; };

describe('rate limiting', () => {
  test('progress polling is NOT counted against the general API limit (regression)', async () => {
    // 5 polls is more than the general limit of 3. Before the fix the 4th would be a 429.
    for (let i = 0; i < 5; i += 1) assert.equal((await hit('/api/verification/progress/job-12345678')).status, 200, `poll ${i + 1}`);
    // ...and the general budget is still intact for real API calls.
    assert.equal((await hit('/api/other')).status, 200);
  });
  test('progress polling has its own ceiling, with the standard envelope', async () => {
    const res = await hit('/api/verification/progress/job-12345678'); // 6th poll, limit 5
    assert.equal(res.status, 429);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'PROGRESS_RATE_LIMITED');
    assert.ok(res.body.requestId);
  });
  test('the general limit still applies to ordinary routes', async () => {
    await hit('/api/other'); await hit('/api/other');
    const res = await hit('/api/other');
    assert.equal(res.status, 429);
    assert.equal(res.body.code, 'RATE_LIMITED');
  });
});

describe('error envelope', () => {
  test('every error carries success:false, code, message and the same request id as the header', async () => {
    const res = await hit('/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'NOT_FOUND');
    assert.equal(res.body.requestId, res.headers.get('x-request-id'));
  });
  test('a client-supplied X-Request-Id is honoured only if it is a safe token', async () => {
    const good = await hit('/nope', { headers: { 'X-Request-Id': 'trace-abc-12345' } });
    assert.equal(good.body.requestId, 'trace-abc-12345');
    const bad = await hit('/nope', { headers: { 'X-Request-Id': 'bad id\twith spaces <script>' } });
    assert.notEqual(bad.body.requestId, 'bad id\twith spaces <script>');
  });
  test('5xx responses never leak internal details', async () => {
    const res = await hit('/boom');
    assert.equal(res.status, 500);
    assert.equal(res.body.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(JSON.stringify(res.body), /mongodb|secret|pass/);
  });
  test('a deliberate timeout keeps its status, code and user-safe message', async () => {
    const res = await hit('/timeout');
    assert.equal(res.status, 504);
    assert.equal(res.body.code, 'VERIFICATION_TIMEOUT');
    assert.match(res.body.message, /too long/);
  });
});
