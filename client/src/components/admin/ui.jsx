import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, ChevronLeft, ChevronRight, Inbox, AlertTriangle, Search } from 'lucide-react';
import { errorMessage } from '../../services/adminApi.js';

// ---- Toasts ----------------------------------------------------------------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-[13.5px] font-medium shadow-lg ${t.type === 'error' ? 'bg-[var(--color-danger)] text-white' : 'bg-[var(--color-ink)] text-white'}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- Layout primitives -----------------------------------------------------
export const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-[13.5px] font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)] disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-danger)] px-3.5 py-2 text-[13.5px] font-medium text-white hover:opacity-90 disabled:opacity-50',
};
export const inputCls = 'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[var(--font-display)] text-[24px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-[var(--color-ink-faint)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const Card = ({ title, children, className = '' }) => (
  <div className={`rounded-2xl border border-[var(--color-border)] bg-white p-5 ${className}`}>
    {title && <p className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{title}</p>}
    {children}
  </div>
);

const BADGE = { green: 'bg-[var(--color-verified-soft)] text-[#0F7B3B]', amber: 'bg-[var(--color-warning-soft)] text-[#9A5F08]', red: 'bg-[var(--color-danger-soft)] text-[#B91C1C]', gray: 'bg-[#EEF2F1] text-[var(--color-ink-soft)]', cyan: 'bg-[var(--color-accent-soft)] text-[#0E7490]' };
export const Badge = ({ tone = 'gray', children }) => <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${BADGE[tone]}`}>{children}</span>;

export const statusTone = (s) => ({ VERIFIED: 'green', VERIFIED_AGAINST_REFERENCE: 'green', HIGH_CONFIDENCE: 'amber', NEEDS_REVIEW: 'amber', MISMATCH_DETECTED: 'red', PROCESSING_FAILED: 'red', approved: 'green', ACTIVE: 'green', success: 'green', SUSPICIOUS: 'amber', MISMATCH: 'red', HIGH_RISK: 'red', EXPIRED: 'red', rejected: 'red', RECALLED: 'red', failure: 'red', pending: 'amber', SUSPENDED: 'amber' }[s] || 'gray');

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-[var(--color-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-[var(--color-ink-faint)]">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-bg)]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-[14px] leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
        <button type="button" disabled={busy} className={danger ? btn.danger : btn.primary} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
          {busy && <Loader2 size={14} className="animate-spin" />}{confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export const Spinner = () => <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />;

export function Skeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse space-y-2.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#EAF0EE]" />)}
    </div>
  );
}
export const EmptyState = ({ text = 'Nothing here yet.' }) => (
  <div className="flex flex-col items-center gap-2 py-14 text-center text-[var(--color-ink-faint)]"><Inbox size={26} /><p className="text-[13.5px]">{text}</p></div>
);
export const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center"><AlertTriangle size={26} className="text-[var(--color-warning)]" /><p className="text-[13.5px] text-[var(--color-ink-soft)]">{message}</p>{onRetry && <button type="button" className={btn.ghost} onClick={onRetry}>Try again</button>}</div>
);

export function Pagination({ page, pages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-[12.5px] text-[var(--color-ink-faint)]">
      <span>{total} result{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous page" className={btn.ghost} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /></button>
        <span>Page {page} / {pages}</span>
        <button type="button" aria-label="Next page" className={btn.ghost} disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

export function DataTable({ columns, rows, rowKey = 'id' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="bg-[#F3F8F6] text-[11.5px] uppercase tracking-wide text-[var(--color-ink-faint)]">
          <tr>{columns.map((c) => <th key={c.key} className="px-3.5 py-2.5 font-semibold">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((r) => (
            <tr key={r[rowKey]} className="hover:bg-[#FAFCFB]">
              {columns.map((c) => <td key={c.key} className="px-3.5 py-2.5 align-middle text-[var(--color-ink)]">{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
      <input className={`${inputCls} pl-9`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

// ---- Data hooks ------------------------------------------------------------
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Paged list loader with filters. Resets to page 1 when filters change. */
export function usePaged(fetcher, filters = {}) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const key = JSON.stringify(filters);
  const prevKey = useRef(key);
  const [tick, setTick] = useState(0);
  useEffect(() => { if (prevKey.current !== key) { prevKey.current = key; setPage(1); } }, [key]);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher({ ...JSON.parse(key), page })
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((e) => !cancelled && setState({ loading: false, error: errorMessage(e, 'Could not load data.'), data: null }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page, tick]);
  return useMemo(() => ({ ...state, page, setPage, reload: () => setTick((t) => t + 1) }), [state, page]);
}

export function ListBody({ list, empty, children }) {
  if (list.loading && !list.data) return <Skeleton />;
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;
  if (!list.data?.items?.length) return <EmptyState text={empty} />;
  return <div className={list.loading ? 'opacity-60 transition-opacity' : ''}>{children}</div>;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
