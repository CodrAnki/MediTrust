import { useEffect, useState } from 'react';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, Card, Field, btn, inputCls, Skeleton, ErrorState, useToast } from '../../components/admin/ui.jsx';

const RISK_FIELDS = [
  ['lowRiskMin', 'Low-risk threshold', 'Score at or above this is "low" risk (1–100)'],
  ['mediumRiskMin', 'Medium-risk threshold', 'Score at or above this is "medium"; below is "high" (1–100)'],
  ['verifiedMinConfidence', 'VERIFIED minimum score', 'Every required check must match AND the score must reach this for VERIFIED (1–100)'],
  ['packagingMatchMin', 'Packaging match threshold (%)', 'Similarity at or above = packaging match'],
  ['packagingPartialMin', 'Packaging partial threshold (%)', 'Similarity at or above = partial match; below = mismatch'],
  ['duplicateThreshold', 'Duplicate sensitivity (scans)', 'Scans of one code within the window that raise a duplicate signal (2–100)'],
  ['duplicateWindowMinutes', 'Duplicate window (minutes)', '1–1440'],
  ['weightMedicineIdentity', 'Weight: medicine identity', 'Relative importance 0–100'],
  ['weightManufacturer', 'Weight: manufacturer', 'Relative importance 0–100'],
  ['weightBatch', 'Weight: batch', 'Relative importance 0–100'],
  ['weightExpiry', 'Weight: expiry', 'Relative importance 0–100'],
  ['weightManufacturingDate', 'Weight: manufacturing date', 'Relative importance 0–100'],
  ['weightQr', 'Weight: QR verification', 'Relative importance 0–100'],
  ['weightPackaging', 'Weight: packaging similarity', 'Relative importance 0–100'],
  ['weightDuplicate', 'Weight: repeated scans', 'Relative importance 0–100'],
];

export function AdminRiskEngine() {
  const toast = useToast();
  const [data, setData] = useState(null); const [vals, setVals] = useState({}); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const load = () => adminApi.riskEngine().then((d) => { setData(d); setVals(d.risk); }).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);
  async function save(e) {
    e.preventDefault(); setSaving(true);
    try { const r = await adminApi.saveRiskEngine(Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)]))); setVals(r.risk); toast('Risk engine settings saved'); } catch (err) { toast(errorMessage(err), 'error'); } finally { setSaving(false); }
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton rows={6} />;
  return (
    <>
      <PageHeader title="Risk Engine" subtitle="Tune thresholds for the existing risk engine. Values are validated and bounded on the server." />
      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        {RISK_FIELDS.map(([k, label, hint]) => <Card key={k}><Field label={label} hint={`${hint} · default ${data.defaults[k]}`}><input type="number" className={inputCls} value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} required /></Field></Card>)}
        <div className="md:col-span-2"><button className={btn.primary} disabled={saving}>{saving ? 'Saving…' : 'Save thresholds'}</button></div>
      </form>
      <p className="mt-4 text-[12px] text-[var(--color-ink-faint)]">Weights are relative and renormalised over the checks that are available, so a missing check never lowers a score. The decision rules (what counts as verified, mismatch or review) are code and cannot be changed here.</p>
    </>
  );
}

export function AdminSettings() {
  const toast = useToast();
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = () => adminApi.settings().then(setData).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);
  const flip = async (key) => { try { const r = await adminApi.saveSettings({ [key]: !data.system[key] }); setData({ ...data, system: r.system }); toast('Setting saved'); } catch (err) { toast(errorMessage(err), 'error'); } };
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton rows={6} />;
  const ro = data.readOnly;
  const Toggle = ({ k, label, hint }) => <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-3 last:border-0"><div><p className="text-[14px] font-medium">{label}</p><p className="text-[12px] text-[var(--color-ink-faint)]">{hint}</p></div><button type="button" role="switch" aria-checked={data.system[k]} onClick={() => flip(k)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${data.system[k] ? 'bg-[var(--color-primary)]' : 'bg-[#CBD5D1]'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${data.system[k] ? 'left-[22px]' : 'left-0.5'}`} /></button></div>;
  return (
    <>
      <PageHeader title="Settings" subtitle="Safe, non-secret configuration. API keys, JWT secrets and database credentials are never shown here." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Verification features">
          <Toggle k="qrVerificationEnabled" label="QR verification" hint="When off, decoded QR codes are ignored (treated as not detected)." />
        </Card>
        <Card title="Deployment (read-only)">
          <dl className="grid gap-2 text-[13px]">
            <div className="flex justify-between"><dt>OCR provider</dt><dd>{ro.ocrProvider}</dd></div>
            <div className="flex justify-between"><dt>Image similarity</dt><dd>{ro.imageSimilarity}</dd></div>
            <div className="flex justify-between"><dt>Maximum upload</dt><dd>{ro.maxUploadMb} MB</dd></div>
            <div className="flex justify-between"><dt>Allowed formats</dt><dd>{ro.allowedFormats.join(', ')}</dd></div>
          </dl>
          <p className="mt-3 text-[12px] text-[var(--color-ink-faint)]">Change these in the server code / environment, not here. Verification thresholds live under Risk Engine.</p>
        </Card>
      </div>
    </>
  );
}
