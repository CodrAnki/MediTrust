import { verifyToken } from '../utils/jwt.js';
import { findById, toSafeUser } from '../services/userService.js';

// Verifies the Bearer token and attaches the authenticated user to req.user.
// Any route behind this middleware can assume req.user is present.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
  }

  try {
    const payload = verifyToken(token);
    const user = await findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid. Please log in again.' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
    }
    req.user = toSafeUser(user);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }
}

// Use after requireAuth. Restricts a route to a specific role (e.g. admin).
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ success: false, message: 'You do not have access to this resource.' });
    }
    return next();
  };
}

// Admin-only guard for every /api/admin route (except login). Authorization is
// always enforced here on the server — frontend route guards are cosmetic.
export const requireAdmin = [requireAuth, requireRole('admin')];
