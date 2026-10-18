import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Info } from 'lucide-react';
import { checkMeta } from '../../utils/verificationRecord.js';

// Renders the server's v2 assessment (record.assessment). Every value comes from the stored
// record; nothing is computed or upgraded here. Status is shown as icon + text, never colour alone.
const TONE = {
  good: { Icon: CheckCircle2, cls: 'text-[var(--color-verified)]' },
  warn: { Icon: AlertTriangle, cls: 'text-[var(--color-warning)]' },
  bad: { Icon: XCircle, cls: 'text-[var(--color-danger)]' },
  neutral: { Icon: HelpCircle, cls: 'text-[var(--color-ink-faint)]' },
};
const SHOWN_BY_DEFAULT = ['medicineIdentity', 'manufacturer', 'batch', 'expiry', 'manufacturingDate', 'qr', 'packaging', 'duplicate'];

export function CheckStatus({ status }) {
  const meta = checkMeta(status);
  const { Icon, cls } = TONE[meta.tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${cls}`}>
      <Icon size={15} aria-hidden="true" />
      {meta.text}
    </span>
  );
}

const val = (v) => (v ? <span className="break-words">{v}</span> : <span className="text-[var(--color-ink-faint)]">—</span>);

export default function AssessmentPanel({ assessment }) {
  if (!assessment) return null;
  const checks = assessment.checks.filter((c) => SHOWN_BY_DEFAULT.includes(c.key) || c.status === 'LOW_CONFIDENCE');
  return (
    <div className="mt-8 flex flex-col gap-8">
      <section aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Field-by-field checks</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <caption className="sr-only">Each check, the value read from the package, the reference value, and the result</caption>
            <thead className="border-b border-[var(--color-border)] text-[11.5px] uppercase tracking-wide text-[var(--color-ink-faint)]">
              <tr><th scope="col" className="px-4 py-3">Check</th><th scope="col" className="px-4 py-3">Scanned</th><th scope="col" className="px-4 py-3">Reference</th><th scope="col" className="px-4 py-3">Result</th></tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.key} className="border-b border-[var(--color-border)] align-top last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-[var(--color-ink)]">{c.label}</th>
                  <td className="px-4 py-3">{val(c.scanned)}</td>
                  <td className="px-4 py-3">{val(c.reference)}</td>
                  <td className="px-4 py-3">
                    <CheckStatus status={c.status} />
                    <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--color-ink-faint)]">{c.evidence}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {assessment.missing?.length > 0 && (
        <section aria-labelledby="missing-heading">
          <h2 id="missing-heading" className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">What could not be checked</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {assessment.missing.map((m) => (
              <li key={m.key} className="flex gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-[13px] text-[#9A5F08]">
                <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><span><strong>{m.label}:</strong> {m.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {assessment.nextSteps?.length > 0 && (
        <section aria-labelledby="next-heading">
          <h2 id="next-heading" className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">What to do next</h2>
          <ul className="mt-3 list-disc pl-5 text-[13.5px] leading-relaxed text-[var(--color-ink)]">
            {assessment.nextSteps.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="limits-heading" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/40 p-5">
        <h2 id="limits-heading" className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Limitations</h2>
        <ul className="mt-2 list-disc pl-5 text-[12.5px] leading-relaxed text-[var(--color-ink-faint)]">
          {assessment.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </div>
  );
}
