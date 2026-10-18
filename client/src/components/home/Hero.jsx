import { Link } from "react-router-dom";
import { ScanLine, ArrowRight } from "lucide-react";
import HeroVisual from "./HeroVisual.jsx";

export default function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
      <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-ink-soft)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-verified)]" />
            Multi-layer medicine verification
          </span>

          <h1 className="mt-5 font-[var(--font-display)] text-[38px] font-semibold leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-[50px] lg:text-[54px]">
            Verify Medicines.
            <br />
            Detect Risk.
            <br />
            <span className="text-[var(--color-primary)]">Build Trust.</span>
          </h1>

          <p className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-[var(--color-ink-soft)]">
            MediTrust combines OCR, medicine identification, reference packaging
            comparison, QR/barcode verification, batch validation, duplicate
            detection, and multi-signal risk analysis to assess medicine
            verification risk.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/verify"
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-3 text-[15px] font-medium text-white shadow-sm shadow-emerald-900/15 transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              <ScanLine size={17} />
              Verify Medicine
            </Link>
            <Link
              to="/how-it-works"
              className="flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-6 py-3 text-[15px] font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              How It Works
              <ArrowRight size={16} />
            </Link>
          </div>

          <p className="mt-6 max-w-[460px] text-[12.5px] leading-relaxed text-[var(--color-ink-faint)]">
            MediTrust provides a technology-assisted verification assessment based
            on available evidence. It does not replace laboratory testing,
            professional medical advice or official regulatory verification.
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
