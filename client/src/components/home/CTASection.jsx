import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';

export default function CTASection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[28px] bg-[var(--color-ink)] px-8 py-14 text-center sm:px-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(8,145,178,0.35),transparent_55%)]" />
        <div className="relative">
          <h2 className="font-[var(--font-display)] text-[28px] font-semibold tracking-tight text-white sm:text-[34px]">Check before you consume</h2>
          <p className="mx-auto mt-3 max-w-[460px] text-[15px] leading-relaxed text-white/70">
            Upload a photo of the packaging and get a clear, evidence-based verification assessment.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/verify" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-medium text-[var(--color-ink)] transition-opacity hover:opacity-90">
              <ScanLine size={17} /> Verify Medicine
            </Link>
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-white/10">Contact</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
