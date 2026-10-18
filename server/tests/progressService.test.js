import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startJob, setStage, finishJob, getJob, isValidJobId, acquireUserSlot, _resetProgressState } from '../services/progressService.js';

beforeEach(() => _resetProgressState());

describe('progressService', () => {
  test('validates job ids', () => {
    assert.equal(isValidJobId('abc'), false);
    assert.equal(isValidJobId('../../etc/passwd'), false);
    assert.equal(isValidJobId('job-12345678'), true);
  });

  test('a job is private to its owner', () => {
    startJob('job-12345678', 'user-1');
    assert.ok(getJob('job-12345678', 'user-1'));
    assert.equal(getJob('job-12345678', 'user-2'), null);
  });

  test('a repeated job id is reported as a duplicate, not restarted', () => {
    assert.equal(startJob('job-12345678', 'u'), 'started');
    setStage('job-12345678', 'ocr', 'active');
    assert.equal(startJob('job-12345678', 'u'), 'duplicate');
    assert.equal(getJob('job-12345678', 'u').stages.ocr, 'active', 'existing progress is untouched');
    assert.equal(startJob('x', 'u'), 'invalid');
  });

  test('failure marks the running stage failed and exposes a safe error', () => {
    startJob('job-12345678', 'u', 'req-1');
    setStage('job-12345678', 'image_received', 'done');
    setStage('job-12345678', 'ocr', 'active');
    finishJob('job-12345678', { failed: true, error: { code: 'VERIFICATION_TIMEOUT', message: 'too slow' } });
    const job = getJob('job-12345678', 'u');
    assert.equal(job.state, 'failed');
    assert.equal(job.stages.ocr, 'failed');
    assert.equal(job.stages.image_received, 'done');
    assert.deepEqual(job.error, { code: 'VERIFICATION_TIMEOUT', message: 'too slow' });
    assert.equal(job.requestId, 'req-1');
  });

  test('success records the saved result id', () => {
    startJob('job-12345678', 'u');
    finishJob('job-12345678', { scanId: 'abc123' });
    assert.deepEqual([getJob('job-12345678', 'u').state, getJob('job-12345678', 'u').scanId], ['done', 'abc123']);
  });
});

describe('acquireUserSlot', () => {
  test('only one verification per user at a time; others are independent', () => {
    const release = acquireUserSlot('u1');
    assert.equal(typeof release, 'function');
    assert.equal(acquireUserSlot('u1'), null);
    assert.equal(typeof acquireUserSlot('u2'), 'function');
    release();
    assert.equal(typeof acquireUserSlot('u1'), 'function');
  });
  test('a leaked slot expires on its own, so a crash cannot lock a user out', async () => {
    acquireUserSlot('u1', 20);
    assert.equal(acquireUserSlot('u1'), null);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(typeof acquireUserSlot('u1'), 'function');
  });
  test('a stale release cannot free a newer slot', async () => {
    const stale = acquireUserSlot('u1', 20);
    await new Promise((r) => setTimeout(r, 40));
    const fresh = acquireUserSlot('u1');
    stale();
    assert.equal(acquireUserSlot('u1'), null, 'fresh slot is still held');
    fresh();
  });
});
