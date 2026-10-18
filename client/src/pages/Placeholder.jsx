import { Link } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";

// A clearly-labeled stand-in for pages that arrive in later build phases,
// so navigation never dead-ends on a broken route while we build in phases.
export default function Placeholder({ title, phase }) {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center sm:px-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        <Construction size={22} strokeWidth={1.8} />
      </span>
      <h1 className="mt-5 font-[var(--font-display)] text-[24px] font-semibold text-[var(--color-ink)]">
        {title}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-faint)]">
        {phase
          ? `This page is built in ${phase} of the MediTurst roadmap.`
          : "This page is coming soon."}
      </p>
      <Link
        to="/"
        className="mt-6 flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-primary)]"
      >
        <ArrowLeft size={15} />
        Back to home
      </Link>
    </section>
  );
}
