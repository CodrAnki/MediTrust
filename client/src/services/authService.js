import api from './api.js';

// Backend routes:
//   POST /api/auth/register      -> creates an UNVERIFIED account and emails a 6-digit code (no token yet)
//   POST /api/auth/verify-email  -> confirms the code, returns { token, user }
//   POST /api/auth/resend-otp    -> emails a new code (60s cooldown)
//   POST /api/auth/login         -> { token, user }, or 403 EMAIL_NOT_VERIFIED
//   GET  /api/auth/me

export async function registerUser({ name, email, password }) {
  const { data } = await api.post('/auth/register', { name, email, password });
  return data; // { requiresEmailVerification, email, resendAvailableInSeconds, ... }
}

export async function verifyEmailRequest({ email, otp }) {
  const { data } = await api.post('/auth/verify-email', { email, otp });
  return data; // { token, user }
}

export async function resendOtpRequest({ email }) {
  const { data } = await api.post('/auth/resend-otp', { email });
  return data;
}

export async function loginUser({ email, password }) {
  const { data } = await api.post('/auth/login', { email, password });
  return data; // expected shape: { token, user }
}

export async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data; // expected shape: { user }
}

// Admin sign-in uses its own endpoint, which only accepts active admin accounts.
export async function adminLoginRequest({ email, password }) {
  const { data } = await api.post('/admin/auth/login', { email, password });
  return data; // { success, token, user }
}

export async function adminLogoutRequest() {
  try { await api.post('/admin/auth/logout'); } catch { /* best effort: token is discarded locally regardless */ }
}
