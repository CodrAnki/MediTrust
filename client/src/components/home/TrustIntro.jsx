import { ShieldCheck, Layers, FileSearch } from 'lucide-react';

const items = [
  { icon: Layers, title: 'Layered, not single-signal', text: 'No single check decides the outcome. Every available signal contributes to one assessment.' },
  { icon: FileSearch, title: 'Evidence you can read', text: 'Each result lists what matched, what did not, and what could not be checked.' },
  { icon: ShieldCheck, title: 'Honest about uncertainty', text: 'Missing data is reported as missing — an unknown medicine is never automatically called fake.' },
];

export default function TrustIntro() {
  return (
    <section className="border-y border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 lg:px-8">
        <p className="max-w-3xl text-[17px] leading-relaxed text-[var(--color-ink-soft)]">
          MediTrust is a multi-layer medicine verification platform designed to
          assist users in assessing medicine authenticity risk using available
          digital and visual evidence.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {items.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-[14.5px] font-semibold text-[var(--color-ink)]">{title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--color-ink-faint)]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
