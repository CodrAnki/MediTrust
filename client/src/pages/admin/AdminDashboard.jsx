import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, Card, Badge, statusTone, Skeleton, ErrorState, EmptyState, fmtDate } from '../../components/admin/ui.jsx';

const COLORS = { low: '#16A34A', medium: '#D97C0A', high: '#DC2626' };

function Stat({ label, value, tone }) {
  return <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4"><p className="text-[12px] text-[var(--color-ink-faint)]">{label}</p><p className={`mt-1 font-[var(--font-display)] text-[26px] font-semibold ${tone || 'text-[var(--color-ink)]'}`}>{value}</p></div>;
}
const Chart = ({ children, empty }) => (empty ? <EmptyState text="No data yet." /> : <div className="h-60"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>);

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const load = () => { setError(''); adminApi.stats().then(setD).catch((e) => setError(errorMessage(e, 'Could not load dashboard.'))); };
  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!d) return <Skeleton rows={8} />;
  const t = d.totals;
  const h = d.health;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live figures from the MediTrust database." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Medicines" value={t.medicines} /><Stat label="Reference images" value={`${t.approvedReferences} / ${t.references}`} />
        <Stat label="Batches" value={t.batches} /><Stat label="Verifications" value={t.verifications} />
        <Stat label="Verified" value={d.verified} tone="text-[var(--color-verified)]" /><Stat label="Suspicious / mismatch" value={d.suspicious} tone="text-[var(--color-warning)]" />
        <Stat label="High risk" value={d.highRisk} tone="text-[var(--color-danger)]" /><Stat label="Unknown / no data" value={d.unknown} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-[var(--color-ink-faint)]">Reference images: approved &amp; enabled / total.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Verification trend (14 days)"><Chart empty={!d.trend.some((x) => x.total)}>
          <LineChart data={d.trend}><CartesianGrid strokeDasharray="3 3" stroke="#E3ECE9" /><XAxis dataKey="date" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={28} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="total" stroke="#0891B2" name="Total" dot={false} /><Line type="monotone" dataKey="verified" stroke="#16A34A" name="Verified" dot={false} /><Line type="monotone" dataKey="suspicious" stroke="#DC2626" name="Suspicious+" dot={false} /></LineChart></Chart></Card>
        <Card title="Risk distribution"><Chart empty={!d.riskDistribution.some((x) => x.value)}>
          <PieChart><Pie data={d.riskDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>{d.riskDistribution.map((x) => <Cell key={x.name} fill={COLORS[x.name]} />)}</Pie><Tooltip /><Legend /></PieChart></Chart></Card>
        <Card title="Status breakdown"><Chart empty={!d.statusBreakdown.length}>
          <BarChart data={d.statusBreakdown}><CartesianGrid strokeDasharray="3 3" stroke="#E3ECE9" /><XAxis dataKey="name" fontSize={10} interval={0} angle={-20} height={55} textAnchor="end" /><YAxis allowDecimals={false} fontSize={11} width={28} /><Tooltip /><Bar dataKey="value" fill="#0E9F6E" radius={[4, 4, 0, 0]} /></BarChart></Chart></Card>
        <Card title="Most verified medicines"><Chart empty={!d.topMedicines.length}>
          <BarChart data={d.topMedicines} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#E3ECE9" /><XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="name" fontSize={11} width={110} /><Tooltip /><Bar dataKey="value" fill="#0891B2" radius={[0, 4, 4, 0]} /></BarChart></Chart></Card>
        <Card title="Database growth (medicines added per week)"><Chart empty={!d.databaseGrowth.length}>
          <BarChart data={d.databaseGrowth}><CartesianGrid strokeDasharray="3 3" stroke="#E3ECE9" /><XAxis dataKey="week" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={28} /><Tooltip /><Bar dataKey="added" fill="#0E9F6E" radius={[4, 4, 0, 0]} /></BarChart></Chart></Card>
        <Card title="Database health">
          <ul className="grid gap-2 text-[13.5px]">
            <li className="flex justify-between"><span>MongoDB</span><Badge tone={h.mongodb === 'connected' ? 'green' : 'red'}>{h.mongodb}</Badge></li>
            <li className="flex justify-between"><span>Medicines / Batches</span><span>{h.medicines} / {h.batches}</span></li>
            <li className="flex justify-between"><span>References / Verifications</span><span>{h.references} / {h.verifications}</span></li>
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Recent activity">{d.recentActivity.length ? <ul className="grid gap-2.5 text-[13px]">{d.recentActivity.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span className="truncate">{a.medicine}</span><Badge tone={statusTone(a.status)}>{a.status}</Badge></li>)}</ul> : <EmptyState text="No verifications yet." />}<Link to="/admin/verifications" className="mt-3 inline-block text-[12.5px] text-[var(--color-primary)]">View all →</Link></Card>
        <Card title="Recently added medicines">{d.recentMedicines.length ? <ul className="grid gap-2.5 text-[13px]">{d.recentMedicines.map((m) => <li key={m.id}><p className="truncate font-medium">{m.name}</p><p className="text-[11.5px] text-[var(--color-ink-faint)]">{m.source === 'drugsetu' ? 'Legacy import' : m.source} · {fmtDate(m.createdAt)}</p></li>)}</ul> : <EmptyState text="No medicines yet." />}</Card>
        <Card title="Recently added references">{d.recentReferences.length ? <ul className="grid gap-2.5 text-[13px]">{d.recentReferences.map((r) => <li key={r.id} className="flex items-center justify-between gap-2"><span className="truncate">{r.medicine} · {r.type}</span><Badge tone={statusTone(r.status)}>{r.status}</Badge></li>)}</ul> : <EmptyState text="No references yet." />}</Card>
      </div>
    </>
  );
}
