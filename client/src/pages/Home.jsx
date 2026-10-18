import { Link } from 'react-router-dom';
import Hero from '../components/home/Hero.jsx';
import TrustIntro from '../components/home/TrustIntro.jsx';
import PipelineSection from '../components/home/PipelineSection.jsx';
import TechnologySection from '../components/home/TechnologySection.jsx';
import WhyCards from '../components/home/WhyCards.jsx';
import { EvidenceSection, SecuritySection } from '../components/home/InfoSections.jsx';
import FaqSection from '../components/home/FaqSection.jsx';
import CTASection from '../components/home/CTASection.jsx';

export default function Home() {
  return (
    <>
      <Hero />
      <TrustIntro />
      <PipelineSection />
      <TechnologySection />
      <WhyCards />
      <EvidenceSection />
      <SecuritySection />
      <section className="mx-auto max-w-6xl px-5 pb-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 sm:p-8">
          <h2 className="font-[var(--font-display)] text-[22px] font-semibold text-[var(--color-ink)]">About MediTrust</h2>
          <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-[var(--color-ink-soft)]">
            MediTrust is a multi-layer medicine verification platform designed to assist users in assessing medicine authenticity risk using available digital and visual evidence.
          </p>
          <Link to="/about" className="mt-3 inline-block text-[14px] font-medium text-[var(--color-primary)]">Read more →</Link>
        </div>
      </section>
      <FaqSection />
      <CTASection />
    </>
  );
}
