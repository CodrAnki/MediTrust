import { randomUUID } from 'node:crypto';

// Every request gets a traceable id. A client-supplied X-Request-Id is honoured
// only if it is a short, safe token (it ends up in logs and response headers).
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId(req, res, next) {
  const supplied = req.get('x-request-id');
  req.id = supplied && SAFE_ID.test(supplied) ? supplied : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
