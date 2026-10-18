import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';

// Real SMTP conversation (nodemailer -> a local SMTP server with authentication).
// This proves our SMTP wiring and credential handling, not delivery by a real provider.
let server; const inbox = [];
before(async () => {
  server = new SMTPServer({
    authOptional: false, allowInsecureAuth: true, disabledCommands: ['STARTTLS'],
    onAuth: (a, s, cb) => (a.username === 'u' && a.password === 'p' ? cb(null, { user: 1 }) : cb(new Error('Invalid login'))),
    onData: async (stream, s, cb) => { inbox.push(await simpleParser(stream)); cb(); },
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
});
after(() => server.close());

const { env } = await import('../config/env.js');
const mail = await import('../services/mailService.js');
const smtp = (over) => Object.assign(env.smtp, { host: '', port: 587, secure: false, user: '', password: '', from: '' }, over);

describe('mailService over real SMTP', () => {
  test('MAIL_NOT_CONFIGURED when SMTP variables are missing', async () => {
    smtp({});
    assert.equal(mail.isMailConfigured(), false);
    await assert.rejects(mail.sendMail({ to: 'a@b.test', subject: 's', text: 't' }), { code: 'MAIL_NOT_CONFIGURED' });
  });

  test('delivers a message with correct credentials', async () => {
    smtp({ host: '127.0.0.1', port: server.server.address().port, user: 'u', password: 'p', from: 'MediTrust <no-reply@meditrust.test>' });
    assert.equal(mail.isMailConfigured(), true);
    await mail.sendMail({ to: 'user@example.test', subject: 'Hello', text: 'body text' });
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].subject, 'Hello');
    assert.equal(inbox[0].to.text, 'user@example.test');
  });

  test('wrong password -> MAIL_SEND_FAILED (EAUTH) without leaking credentials', async () => {
    mail.setMailTransportForTests(null); // drop the transport cached by the previous test
    smtp({ host: '127.0.0.1', port: server.server.address().port, user: 'u', password: 'WRONG-secret-password', from: 'x@y.test' });
    await assert.rejects(mail.sendMail({ to: 'user@example.test', subject: 'x', text: 'y' }), (e) => e.code === 'MAIL_SEND_FAILED' && e.reason === 'EAUTH' && !e.message.includes('WRONG-secret-password'));
  });
});
