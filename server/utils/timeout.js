// Small, dependency-free helpers for bounding asynchronous work.

export class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    this.status = 504;
    this.label = label;
    this.timeoutMs = ms;
  }
}

/**
 * Rejects with TimeoutError if `promise` has not settled within `ms`.
 * The underlying work is NOT cancelled (JavaScript cannot do that generically),
 * so callers that own a cancellable resource should release it in `onTimeout`.
 * A late rejection of the losing promise is swallowed so it cannot surface as
 * an unhandled rejection.
 */
export function withTimeout(promise, ms, label = 'Operation', onTimeout) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve(promise);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try { onTimeout?.(); } catch { /* best-effort cleanup */ }
      reject(new TimeoutError(label, ms));
    }, ms);
  });
  const guarded = Promise.resolve(promise);
  guarded.catch(() => {});
  return Promise.race([guarded, timeout]).finally(() => clearTimeout(timer));
}
