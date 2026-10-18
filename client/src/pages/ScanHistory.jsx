import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { History, AlertTriangle, RefreshCw, Inbox, ScanLine } from 'lucide-react';
import LoadingScreen from '../components/ui/LoadingScreen.jsx';
import MedicineImage from '../components/ui/MedicineImage.jsx';
import RiskBadge from '../components/verify/RiskBadge.jsx';
import { fetchScans } from '../services/scanService.js';
import { statusMeta } from '../utils/verificationRecord.js';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'VERIFIED_AGAINST_REFERENCE', label: 'Verified against reference' },
  { value: 'NEEDS_REVIEW', label: 'Needs review' },
  { value: 'MISMATCH_DETECTED', label: 'Mismatch detected' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'REFERENCE_NOT_FOUND', label: 'Reference not found' },
  { value: 'NOT_DETECTED', label: 'Not detected' },
];

export default function ScanHistory() {
  const [scans, setScans] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (targetPage, targetStatus) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScans({ page: targetPage, limit: 10, status: targetStatus || undefined });
      setScans(data.scans);
      setPagination(data.pagination);
    } catch {
      setError('Could not load scan history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, status);
  }, [load, page, status]);

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <History size={18} strokeWidth={1.8} />
        </span>
        <div>
          <h1 className="font-[var(--font-display)] text-[22px] font-semibold text-[var(--color-ink)]">
            Scan History
          </h1>
          <p className="text-[13.5px] text-[var(--color-ink-faint)]">
            Every verification you've run, newest first.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              status === f.value
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading && <LoadingScreen />}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-6 py-16 text-center">
            <AlertTriangle size={22} className="text-[var(--color-danger)]" />
            <p className="text-[14px] text-[var(--color-ink-faint)]">{error}</p>
            <button
              type="button"
              onClick={() => load(page, status)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-[13.5px] font-medium text-white"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && scans.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-16 text-center">
            <Inbox size={26} className="text-[var(--color-ink-faint)]" />
            <p className="text-[14px] text-[var(--color-ink-faint)]">
              {status ? 'No scans match this filter yet.' : "You haven't verified any medicines yet."}
            </p>
            <Link
              to="/verify"
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-[13.5px] font-medium text-white"
            >
              <ScanLine size={14} />
              Verify a medicine
            </Link>
          </div>
        )}

        {!loading && !error && scans.length > 0 && (
          <ul className="flex flex-col gap-3">
            {scans.map((scan) => (
              <li key={scan.id}>
                <Link
                  to={`/verify/result/${scan.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-white p-4 transition-colors hover:border-[var(--color-primary)]"
                >
                  <MedicineImage
                    src={scan.imageReference}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg border border-[var(--color-border)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--color-ink)]">
                      {scan.medicineName}
                    </p>
                    <p className="truncate text-[12.5px] text-[var(--color-ink-faint)]">
                      Batch {scan.batchNumber} &middot;{' '}
                      {new Date(scan.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <RiskBadge color={statusMeta(scan.verificationStatus).color}>
                    {statusMeta(scan.verificationStatus).label}
                  </RiskBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-ink-soft)] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[13px] text-[var(--color-ink-faint)]">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={!pagination.hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-ink-soft)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
