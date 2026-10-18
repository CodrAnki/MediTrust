import { Link } from 'react-router-dom';
import { ScanLine, ArrowRight, Info } from 'lucide-react';
import { resultOutcomes } from '../data/howItWorksSteps.js';
import { riskLevels } from '../data/verificationSignals.js';
import RiskBadge from '../components/verify/RiskBadge.jsx';
import PipelineSection from '../components/home/PipelineSection.jsx';

export default function HowItWorks() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-2 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <h1 className="max-w-2xl font-[var(--font-display)] text-[36px] font-semibold leading-[1.1] tracking-tight text-[var(--color-ink)] sm:text-[46px]">
          How MediTrust verifies a medicine
        </h1>
        <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-[var(--color-ink-soft)]">
          Every scan runs through the same connected pipeline — OCR, medicine identification, reference packaging, QR/barcode, batch validation, duplicate detection and the risk engine — and ends with a result plus the evidence behind it.
        </p>
      </section>

      <PipelineSection detailed showLink={false} />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
        <h2 className="font-[var(--font-display)] text-[28px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[32px]">Possible results</h2>
        <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          The result is produced by the backend risk engine — the website never invents or upgrades it. When evidence is insufficient the result says so instead of guessing.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {resultOutcomes.map((o) => (
            <div key={o.key} className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
              <RiskBadge color={o.color}>{o.label}</RiskBadge>
              <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-faint)]">{o.description}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-12 text-[16px] font-semibold text-[var(--color-ink)]">Risk levels (default ranges)</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {riskLevels.map((l) => (
            <div key={l.key} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              <RiskBadge color={l.color}>{l.label}</RiskBadge>
              <p className="mt-2 font-[var(--font-mono)] text-[12px] text-[var(--color-ink-faint)]">Score {l.range}</p>
              <p className="mt-1 text-[13px] text-[var(--color-ink-faint)]">{l.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/50 p-6">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-primary)]"><Info size={16} /></span>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
            MediTrust performs <strong>technology-assisted verification</strong> based on the evidence available to it. It does not guarantee authenticity and is not a substitute for laboratory testing, professional medical advice or official regulatory verification.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-[var(--color-ink)] px-8 py-14 text-center sm:px-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(8,145,178,0.35),transparent_55%)]" />
          <div className="relative">
            <h2 className="font-[var(--font-display)] text-[26px] font-semibold tracking-tight text-white sm:text-[32px]">Ready to check a medicine?</h2>
            <Link to="/verify" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90">
              <ScanLine size={17} /> Verify Medicine <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
