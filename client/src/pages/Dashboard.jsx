import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  ScanLine,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import LoadingScreen from '../components/ui/LoadingScreen.jsx';
import MedicineImage from '../components/ui/MedicineImage.jsx';
import RiskBadge from '../components/verify/RiskBadge.jsx';
import { fetchDashboardStats } from '../services/scanService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { statusMeta } from '../utils/verificationRecord.js';

// Every number on this page comes straight from GET /api/dashboard/stats
// (server/controllers/dashboardController.js), which computes real
// MongoDB aggregates for the current user. Nothing here is hardcoded —
// a brand-new account genuinely shows all zeros.
export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch {
      setError('Could not load your dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center sm:px-6">
        <AlertTriangle size={22} className="text-[var(--color-danger)]" />
        <p className="mt-3 text-[14px] text-[var(--color-ink-faint)]">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-5 flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-[13.5px] font-medium text-white"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </section>
    );
  }

  const cards = [
    { label: 'Total Scans', value: stats.totalScans, icon: LayoutDashboard, color: 'text-[var(--color-primary)]' },
    { label: 'Verified', value: stats.verified, icon: ShieldCheck, color: 'text-[#0F7B3B]' },
    { label: 'Needs Review', value: stats.needsReview ?? 0, icon: HelpCircle, color: 'text-[#9A5F08]' },
    { label: 'Suspicious', value: stats.suspicious, icon: AlertTriangle, color: 'text-[#9A5F08]' },
    { label: 'High Risk', value: stats.highRisk, icon: ShieldAlert, color: 'text-[#B91C1C]' },
    { label: 'Unverified', value: stats.unverified, icon: HelpCircle, color: 'text-[var(--color-ink-faint)]' },
  ];

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
            Dashboard
          </p>
          <h1 className="mt-1 font-[var(--font-display)] text-[26px] font-semibold tracking-tight text-[var(--color-ink)]">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <Link
          to="/verify"
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-medium text-white"
        >
          <ScanLine size={16} />
          Scan Medicine
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-4"
          >
            <card.icon size={18} className={card.color} strokeWidth={1.8} />
            <p className="text-[22px] font-semibold text-[var(--color-ink)]">{card.value}</p>
            <p className="text-[12.5px] text-[var(--color-ink-faint)]">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 lg:col-span-1">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
            Risk Distribution
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {['low', 'medium', 'high'].map((level) => {
              const count = stats.riskDistribution[level] ?? 0;
              const total = stats.totalScans || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="capitalize text-[var(--color-ink-soft)]">{level} risk</span>
                    <span className="text-[var(--color-ink-faint)]">{count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{ width: `${stats.totalScans ? pct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
              Recent Scans
            </p>
            <Link
              to="/history"
              className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-primary)]"
            >
              View all
              <ArrowRight size={13} />
            </Link>
          </div>

          {stats.recentScans.length === 0 ? (
            <p className="mt-6 text-[13.5px] text-[var(--color-ink-faint)]">
              No scans yet. Verify a medicine to see it here.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {stats.recentScans.map((scan) => (
                <li key={scan.id}>
                  <Link
                    to={`/verify/result/${scan.id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--color-primary-soft)]"
                  >
                    <MedicineImage
                      src={scan.imageReference}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg border border-[var(--color-border)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                        {scan.medicineName}
                      </p>
                      <p className="truncate text-[12px] text-[var(--color-ink-faint)]">
                        {new Date(scan.createdAt).toLocaleDateString()}
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
        </div>
      </div>
    </section>
  );
}
