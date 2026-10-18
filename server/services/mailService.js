import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Thin mail abstraction. Credentials come only from server/.env (config/env.js),
// are used only to open the SMTP connection, and are never logged or returned.
//
// Error codes (thrown as MailError):
//   MAIL_NOT_CONFIGURED  SMTP_HOST / SMTP_USER / SMTP_PASSWORD / SMTP_FROM missing
//   MAIL_SEND_FAILED     the SMTP server rejected or could not be reached

export class MailError extends Error {
  constructor(code, message, reason) {
    super(message);
    this.name = 'MailError';
    this.code = code;
    this.reason = reason; // short, non-secret technical hint (e.g. EAUTH, ECONNECTION)
  }
}

export function isMailConfigured(smtp = env.smtp) {
  return Boolean(smtp.host && smtp.user && smtp.password && smtp.from);
}

let transport = null;
let transportOverride = null;

/** Test hook: inject a nodemailer-compatible transport (e.g. a capturing fake). */
export function setMailTransportForTests(t) { transportOverride = t; transport = null; }

function getTransport() {
  if (transportOverride) return transportOverride;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text, html }) {
  if (!transportOverride && !isMailConfigured()) {
    throw new MailError('MAIL_NOT_CONFIGURED', 'Email is not configured on this server.');
  }
  try {
    await getTransport().sendMail({ from: env.smtp.from || 'no-reply@localhost', to, subject, text, html });
  } catch (err) {
    // Log only the technical reason, never the message body (it contains the OTP) or credentials.
    // eslint-disable-next-line no-console
    console.error(`[Mail] send failed: ${err?.code || 'UNKNOWN'}${err?.responseCode ? ` (SMTP ${err.responseCode})` : ''}`);
    throw new MailError('MAIL_SEND_FAILED', 'The verification email could not be sent. Please try again shortly.', err?.code || 'UNKNOWN');
  }
}
