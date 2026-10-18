// Real, server-side verification progress. The verification controller calls
// setStage() as each pipeline stage ACTUALLY starts/finishes, and the client
// polls GET /api/verification/progress/:jobId. Nothing here is simulated.
export const STAGES = [
  'image_received', 'ocr', 'identification', 'reference', 'qr', 'batch', 'duplicate', 'risk', 'result',
];

const jobs = new Map();
const TTL_MS = 15 * 60 * 1000;

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, job] of jobs) if (job.updatedAt < cutoff) jobs.delete(id);
}

const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;
export function isValidJobId(id) { return typeof id === 'string' && VALID_ID.test(id); }

/**
 * @returns {'started'|'duplicate'|'invalid'}
 *   'duplicate' means this job id is already known (a double submit or replayed
 *   request); the caller must refuse rather than silently restart the job.
 */
export function startJob(jobId, userId, requestId = null) {
  if (!isValidJobId(jobId)) return 'invalid';
  sweep();
  if (jobs.has(jobId)) return 'duplicate';
  jobs.set(jobId, {
    userId: String(userId), requestId, stages: {}, current: null, state: 'running', scanId: null, error: null, updatedAt: Date.now(),
  });
  return 'started';
}

// status: 'active' | 'done' | 'skipped' | 'failed'
export function setStage(jobId, stage, status, note) {
  const job = jobId && jobs.get(jobId);
  if (!job) return;
  job.stages[stage] = note ? { status, note } : { status };
  if (status === 'active') job.current = stage;
  job.updatedAt = Date.now();
}

export function finishJob(jobId, { scanId = null, failed = false, error = null } = {}) {
  const job = jobId && jobs.get(jobId);
  if (!job) return;
  job.state = failed ? 'failed' : 'done';
  job.scanId = scanId ? String(scanId) : null;
  if (failed) {
    // The stage that was running when the failure happened is marked failed, so
    // the UI can show WHERE it stopped instead of an endless spinner.
    if (job.current && job.stages[job.current]?.status === 'active') job.stages[job.current] = { status: 'failed' };
    job.error = error ? { code: String(error.code || 'PROCESSING_FAILED'), message: String(error.message || 'Verification failed.') } : { code: 'PROCESSING_FAILED', message: 'Verification failed.' };
  }
  job.updatedAt = Date.now();
}

export function getJob(jobId, userId) {
  const job = jobs.get(jobId);
  if (!job || job.userId !== String(userId)) return null;
  const stages = Object.fromEntries(Object.entries(job.stages).map(([k, v]) => [k, v.status]));
  const notes = Object.fromEntries(Object.entries(job.stages).filter(([, v]) => v.note).map(([k, v]) => [k, v.note]));
  return { success: true, state: job.state, scanId: job.scanId, stages, notes, error: job.error, requestId: job.requestId };
}

// --- One verification at a time per user -------------------------------------
// OCR is CPU-heavy and serialised through one worker. Letting one user stack
// parallel verifications (double click, second tab, retry while the first is
// still running) only makes every one of them slower and risks racing writes.
// Slots expire on their own so a crash can never lock a user out.
const slots = new Map(); // userId -> expiry timestamp
const SLOT_TTL_MS = 5 * 60 * 1000;

/** @returns {(() => void)|null} release function, or null if the user already has an active verification. */
export function acquireUserSlot(userId, ttlMs = SLOT_TTL_MS) {
  const key = String(userId);
  const existing = slots.get(key);
  if (existing && existing > Date.now()) return null;
  const token = Date.now() + ttlMs;
  slots.set(key, token);
  return () => { if (slots.get(key) === token) slots.delete(key); };
}

// Test helper.
export function _resetProgressState() { jobs.clear(); slots.clear(); }
