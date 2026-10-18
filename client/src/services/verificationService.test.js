import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('./api.js', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
import api from './api.js';
import { previewVerification, runVerification, toVerificationError, VerificationError } from './verificationService.js';

const files = [new File(['x'], 'box.jpg', { type: 'image/jpeg' })];
const axiosError = (status, data = {}, headers = {}) => Object.assign(new Error('Request failed'), { response: { status, data, headers } });
const networkError = (code) => Object.assign(new Error('Network Error'), { code });
const FAST = { pollMs: 5 };

beforeEach(() => { api.post.mockReset(); api.get.mockReset(); });

describe('runVerification', () => {
  test('previews medicine and QR photos before confirmation', async () => {
    const extracted = { fields: { medicineName: 'Example' }, images: [] };
    api.post.mockResolvedValue({ data: { success: true, extracted } });
    const qrFile = new File(['qr'], 'medicine-qr.jpg', { type: 'image/jpeg' });
    await expect(previewVerification(files, { qrFile })).resolves.toEqual(extracted);
    const [url, form, config] = api.post.mock.calls[0];
    expect(url).toBe('/verification/preview');
    expect(form.getAll('images')).toHaveLength(1);
    expect(form.get('qrImage')).toBe(qrFile);
    expect(config.timeout).toBeGreaterThan(100_000);
  });

  test('returns the saved record and forwards REAL stage changes from the server', async () => {
    api.post.mockImplementation(async (_url, _form, config) => {
      config.onUploadProgress({ loaded: 10, total: 10 });
      await new Promise((r) => setTimeout(r, 30));
      return { data: { success: true, scan: { id: 'scan-1' } } };
    });
    api.get.mockResolvedValue({ data: { state: 'running', stages: { image_received: 'done', ocr: 'active' } } });

    const events = [];
    const scan = await runVerification(files, { ...FAST, onStepChange: (stage, status) => events.push(`${stage}:${status}`) });

    expect(scan.id).toBe('scan-1');
    expect(events).toContain('image_received:active'); // the upload itself is genuinely in progress
    expect(events).toContain('image_received:done');
    expect(events).toContain('ocr:active');
  });

  test('posts the job id and the images to /verification with a bounded timeout', async () => {
    api.post.mockResolvedValue({ data: { scan: { id: 's' } } });
    api.get.mockResolvedValue({ data: { stages: {} } });
    await runVerification(files, FAST);
    const [url, form, config] = api.post.mock.calls[0];
    expect(url).toBe('/verification');
    expect(form.get('jobId')).toMatch(/.{8,}/);
    expect(form.getAll('images')).toHaveLength(1);
    expect(config.timeout).toBeGreaterThan(100_000); // longer than the server's own deadline
  });

  test('uploads the separate QR photo using its dedicated multipart field', async () => {
    api.post.mockResolvedValue({ data: { scan: { id: 's' } } });
    api.get.mockResolvedValue({ data: { stages: {} } });
    const qrFile = new File(['qr'], 'medicine-qr.jpg', { type: 'image/jpeg' });
    await runVerification(files, { ...FAST, qrFile });
    const form = api.post.mock.calls[0][1];
    expect(form.getAll('images')).toHaveLength(1);
    expect(form.get('qrImage')).toBe(qrFile);
  });

  test('sends the user-confirmed fields with the final verification', async () => {
    api.post.mockResolvedValue({ data: { scan: { id: 's' } } });
    api.get.mockResolvedValue({ data: { stages: {} } });
    const confirmedFields = { medicineName: 'Corrected name' };
    await runVerification(files, { ...FAST, confirmedFields });
    const form = api.post.mock.calls[0][1];
    expect(JSON.parse(form.get('confirmedFields'))).toEqual(confirmedFields);
  });

  test('an incomplete server response is an error, not a blank result page', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    api.get.mockResolvedValue({ data: { stages: {} } });
    await expect(runVerification(files, FAST)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  test('a rate-limited progress poll never fails the verification', async () => {
    api.post.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 40)); return { data: { scan: { id: 'scan-2' } } }; });
    api.get.mockRejectedValue(axiosError(429, { code: 'PROGRESS_RATE_LIMITED' }, { 'retry-after': '1' }));
    await expect(runVerification(files, FAST)).resolves.toMatchObject({ id: 'scan-2' });
  });

  test('stops polling once the request has finished', async () => {
    api.post.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 30)); return { data: { scan: { id: 's' } } }; });
    api.get.mockResolvedValue({ data: { stages: {} } });
    await runVerification(files, FAST);
    const callsAtFinish = api.get.mock.calls.length;
    await new Promise((r) => setTimeout(r, 60));
    expect(api.get.mock.calls.length).toBe(callsAtFinish);
  });

  test('RECOVERS when the response was lost but the server finished and saved the result', async () => {
    api.post.mockRejectedValue(networkError('ECONNABORTED'));
    api.get.mockImplementation(async (url) => {
      if (url.startsWith('/verification/progress/')) return { data: { state: 'done', scanId: 'saved-9', stages: { result: 'done' } } };
      if (url === '/verification/saved-9') return { data: { scan: { id: 'saved-9' } } };
      throw new Error(`unexpected ${url}`);
    });
    await expect(runVerification(files, FAST)).resolves.toMatchObject({ id: 'saved-9' });
  });

  test('a lost response with no finished job reports a retryable network error and marks the running step failed', async () => {
    api.post.mockRejectedValue(networkError('ERR_NETWORK'));
    api.get.mockResolvedValue({ data: { state: 'running', stages: { ocr: 'active' } } });
    const events = [];
    const error = await runVerification(files, { ...FAST, onStepChange: (s, st) => events.push(`${s}:${st}`) }).catch((e) => e);
    expect(error).toBeInstanceOf(VerificationError);
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    expect(events).toContain('ocr:failed');
  });

  test('a server timeout (504) keeps the trace id and is retryable', async () => {
    api.post.mockRejectedValue(axiosError(504, { code: 'VERIFICATION_TIMEOUT', message: 'Verification took too long and was stopped.', requestId: 'req-123' }));
    api.get.mockResolvedValue({ data: { state: 'failed', stages: { ocr: 'failed' } } });
    const error = await runVerification(files, FAST).catch((e) => e);
    expect(error).toMatchObject({ code: 'VERIFICATION_TIMEOUT', status: 504, requestId: 'req-123', retryable: true });
  });
});

describe('toVerificationError', () => {
  test.each([
    [401, false, /session has expired/i],
    [400, false, /clearer photo/i],
    [413, false, /too large/i],
    [409, true, /already running/i],
    [429, true, /too many/i],
    [503, true, /temporarily unavailable/i],
    [500, true, /server ran into a problem/i],
  ])('HTTP %i -> retryable=%s', (status, retryable, message) => {
    const error = toVerificationError(axiosError(status));
    expect(error.retryable).toBe(retryable);
    expect(error.message).toMatch(message);
  });

  test('5xx never forwards server internals to the user', () => {
    const error = toVerificationError(axiosError(500, { message: 'MongoServerError: auth failed for user admin' }));
    expect(error.message).not.toMatch(/mongo|admin/i);
  });

  test('a client-side timeout is explained without claiming the verification failed', () => {
    const error = toVerificationError(networkError('ECONNABORTED'));
    expect(error.code).toBe('CLIENT_TIMEOUT');
    expect(error.message).toMatch(/may still be processing/i);
  });
});
