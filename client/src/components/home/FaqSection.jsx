import { ChevronDown } from 'lucide-react';
import { faqs } from '../../data/siteContent.js';

export default function FaqSection({ heading = 'Frequently asked questions' }) {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20 sm:px-6">
      <h2 className="font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[34px]">{heading}</h2>
      <div className="mt-8 flex flex-col gap-3">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-[var(--color-border)] bg-white p-5 open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-[var(--color-ink)]">
              {f.q}
              <ChevronDown size={18} className="shrink-0 text-[var(--color-ink-faint)] transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
