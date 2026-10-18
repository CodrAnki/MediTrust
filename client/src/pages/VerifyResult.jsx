import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScanLine, AlertTriangle, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import AssessmentPanel from '../components/verify/AssessmentPanel.jsx';
import EvidencePanel from '../components/verify/EvidencePanel.jsx';
import ScoreRing from '../components/verify/ScoreRing.jsx';
import RiskBadge from '../components/verify/RiskBadge.jsx';
import LoadingScreen from '../components/ui/LoadingScreen.jsx';
import MedicineImage from '../components/ui/MedicineImage.jsx';
import { useVerification } from '../context/VerificationContext.jsx';
import { riskLevelCopy, statusMeta } from '../utils/verificationRecord.js';

const STATUS_ICON = { check: CheckCircle2, warn: AlertTriangle, cross: XCircle, help: HelpCircle };
const BANNER = { verified: 'bg-[var(--color-verified-soft)] text-[#0F7B3B]', warning: 'bg-[var(--color-warning-soft)] text-[#9A5F08]', danger: 'bg-[var(--color-danger-soft)] text-[#B91C1C]' };

export default function VerifyResult() {
  const { id } = useParams();
  const { getResult, clearPendingImage } = useVerification();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // The result is saved server-side; the queued photos and their blob: URLs are no longer needed.
  useEffect(() => { clearPendingImage(); }, [clearPendingImage]);

  useEffect(() => {
    let cancelled = false;
    const loadResult = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await getResult(id);
        if (!cancelled) setRecord(result);
      } catch (error) {
        if (!cancelled) setLoadError(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadResult();
    return () => {
      cancelled = true;
    };
  }, [id, getResult, retryCount]);

  if (loading) return <LoadingScreen />;

  if (loadError) {
    const unavailable = [403, 404].includes(loadError.response?.status);
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center sm:px-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
          <AlertTriangle size={22} strokeWidth={1.8} />
        </span>
        <h1 className="mt-5 font-[var(--font-display)] text-[22px] font-semibold text-[var(--color-ink)]">
          {unavailable ? 'Result not available' : 'Could not load result'}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-faint)]">
          {unavailable
            ? "This result doesn't exist, or you don't have access to it. Please verify again."
            : 'A connection problem prevented this result from loading. Check your connection and try again.'}
        </p>
        {!unavailable && (
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-6 rounded-full border border-[var(--color-border)] px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink)]"
          >
            Try again
          </button>
        )}
        <Link
          to="/verify"
          className="mt-6 flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-medium text-white"
        >
          <ScanLine size={16} />
          Verify a medicine
        </Link>
      </section>
    );
  }

  if (!record) {
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center sm:px-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
          <AlertTriangle size={22} strokeWidth={1.8} />
        </span>
        <h1 className="mt-5 font-[var(--font-display)] text-[22px] font-semibold text-[var(--color-ink)]">
          Result not available
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-faint)]">
          This result doesn't exist, or you don't have access to it. Please verify again.
        </p>
        <Link
          to="/verify"
          className="mt-6 flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-medium text-white"
        >
          <ScanLine size={16} />
          Verify a medicine
        </Link>
      </section>
    );
  }

  const meta = statusMeta(record.verificationStatus);
  const assessment = record.assessment; // absent on records saved before the v2 contract
  const StatusIcon = STATUS_ICON[meta.icon] || HelpCircle;
  const level = riskLevelCopy[record.riskLevel] || riskLevelCopy.unknown;
  const hasScore = typeof record.riskScore === 'number';

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Verification result</p>
          <h1 className="mt-1 font-[var(--font-display)] text-[26px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[30px]">{record.medicineName}</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-faint)]">{record.manufacturer}</p>
        </div>
        <MedicineImage src={record.imageReference} alt={`${record.medicineName} package`} className="h-20 w-20 shrink-0 rounded-xl border border-[var(--color-border)]" />
      </div>

      <div role="status" className={`mt-6 flex gap-3 rounded-2xl px-5 py-4 ${BANNER[meta.color] || BANNER.warning}`}>
        <StatusIcon size={24} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-[17px] font-semibold">{meta.label}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed">{assessment?.explanation || meta.message}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-6 rounded-2xl border border-[var(--color-border)] bg-white p-7 text-center sm:flex-row sm:gap-8 sm:p-8 sm:text-left">
        {hasScore ? (
          <ScoreRing score={record.riskScore} color={meta.color} label="Agreement" />
        ) : (
          <div className="flex h-40 w-40 shrink-0 flex-col items-center justify-center rounded-full border-2 border-dashed border-[var(--color-border)] px-4 text-center sm:h-44 sm:w-44">
            <span className="text-[13px] font-semibold text-[var(--color-ink)]">Score withheld</span>
            <span className="mt-1 text-[11.5px] text-[var(--color-ink-faint)]">not enough evidence</span>
          </div>
        )}
        <div>
          <RiskBadge color={meta.color} size="lg">{meta.label}</RiskBadge>
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-[var(--color-ink-faint)]">
            {hasScore
              ? <>Evidence agreement: <strong>{record.riskScore}</strong>/100 ({level.label.toLowerCase()}). This measures how well the checks that could be run agree with reference records. It is <strong>not</strong> a probability that the medicine is genuine or counterfeit.</>
              : (assessment?.scoreWithheldReason || 'A numeric score is only shown when identity, batch and expiry could all be checked. Showing one here would be misleading.')}
          </p>
          <p className="mt-2 text-[12.5px] text-[var(--color-ink-faint)]">A technology-assisted assessment, not a laboratory or regulatory confirmation.</p>
        </div>
      </div>

      <AssessmentPanel assessment={assessment} />

      <div className="mt-8">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Verification signals</p>
        <div className="mt-4"><EvidencePanel record={record} /></div>
      </div>

      {!assessment && record.evidence?.length > 0 && (
        <div className="mt-8">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Risk engine evidence</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {record.evidence.map((entry) => (
              <div key={entry.key} className="rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-3">
                <div className="flex items-center justify-between gap-3"><p className="text-[13px] font-medium text-[var(--color-ink)]">{entry.label}</p><span className="text-[12px] font-semibold text-[var(--color-primary)]">{entry.status}</span></div>
                <p className="mt-1 text-[12px] text-[var(--color-ink-faint)]">{entry.evidence}</p>
                <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Weight {Math.round(entry.weight * 100)}% · confidence {Math.round(entry.confidence)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.imageResults?.length > 0 && (
        <div className="mt-8">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
            Images processed ({record.imageResults.filter((image) => image.success).length} of {record.imageResults.length})
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {record.imageResults.map((image) => (
              <div key={image.index} className="rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-3 text-[13px]">
                <span className={image.success ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}>{image.kind === 'qr' ? 'QR code photo' : `Image ${image.index + 1}`}: {image.success ? 'processed' : 'not processed'}</span>
                {image.ocr?.batchNumber && <p className="mt-1 text-[var(--color-ink-faint)]">Batch: {image.ocr.batchNumber}</p>}
                {typeof image.ocr?.confidence === 'number' && (
                  <p className="mt-1 text-[var(--color-ink-faint)]">Overall OCR word confidence (estimate): {Math.round(image.ocr.confidence * 100)}%</p>
                )}
                {Object.entries(image.ocr?.fieldConfidence || {}).some(([, score]) => typeof score === 'number') && (
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-[var(--color-ink-faint)]">
                    {Object.entries(image.ocr.fieldConfidence)
                      .filter(([, score]) => typeof score === 'number')
                      .map(([field, score]) => (
                        <span key={field}>{field.replace(/([A-Z])/g, ' $1')}: {score}% word confidence</span>
                      ))}
                  </div>
                )}
                {image.qr?.code && <p className="mt-1 break-all text-[var(--color-ink-faint)]">QR text (shown as text, never opened): {image.qr.code}</p>}
                {image.error && <p className="mt-1 text-[var(--color-ink-faint)]">{image.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!assessment && record.detectedIssues?.length > 0 && (
        <div className="mt-8">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
            Detected issues
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {record.detectedIssues.map((issue, i) => (
              <li
                key={i}
                className="rounded-lg bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-[13px] text-[#9A5F08]"
              >
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
          Medicine details
        </p>
        {record.confirmedFields && (
          <p className="mt-1 text-[12px] text-[var(--color-primary)]">These details were reviewed and confirmed by you before verification.</p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-[var(--color-border)] bg-white p-6 sm:grid-cols-4">
          <Detail label="Medicine" value={record.medicineName} />
          <Detail label="Manufacturer" value={record.manufacturer} />
          <Detail label="Composition / generic" value={record.genericName || 'Not available'} />
          <Detail label="Strength" value={record.strength || 'Not available'} />
          <Detail label="Batch" value={record.batchNumber} />
          <Detail label="Manufactured" value={record.manufacturingDate} />
          <Detail label="Expiry" value={record.expiryDate} />
                  </dl>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/verify"
          className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          <ScanLine size={16} />
          Scan Another Medicine
        </Link>
        <Link
          to="/dashboard"
          className="flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-6 py-3 text-[14.5px] font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          View Dashboard
        </Link>
      </div>

      <p className="mt-8 max-w-2xl text-[12px] leading-relaxed text-[var(--color-ink-faint)]">
        MediTrust provides a technology-assisted verification assessment based on available evidence. Results should not replace professional medical advice or official regulatory verification.
      </p>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}
