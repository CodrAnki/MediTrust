import { useState } from 'react';
import { Mail } from 'lucide-react';

// There is no mail backend: the form opens the visitor's mail client addressed
// to VITE_CONTACT_EMAIL. If that is not configured the page says so honestly
// instead of pretending a message was sent.
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';

export default function Contact() {
  const [form, setForm] = useState({ name: '', message: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const href = CONTACT_EMAIL
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('MediTrust enquiry')}&body=${encodeURIComponent(`${form.message}\n\n— ${form.name}`)}`
    : null;
  const input = 'w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--color-primary)]';
  return (
    <section className="mx-auto max-w-2xl px-5 py-14 sm:px-6 sm:py-20">
      <h1 className="font-[var(--font-display)] text-[34px] font-semibold tracking-tight text-[var(--color-ink)]">Contact</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">Questions, feedback or reference-data suggestions are welcome.</p>
      {!CONTACT_EMAIL && (
        <p className="mt-5 rounded-xl bg-[var(--color-warning-soft)] px-4 py-3 text-[13px] text-[#9A5F08]">A contact email has not been configured for this deployment yet (set VITE_CONTACT_EMAIL).</p>
      )}
      <div className="mt-6 grid gap-4">
        <input className={input} placeholder="Your name" value={form.name} onChange={set('name')} />
        <textarea className={`${input} min-h-36`} placeholder="Your message" value={form.message} onChange={set('message')} />
        <a
          href={href || undefined}
          aria-disabled={!href}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium text-white ${href ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]' : 'pointer-events-none bg-[var(--color-ink-faint)]'}`}
        >
          <Mail size={16} /> Send via email
        </a>
      </div>
    </section>
  );
}
