import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import ProcessingSteps from '../components/verify/ProcessingSteps.jsx';
import Alert from '../components/ui/Alert.jsx';
import MedicineImage from '../components/ui/MedicineImage.jsx';
import { useVerification } from '../context/VerificationContext.jsx';
import { verificationSteps } from '../data/verificationSteps.js';
import { toVerificationError } from '../services/verificationService.js';

export default function VerifyProcessing() {
  const navigate = useNavigate();
  const { pendingImage, runVerification } = useVerification();
  const [statuses, setStatuses] = useState({});
  const [error, setError] = useState(null); // VerificationError
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false); // synchronous guard: state updates are async, a double click is not
  const mountedRef = useRef(true);
  const hasFiles = Boolean(pendingImage?.files?.length);
  const hasConfirmedFields = pendingImage?.confirmedFields !== null && pendingImage?.confirmedFields !== undefined;
  const additionalImageCount = pendingImage
    ? pendingImage.files.length - 1 + (pendingImage.qrImage ? 1 : 0)
    : 0;

  const start = useCallback(async () => {
    // Prevents a duplicate submission from a double click, a retry while one is already running,
    // and React StrictMode's dev-only double effect.
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);
    setStatuses({});
    try {
      const record = await runVerification({
        onStepChange: (stepId, status) => { if (mountedRef.current) setStatuses((prev) => ({ ...prev, [stepId]: status })); },
      });
      if (mountedRef.current) navigate(`/verify/result/${record.id}`, { replace: true });
    } catch (err) {
      if (mountedRef.current) setError(toVerificationError(err));
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setRunning(false);
    }
  }, [runVerification, navigate]);

  useEffect(() => {
    mountedRef.current = true;
    // No image queued (direct navigation or a refresh clears in-memory context): start over.
    if (!hasFiles) {
      navigate('/verify', { replace: true });
      return undefined;
    }
    if (!hasConfirmedFields) {
      navigate('/verify/review', { replace: true });
      return undefined;
    }
    start();
    // `mountedRef` (not a cleanup-scoped "cancelled" flag) so StrictMode's phantom unmount/remount
    // cannot swallow the progress updates or the final navigation of the one real run.
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasFiles || !hasConfirmedFields) return null;

  const activeStep = verificationSteps.find((step) => statuses[step.id] === 'active');

  return (
    <section className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20" aria-busy={running}>
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <ShieldCheck size={22} strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 font-[var(--font-display)] text-[26px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[30px]">
          {error ? 'Verification could not be completed' : 'Verifying your medicine'}
        </h1>
        <p className="mt-2 text-[14.5px] text-[var(--color-ink-faint)]">
          {error ? 'Nothing has been concluded about this medicine.' : "This can take up to a minute for several photos. Please don't close this page."}
        </p>
        {/* Screen-reader announcement of REAL progress (the visual list is not a live region). */}
        <p className="sr-only" role="status" aria-live="polite">
          {error ? '' : activeStep ? `Step in progress: ${activeStep.label}` : ''}
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-8 max-w-md">
          <Alert type="error">{error.message}</Alert>
          {error.requestId && (
            <p className="mt-2 text-center text-[12px] text-[var(--color-ink-faint)]">Reference: <code>{error.requestId}</code></p>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {error.retryable && (
              <button
                type="button"
                onClick={start}
                disabled={running}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60"
              >
                <RefreshCw size={15} /> Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/verify')}
              className="flex flex-1 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink)]"
            >
              Back to Verify
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto mt-10 grid max-w-lg gap-8 sm:grid-cols-[auto_1fr] sm:gap-8">
        <div className="mx-auto sm:mx-0">
          <MedicineImage
            src={pendingImage.files[0]?.previewUrl}
            alt="Medicine package being verified"
            className="h-28 w-28 rounded-2xl border border-[var(--color-border)] shadow-sm sm:h-32 sm:w-32"
          />
          {additionalImageCount > 0 && (
            <p className="mt-2 text-center text-[12px] text-[var(--color-ink-faint)] sm:text-left">
              +{additionalImageCount} more image
              {additionalImageCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <ProcessingSteps steps={verificationSteps} statuses={statuses} />
      </div>
    </section>
  );
}
