import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { pipelineSteps } from '../../data/siteContent.js';

// Desktop (lg+): a connected horizontal pipeline (two rows of five, joined by
// animated connector lines). Mobile/tablet: a vertical timeline.
// `detailed` also lists what each stage checks (used on /how-it-works).
export default function PipelineSection({ detailed = false, showLink = true }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">The verification pipeline</p>
            <h2 className="mt-2 font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[34px]">
              How it works
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
              Ten connected stages, each running on the same MediTrust backend and database.
            </p>
          </div>
          {showLink && (
            <Link to="/how-it-works" className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-primary)]">
              See the full process <ArrowRight size={15} />
            </Link>
          )}
        </div>

        <ol className="relative mt-12 ml-4 border-l-2 border-dashed border-[var(--color-primary)]/30 pl-8 lg:ml-0 lg:grid lg:grid-cols-5 lg:gap-x-5 lg:gap-y-12 lg:border-l-0 lg:pl-0">
          {pipelineSteps.map((step, i) => {
            const Icon = step.icon;
            const lastInRow = i % 5 === 4;
            return (
              <li key={step.n} className="group relative pb-9 last:pb-0 lg:pb-0">
                {/* mobile timeline node */}
                <span className="absolute -left-[50px] top-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--color-primary)] bg-white font-[var(--font-mono)] text-[12px] font-semibold text-[var(--color-primary)] lg:hidden">
                  {step.n}
                </span>
                {/* desktop connector to next step in the row */}
                {!lastInRow && i < pipelineSteps.length - 1 && (
                  <span aria-hidden className="pipe-line absolute left-[calc(50%+28px)] right-[calc(-50%+28px)] top-[27px] hidden h-[2px] lg:block" />
                )}
                <div className="glass rounded-2xl border border-[var(--color-border)] p-5 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[var(--color-primary)]/50 group-hover:shadow-md lg:h-full lg:text-center">
                  <div className="flex items-center gap-3 lg:flex-col lg:gap-2">
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary-soft)] to-[var(--color-accent-soft)] text-[var(--color-primary)]">
                      <Icon size={22} strokeWidth={1.9} />
                      <span className="absolute -right-1.5 -top-1.5 hidden h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 font-[var(--font-mono)] text-[10.5px] font-semibold text-white lg:flex">
                        {step.n}
                      </span>
                    </span>
                    <h3 className="text-[15px] font-semibold leading-snug text-[var(--color-ink)]">{step.title}</h3>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-ink-faint)]">
                    {detailed ? step.description : step.short}
                  </p>
                  {detailed && (
                    <ul className="mt-3 flex flex-col gap-1 text-left text-[12.5px] text-[var(--color-ink-soft)]">
                      {step.points.map((p) => (
                        <li key={p} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />{p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
