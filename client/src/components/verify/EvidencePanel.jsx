import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';

// Evidence-first view: every signal the backend actually produced, with the
// reason. Nothing here is computed on the client — it only labels fields of
// the stored verification record.
const ICON = {
  pass: { Icon: CheckCircle2, cls: 'text-[var(--color-verified)]' },
  warn: { Icon: AlertTriangle, cls: 'text-[var(--color-warning)]' },
  fail: { Icon: XCircle, cls: 'text-[var(--color-danger)]' },
  na: { Icon: MinusCircle, cls: 'text-[var(--color-ink-faint)]' },
};

export function buildSignalGroups(record) {
  const s = record.signals || {};
  const id = record.medicineIdentification;
  const qr = s.qr || {};
  const batch = s.batch || {};
  const pk = s.packaging || {};
  const sourceLabel = { local: 'MediTrust database', drugsetu: 'Legacy external catalog record', both: 'Legacy external catalog record', none: 'No match' };

  const groups = [];

  groups.push({ title: 'OCR', rows: [
    s.ocr?.consistent === undefined
      ? { t: 'na', text: 'OCR result not recorded' }
      : s.ocr.consistent
        ? { t: 'pass', text: 'Extracted text is consistent across images' }
        : { t: 'warn', text: 'Extracted text is inconsistent between images' },
    record.medicineName === 'Not Detected' ? { t: 'warn', text: 'Medicine name not detected' } : { t: 'pass', text: `Medicine name read: ${record.medicineName}` },
  ] });

  if (id) {
    const yn = (v, label) => (v === true ? { t: 'pass', text: `${label} matched` } : v === false ? { t: 'fail', text: `${label} did not match` } : { t: 'na', text: `${label}: not available to compare` });
    groups.push({ title: 'Medicine identification', rows: [
      { t: id.source === 'none' ? 'warn' : 'pass', text: `Source: ${sourceLabel[id.source] || id.source}${id.source !== 'none' ? ` · confidence ${Math.round((id.confidence || 0) * 100)}%` : ''}` },
      yn(id.nameMatched, 'Name'), yn(id.manufacturerMatched, 'Manufacturer'), yn(id.compositionMatched, 'Composition'), yn(id.strengthMatched, 'Strength'),
    ] });
  }

  groups.push({ title: 'Reference packaging', rows: pk.status === 'PACKAGING_NOT_AVAILABLE' || pk.similarity == null
    ? [{ t: 'warn', text: pk.referenceAvailable === false || !pk.referenceCount ? 'Reference unavailable — no approved reference images' : 'Reference images could not be compared' }]
    : [{ t: pk.status === 'PACKAGING_MATCH' ? 'pass' : pk.status === 'PACKAGING_PARTIAL_MATCH' ? 'warn' : 'fail', text: `Packaging similarity: ${pk.similarity}%` },
       { t: 'pass', text: `${pk.referenceCount || 1} approved reference image(s) compared` }] });

  groups.push({ title: 'QR / barcode', rows: [
    qr.status === 'QR_NOT_DETECTED' || !qr.status ? { t: 'warn', text: 'QR not detected' }
      : qr.status === 'QR_UNTRUSTED' ? { t: 'fail', text: 'QR code did not match registered records' }
        : qr.verified ? { t: 'pass', text: 'QR code matched registered records' } : { t: 'warn', text: 'QR code matched a record that is not active' },
    { t: 'na', text: 'Barcode: not available (1D barcode decoding is not part of the pipeline)' },
  ] });

  groups.push({ title: 'Batch', rows: [
    batch.verified ? { t: 'pass', text: 'Batch found in registered batches' } : { t: 'warn', text: 'Batch not found' },
    s.medicineConsistency === 'INCONSISTENT' ? { t: 'fail', text: 'Batch belongs to a different medicine than the one identified' } : null,
  ].filter(Boolean) });

  groups.push({ title: 'Duplicate detection', rows: [s.duplicate?.detected ? { t: 'warn', text: s.duplicate.reason || 'Suspicious repeated identifier' } : { t: 'pass', text: 'No duplicate detected' }] });
  return groups;
}

export default function EvidencePanel({ record }) {
  const groups = buildSignalGroups(record);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.title} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{g.title}</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {g.rows.map((r, i) => {
              const { Icon, cls } = ICON[r.t];
              return (
                <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--color-ink-soft)]">
                  <Icon size={15} className={`mt-0.5 shrink-0 ${cls}`} />
                  <span>{r.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
