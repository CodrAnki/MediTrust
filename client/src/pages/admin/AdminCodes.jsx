import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, Card, DataTable, Badge, EmptyState, Confirm, Skeleton, btn, inputCls, Field, fmtDate, useToast } from '../../components/admin/ui.jsx';

export default function AdminCodes() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ manufacturer: '', payload: '', note: '' });
  const [check, setCheck] = useState(''); const [result, setResult] = useState(null);
  const [del, setDel] = useState(null);
  const load = () => adminApi.manufacturerQr().then((r) => setItems(r.items)).catch((e) => toast(errorMessage(e), 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e) {
    e.preventDefault();
    try { await adminApi.createManufacturerQr(form); toast('Manufacturer QR registered'); setForm({ manufacturer: '', payload: '', note: '' }); load(); } catch (err) { toast(errorMessage(err), 'error'); }
  }
  async function runCheck(e) {
    e.preventDefault();
    try { setResult(await adminApi.checkCode(check.trim())); } catch (err) { toast(errorMessage(err), 'error'); }
  }

  return (
    <>
      <PageHeader title="QR / Barcodes" subtitle="Batch-specific codes are managed on the Batches page; manufacturer-level QR codes are registered here." actions={<Link to="/admin/batches" className={btn.ghost}>Open Batches</Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Check for duplicates">
          <form onSubmit={runCheck} className="flex gap-2"><input required className={inputCls} placeholder="QR payload, barcode or batch number" value={check} onChange={(e) => setCheck(e.target.value)} /><button className={btn.primary}>Check</button></form>
          {result && (result.duplicate
            ? <div className="mt-3 rounded-lg bg-[var(--color-warning-soft)] p-3 text-[13px] text-[#9A5F08]"><p className="font-medium">Already registered:</p><ul className="mt-1">{result.matches.map((m, i) => <li key={i}>{m.type} — {m.reference}</li>)}</ul></div>
            : <p className="mt-3 rounded-lg bg-[var(--color-verified-soft)] p-3 text-[13px] text-[#0F7B3B]">Not registered anywhere — safe to use.</p>)}
          <p className="mt-3 text-[12px] text-[var(--color-ink-faint)]">Uniqueness is also enforced by the backend whenever a batch or manufacturer QR is saved.</p>
        </Card>
        <Card title="Register manufacturer QR">
          <form onSubmit={add} className="grid gap-3">
            <Field label="Manufacturer *"><input required className={inputCls} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></Field>
            <Field label="QR payload *"><input required className={inputCls} value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} /></Field>
            <Field label="Note"><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <button className={btn.primary}><Plus size={15} />Register</button>
          </form>
        </Card>
      </div>
      <h2 className="mb-3 mt-6 text-[15px] font-semibold">Registered manufacturer QR codes</h2>
      {!items ? <Skeleton rows={3} /> : !items.length ? <EmptyState text="No manufacturer QR codes registered." /> : (
        <DataTable rows={items} columns={[
          { key: 'manufacturer', label: 'Manufacturer' },
          { key: 'payload', label: 'Payload', render: (r) => <span className="break-all font-[var(--font-mono)] text-[12px]">{r.payload}</span> },
          { key: 'note', label: 'Note' }, { key: 'createdAt', label: 'Added', render: (r) => fmtDate(r.createdAt) },
          { key: 'act', label: '', render: (r) => <button aria-label="Delete" className={btn.ghost} onClick={() => setDel(r)}><Trash2 size={14} /></button> },
        ]} />
      )}
      {del && <Confirm danger title="Delete manufacturer QR" confirmLabel="Delete" message={`Remove the QR registered for ${del.manufacturer}? Scans of this code will no longer be trusted.`} onClose={() => setDel(null)} onConfirm={async () => { try { await adminApi.deleteManufacturerQr(del.id); toast('Deleted'); setDel(null); load(); } catch (err) { toast(errorMessage(err), 'error'); setDel(null); } }} />}
    </>
  );
}
