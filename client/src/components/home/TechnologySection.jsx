import { technologyLayers } from '../../data/siteContent.js';

export default function TechnologySection() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-6 lg:px-8">
      <div className="max-w-[620px]">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">Verification layers</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[34px]">
          Multi-Layer Verification Technology
        </h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--color-ink-soft)]">
          No single signal independently guarantees authenticity. MediTrust
          combines independent layers so that one missing detail does not decide
          the outcome — and one agreeable signal cannot hide a conflicting one.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {technologyLayers.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 transition-colors hover:border-[var(--color-primary)]/40">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Icon size={18} /></span>
              <span className="font-[var(--font-mono)] text-[11.5px] text-[var(--color-ink-faint)]">L{i + 1}</span>
            </div>
            <h3 className="mt-3.5 text-[15px] font-semibold text-[var(--color-ink)]">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-faint)]">{text}</p>
          </div>
        ))}
        <div className="flex flex-col justify-center rounded-2xl bg-[var(--color-ink)] p-6 text-white">
          <p className="font-[var(--font-display)] text-[20px] font-semibold leading-tight">Combined, never absolute</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            Every result is a multi-signal risk assessment with the evidence shown — not a guarantee of authenticity.
          </p>
        </div>
      </div>
    </section>
  );
}
