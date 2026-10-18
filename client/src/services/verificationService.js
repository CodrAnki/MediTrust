import api from './api.js';

// Real progress: the server records each pipeline stage as it actually starts
// and finishes (server/services/progressService.js). While the single
// verification request is in flight we poll that state and forward every
// change to the UI. There are no timers pretending work is happening.

const DEFAULT_POLL_MS = 700;
const MAX_POLL_MS = 5000;
// Must be longer than the server's own pipeline deadline (VERIFICATION_TIMEOUT_MS, 150 s by
// default) so the server's clear 504 message arrives instead of a client-side abort.
const UPLOAD_TIMEOUT_MS = Number(import.meta.env.VITE_VERIFY_TIMEOUT_MS) || 180_000;

function makeJobId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** An error whose message is safe to show to the person using the app. */
export class VerificationError extends Error {
  constructor(message, { code = 'PROCESSING_FAILED', status = null, requestId = null, retryable = true } = {}) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

/** Maps any failure of the verification request to a VerificationError with a useful, non-technical message. */
export function toVerificationError(err) {
  if (err instanceof VerificationError) return err;
  const status = err?.response?.status ?? null;
  const data = err?.response?.data || {};
  const meta = { status, code: data.code, requestId: data.requestId || err?.response?.headers?.['x-request-id'] || null };
  const serverMessage = typeof data.message === 'string' ? data.message : null;

  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') console.error('[Verification] request failed:', status, data, err); // eslint-disable-line no-console

  if (!err?.response) {
    if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
      return new VerificationError('The server took too long to respond. Your photos may still be processing — please try again in a moment.', { ...meta, code: 'CLIENT_TIMEOUT' });
    }
    if (err?.code === 'ERR_CANCELED') return new VerificationError('Verification was cancelled.', { ...meta, code: 'CANCELLED', retryable: true });
    return new VerificationError("Couldn't reach the server. Please check your connection and try again.", { ...meta, code: 'NETWORK_ERROR' });
  }
  switch (status) {
    case 400: return new VerificationError(serverMessage || 'This image could not be processed. Please try a clearer photo.', { ...meta, retryable: false });
    case 401: return new VerificationError('Your session has expired. Please log in again to verify this medicine.', { ...meta, code: 'UNAUTHORIZED', retryable: false });
    case 409: return new VerificationError(serverMessage || 'A verification is already running. Please wait for it to finish.', meta);
    case 413: return new VerificationError('One of the images is too large. Please use images under 10 MB.', { ...meta, code: 'FILE_TOO_LARGE', retryable: false });
    case 429: return new VerificationError(serverMessage || 'Too many requests. Please wait a minute and try again.', { ...meta, code: meta.code || 'RATE_LIMITED' });
    case 503: return new VerificationError(serverMessage || 'Text extraction is temporarily unavailable. Please try again in a moment.', meta);
    case 504: return new VerificationError(serverMessage || 'Verification took too long. Please try again with clearer or fewer photos.', { ...meta, code: 'VERIFICATION_TIMEOUT' });
    default:
      return new VerificationError(
        status >= 500 ? 'The server ran into a problem while verifying this image. Please try again in a moment.' : serverMessage || 'Something went wrong while verifying this image.',
        meta,
      );
  }
}

export async function previewVerification(imageFiles, { qrFile, signal } = {}) {
  const formData = new FormData();
  imageFiles.forEach((file) => formData.append('images', file));
  if (qrFile) formData.append('qrImage', qrFile);
  try {
    const { data } = await api.post('/verification/preview', formData, {
      timeout: UPLOAD_TIMEOUT_MS,
      signal,
    });
    if (!data?.extracted?.fields) {
      throw new VerificationError('The server could not return the extracted medicine fields. Please try again.', { code: 'BAD_PREVIEW_RESPONSE' });
    }
    return data.extracted;
  } catch (err) {
    throw toVerificationError(err);
  }
}

/**
 * @param {File[]} imageFiles
 * @param {{
 *   onStepChange?: (stepId: string, status: 'active'|'done'|'skipped'|'failed') => void,
 *   signal?: AbortSignal,
 *   pollMs?: number,
 *   qrFile?: File,
 * }} options
 * @returns the saved verification record (`scan`) — guaranteed to have an `id`.
 */
export async function runVerification(imageFiles, { onStepChange, signal, pollMs = DEFAULT_POLL_MS, qrFile, confirmedFields } = {}) {
  const jobId = makeJobId();
  const formData = new FormData();
  formData.append('jobId', jobId);
  imageFiles.forEach((file) => formData.append('images', file));
  if (qrFile) formData.append('qrImage', qrFile);
  if (confirmedFields) formData.append('confirmedFields', JSON.stringify(confirmedFields));

  const seen = {};
  const emit = (stage, status) => {
    if (seen[stage] === status) return;
    seen[stage] = status;
    onStepChange?.(stage, status);
  };

  let stopped = false;
  let delay = pollMs;

  // Best-effort: progress is advisory, the POST itself is authoritative.
  const sync = async () => {
    try {
      const { data } = await api.get(`/verification/progress/${jobId}`, { timeout: 10_000 });
      Object.entries(data.stages || {}).forEach(([stage, status]) => emit(stage, status));
      delay = pollMs;
      return data;
    } catch (err) {
      if (err?.response?.status === 429) {
        // Back off (honouring Retry-After) instead of hammering a limited endpoint.
        const retryAfter = Number(err.response.headers?.['retry-after']);
        delay = Math.min(MAX_POLL_MS, retryAfter > 0 ? retryAfter * 1000 : delay * 2);
      }
      return null;
    }
  };

  // A chained timeout (not setInterval) so polls never overlap and the delay can grow.
  let timer = null;
  const tick = async () => {
    if (stopped) return;
    await sync();
    if (!stopped) timer = setTimeout(tick, delay);
  };

  emit('image_received', 'active'); // the upload really is in progress at this point
  timer = setTimeout(tick, pollMs);
  try {
    const { data } = await api.post('/verification', formData, {
      timeout: UPLOAD_TIMEOUT_MS,
      signal,
      onUploadProgress: (event) => { if (event.total && event.loaded >= event.total) emit('image_received', 'done'); },
    });
    stopped = true;
    clearTimeout(timer);
    await sync(); // pick up the final state
    const scan = data?.scan;
    if (!scan?.id) {
      throw new VerificationError('The server returned an incomplete result. Please try again.', { code: 'BAD_RESPONSE', requestId: data?.requestId || null });
    }
    return scan;
  } catch (err) {
    stopped = true;
    clearTimeout(timer);

    // The response may have been lost (dropped connection, client timeout) AFTER the server
    // finished and saved the result. Ask the server before telling the user it failed.
    if (!err?.response && err?.code !== 'ERR_CANCELED' && !(err instanceof VerificationError)) {
      const job = await sync();
      if (job?.state === 'done' && job.scanId) {
        try {
          const { data } = await api.get(`/verification/${job.scanId}`);
          if (data?.scan?.id) return data.scan;
        } catch { /* fall through to the error below */ }
      }
    } else {
      await sync();
    }
    Object.entries(seen).forEach(([stage, status]) => { if (status === 'active') onStepChange?.(stage, 'failed'); });
    throw toVerificationError(err);
  }
}
