import { Check, Loader2, X, Minus } from 'lucide-react';

// status: 'pending' | 'active' | 'done' | 'skipped' | 'failed' (reported by the backend)
export default function ProcessingSteps({ steps, statuses }) {
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((step, index) => {
        const status = statuses[step.id] ?? 'pending';
        return (
          <li key={step.id} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  status === 'done'
                    ? 'border-[var(--color-verified)] bg-[var(--color-verified)] text-white'
                    : status === 'failed'
                      ? 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white'
                      : status === 'skipped'
                        ? 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink-faint)]'
                    : status === 'active'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-white text-[var(--color-ink-faint)]'
                }`}
              >
                {status === 'done' ? (
                  <Check size={16} strokeWidth={2.6} />
                ) : status === 'failed' ? (
                  <X size={16} strokeWidth={2.6} />
                ) : status === 'skipped' ? (
                  <Minus size={16} strokeWidth={2.6} />
                ) : status === 'active' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <span className="text-[12px] font-semibold">{index + 1}</span>
                )}
              </span>
              {index < steps.length - 1 && (
                <span
                  className={`w-px flex-1 ${
                    status === 'done' ? 'bg-[var(--color-verified)]' : 'bg-[var(--color-border)]'
                  }`}
                  style={{ minHeight: 22 }}
                />
              )}
            </div>

            <div className="pb-6">
              <p
                className={`text-[14.5px] font-medium transition-colors ${
                  status === 'pending' ? 'text-[var(--color-ink-faint)]' : 'text-[var(--color-ink)]'
                }`}
              >
                {step.label}
              </p>
              {status !== 'pending' && (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-ink-faint)]">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
