// Wraps an async Express handler so rejected promises are forwarded to
// the error-handling middleware instead of crashing the process.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
