import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, TimeoutError } from '../utils/timeout.js';

describe('withTimeout', () => {
  test('resolves with the value when fast enough', async () => {
    assert.equal(await withTimeout(Promise.resolve(42), 100, 'x'), 42);
  });
  test('rejects with TimeoutError (status 504) when too slow, and runs the cleanup hook', async () => {
    let cleaned = false;
    await assert.rejects(
      withTimeout(new Promise(() => {}), 20, 'OCR', () => { cleaned = true; }),
      (err) => err instanceof TimeoutError && err.status === 504 && /OCR timed out after 20ms/.test(err.message),
    );
    assert.equal(cleaned, true);
  });
  test('propagates the original rejection', async () => {
    await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 100), /boom/);
  });
  test('a late rejection after the timeout does not become an unhandled rejection', async () => {
    let rejectLate;
    const slow = new Promise((_, rej) => { rejectLate = rej; });
    await assert.rejects(withTimeout(slow, 10), TimeoutError);
    rejectLate(new Error('late'));
    await new Promise((r) => setTimeout(r, 20)); // would crash the test run if unhandled
  });
});
