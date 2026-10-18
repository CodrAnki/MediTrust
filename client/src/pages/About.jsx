import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { technologyLayers } from '../data/siteContent.js';

export default function About() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-5 pb-6 pt-14 sm:px-6 sm:pt-20">
        <h1 className="font-[var(--font-display)] text-[36px] font-semibold leading-[1.1] tracking-tight text-[var(--color-ink)] sm:text-[44px]">About MediTrust</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-[var(--color-ink-soft)]">
          MediTrust is a multi-layer medicine verification platform designed to assist users in assessing medicine authenticity risk using available digital and visual evidence.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-8 sm:px-6">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">The layers</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {technologyLayers.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3.5 rounded-2xl border border-[var(--color-border)] bg-white p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Icon size={18} /></span>
              <div>
                <p className="text-[14.5px] font-semibold text-[var(--color-ink)]">{title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-faint)]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-8 sm:px-6">
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/50 p-6">
          <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">Responsible use</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--color-ink-soft)]">
            MediTrust provides a technology-assisted verification assessment based on available evidence. Results should not replace professional medical advice or official regulatory verification. No single detail proves a medicine is genuine or counterfeit on its own — a legitimate photo can be blurry, and a counterfeit can copy a real batch number.
          </p>
        </div>
        <Link to="/verify" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-3 text-[15px] font-medium text-white hover:bg-[var(--color-primary-dark)]">
          <ScanLine size={17} /> Verify Medicine
        </Link>
      </section>
    </>
  );
}
