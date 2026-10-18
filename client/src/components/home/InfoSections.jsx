import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { privacyPoints } from '../../data/siteContent.js';

export function EvidenceSection() {
  const good = ['Medicine name matched', 'Manufacturer matched', 'Packaging similarity: 91%', 'Batch found', 'QR code matched', 'No duplicate detected'];
  const warn = ['Reference unavailable', 'QR not detected', 'Batch not found'];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">Evidence-based results</p>
          <h2 className="mt-2 font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[34px]">Not just green or red — the reasons why</h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--color-ink-soft)]">
            Every result shows the verification status, risk level and the individual signals behind it, so you can see what was confirmed, what conflicted and what simply could not be checked.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Example signal list (illustrative)</p>
          <ul className="mt-4 grid gap-2 text-[13.5px] text-[var(--color-ink-soft)]">
            {good.map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--color-verified)]" />{t}</li>)}
            {warn.map((t) => <li key={t} className="flex items-center gap-2"><AlertTriangle size={16} className="text-[var(--color-warning)]" />{t}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function SecuritySection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
      <h2 className="font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[34px]">Security &amp; Privacy</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {privacyPoints.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]"><Icon size={18} /></span>
            <h3 className="mt-3.5 text-[15px] font-semibold text-[var(--color-ink)]">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-faint)]">{text}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[13px] text-[var(--color-ink-faint)]">See the <Link to="/privacy" className="text-[var(--color-primary)] underline">Privacy notice</Link> for details.</p>
    </section>
  );
}
