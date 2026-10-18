export function notFound(req, res) {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}`, requestId: req.id });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Every error response carries { success:false, code, message, requestId } so a
  // user-reported failure can be traced to a log line.
  const fail = (status, code, message) => res.status(status).json({ success: false, code, message, requestId: req.id });

  // Multer upload errors (file too large, wrong field name, etc.)
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is larger than 10MB. Please upload a smaller file.'
        : err.message;
    return fail(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_REJECTED', message);
  }

  // MongoDB duplicate key (e.g. two concurrent registrations with the same
  // email racing past the existence check in the controller).
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const message = field && field !== 'email' ? `A record with this ${field} already exists.` : 'An account with this email already exists.';
    return fail(409, 'DUPLICATE', message);
  }

  // Mongoose validation errors (schema `required`/`enum`/etc. failing).
  if (err.name === 'ValidationError') {
    const firstMessage = Object.values(err.errors)[0]?.message || 'Invalid input.';
    return fail(400, 'VALIDATION_ERROR', firstMessage);
  }

  // Malformed MongoDB ObjectId (e.g. a garbage :id in a route param).
  if (err.name === 'CastError') {
    return fail(400, 'INVALID_ID', 'Invalid identifier.');
  }

  const status = err.status || 500;

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[error] requestId=${req.id}`, err);
  }

  // Never expose stack traces, URIs or internals to clients.
  const code = err.code && typeof err.code === 'string' && /^[A-Z_]+$/.test(err.code) ? err.code : (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');
  fail(status, code, status >= 500 && status !== 504 ? 'Something went wrong. Please try again.' : err.message);
}
