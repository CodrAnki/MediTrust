import { whyCards } from '../../data/siteContent.js';

export default function WhyCards() {
  return (
    <section className="border-y border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
        <h2 className="max-w-xl font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[34px]">Why MediTrust</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {whyCards.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--color-primary)] shadow-sm"><Icon size={18} /></span>
              <h3 className="mt-3.5 text-[15px] font-semibold text-[var(--color-ink)]">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-faint)]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
