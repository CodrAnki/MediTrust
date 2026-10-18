import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Token payload is deliberately minimal: { sub: userId, role }. No password, OTP,
// API key or other personal data ever goes into a JWT. Authorization still
// re-reads the user (and role) from the database on every request
// (middleware/authMiddleware.js), so the `role` claim is informational only.
const ALGORITHM = 'HS256';

export function signToken({ sub, role }) {
  return jwt.sign({ role }, env.jwtSecret, { subject: String(sub), algorithm: ALGORITHM, expiresIn: env.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] }); // pins the algorithm: no "alg: none"
}
