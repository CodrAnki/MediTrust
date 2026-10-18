import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, LoaderCircle, ShieldCheck } from 'lucide-react';
import Alert from '../components/ui/Alert.jsx';
import { useVerification } from '../context/VerificationContext.jsx';
import { toVerificationError } from '../services/verificationService.js';

const FIELDS = [
  ['medicineName', 'Medicine name'],
  ['genericName', 'Composition / generic name'],
  ['strength', 'Strength'],
  ['manufacturer', 'Manufacturer'],
  ['batchNumber', 'Batch number'],
  ['manufacturingDate', 'Manufacturing date'],
  ['expiryDate', 'Expiry date'],
];

const EMPTY_FIELDS = Object.fromEntries(FIELDS.map(([key]) => [key, '']));

export default function VerifyReview() {
  const navigate = useNavigate();
  const { pendingImage, previewVerification, confirmFields } = useVerification();
  const [fieldEdits, setFieldEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const hasFiles = Boolean(pendingImage?.files?.length);
  const extracted = pendingImage?.extracted;
  const fields = { ...EMPTY_FIELDS, ...extracted?.fields, ...fieldEdits };

  const extract = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await previewVerification();
    } catch (err) {
      startedRef.current = false;
      if (mountedRef.current) setError(toVerificationError(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [previewVerification]);

  useEffect(() => {
    mountedRef.current = true;
    if (!hasFiles) {
      navigate('/verify', { replace: true });
      return () => { mountedRef.current = false; };
    }
    if (!extracted) extract();
    return () => { mountedRef.current = false; };
  }, [hasFiles, extracted, extract, navigate]);

  function updateField(key, value) {
    setFieldEdits((current) => ({ ...current, [key]: value }));
  }

  function handleConfirm() {
    confirmFields(Object.fromEntries(FIELDS.map(([key]) => [key, fields[key] || ''])));
    navigate('/verify/processing');
  }

  if (!hasFiles) return null;

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
      <button
        type="button"
        onClick={() => navigate('/verify')}
        className="mb-6 flex items-center gap-2 text-[14px] font-medium text-[var(--color-primary)]"
      >
        <ArrowLeft size={16} /> Back to photos
      </button>
      <h1 className="font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[36px]">
        Review scanned details
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
        Check the information read from your photos. You can correct or fill in any field; the values you confirm will be used for medicine, batch, and expiry checks.
      </p>

      {error && (
        <div className="mt-6">
          <Alert type="error">{error.message}</Alert>
          <button
            type="button"
            onClick={() => { startedRef.current = false; extract(); }}
            disabled={loading}
            className="mt-3 rounded-full border border-[var(--color-border)] bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink)] disabled:opacity-60"
          >
            Try extraction again
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 text-[14px] text-[var(--color-ink-soft)]" role="status">
          <LoaderCircle size={19} className="animate-spin text-[var(--color-primary)]" />
          Reading the medicine label and QR code…
        </div>
      )}

      {extracted && (
        <>
          <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Check size={17} />
              </span>
              <div>
                <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">Medicine details</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-faint)]">OCR results are suggestions. Review each value before continuing.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 flex items-center justify-between gap-2 text-[13px] font-medium text-[var(--color-ink)]">
                    {label}
                    <span className="text-[11px] font-normal text-[var(--color-ink-faint)]">
                      {extracted.fieldStatus?.[key]?.replaceAll('_', ' ').toLowerCase() || (extracted.fields[key] ? 'detected' : 'not detected')}
                    </span>
                  </span>
                  <input
                    type="text"
                    value={fields[key] ?? ''}
                    onChange={(event) => updateField(key, event.target.value)}
                    placeholder="Not detected — enter if you can read it"
                    maxLength={160}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-3 text-[14px] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-7">
            <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">QR code result</h2>
            <p className="mt-1 text-[13px] text-[var(--color-ink-faint)]">
              {extracted.qrCodes?.length
                ? `Read ${extracted.qrCodes.length} QR value${extracted.qrCodes.length > 1 ? 's' : ''}. The server will match these against its trusted records after you confirm.`
                : 'No QR value could be read. You can still continue with the medicine details.'}
            </p>
            {extracted.qrCodes?.map((code) => (
              <p key={code} className="mt-2 break-all rounded-lg bg-[#F8FAFD] p-3 text-[12px] text-[var(--color-ink-soft)]">{code}</p>
            ))}
          </div>

          <details className="mt-5 rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:p-7">
            <summary className="cursor-pointer text-[14px] font-semibold text-[var(--color-ink)]">Show all text read from photos</summary>
            <div className="mt-4 flex flex-col gap-4">
              {extracted.images?.map((image, index) => (
                <div key={`${image.kind}-${index}`} className="rounded-xl bg-[#F8FAFD] p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
                    {image.kind === 'qr' ? 'Separate QR photo' : `Medicine photo ${index + 1}`}
                  </p>
                  {image.rawText
                    ? <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-[var(--color-ink-soft)]">{image.rawText}</pre>
                    : <p className="mt-2 text-[13px] text-[var(--color-ink-faint)]">No label text detected on this photo.</p>}
                  {image.error && <p className="mt-2 text-[12px] text-[var(--color-warning)]">{image.error}</p>}
                </div>
              ))}
            </div>
          </details>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-7 py-3.5 text-[15px] font-medium text-white"
            >
              <ShieldCheck size={17} /> Confirm details &amp; verify
            </button>
          </div>
        </>
      )}
    </section>
  );
}
