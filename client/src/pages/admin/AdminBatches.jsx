import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, DataTable, Pagination, Modal, Confirm, Field, SearchBox, ListBody, Badge, statusTone, btn, inputCls, usePaged, useDebounced, useToast } from '../../components/admin/ui.jsx';

const STATUSES = ['ACTIVE', 'EXPIRED', 'RECALLED', 'SUSPENDED'];
const EMPTY = { batchNumber: '', medicineId: '', manufacturer: '', manufacturingDate: '', expiryDate: '', mrp: '', qrCode: '', barcode: '', status: 'ACTIVE' };

export default function AdminBatches() {
  const toast = useToast();
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [medicineId, setMedicineId] = useState('');
  const dq = useDebounced(q);
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const list = usePaged(adminApi.batches, { q: dq, status, medicineId });
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const [saving, setSaving] = useState(false);
  async function loadOptions() {
    setOptionsLoading(true);
    setOptionsError('');
    try {
      const result = await adminApi.medicineOptions('');
      setOptions(result.items);
    } catch (err) {
      setOptionsError(errorMessage(err, 'Could not load medicines.'));
    } finally {
      setOptionsLoading(false);
    }
  }
  useEffect(() => {
    let mounted = true;
    adminApi.medicineOptions('')
      .then((result) => { if (mounted) setOptions(result.items); })
      .catch((err) => { if (mounted) setOptionsError(errorMessage(err, 'Could not load medicines.')); })
      .finally(() => { if (mounted) setOptionsLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function save(e) {
    e.preventDefault(); setSaving(true);
    try {
      const { id, ...body } = edit;
      ['medicineName', 'medicineStrength', 'createdAt', 'updatedAt', '_id', '__v'].forEach((k) => delete body[k]);
      if (id) await adminApi.updateBatch(id, body); else await adminApi.createBatch(body);
      toast(id ? 'Batch updated' : 'Batch created'); setEdit(null); list.reload();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setSaving(false); }
  }

  const cols = [
    { key: 'batchNumber', label: 'Batch', render: (b) => <span className="font-[var(--font-mono)] text-[12.5px]">{b.batchNumber}</span> },
    { key: 'medicineName', label: 'Medicine', render: (b) => `${b.medicineName || '—'} ${b.medicineStrength || ''}` },
    { key: 'manufacturingDate', label: 'Mfg' }, { key: 'expiryDate', label: 'Expiry' },
    { key: 'codes', label: 'Codes', render: (b) => <div className="flex gap-1">{b.qrCode && <Badge tone="cyan">QR</Badge>}{b.barcode && <Badge tone="cyan">Barcode</Badge>}{!b.qrCode && !b.barcode && '—'}</div> },
    { key: 'status', label: 'Status', render: (b) => <Badge tone={statusTone(b.status)}>{b.status}</Badge> },
    { key: 'act', label: '', render: (b) => <div className="flex gap-1.5"><button aria-label="Edit" className={btn.ghost} onClick={() => setEdit({ ...EMPTY, ...b, mrp: b.mrp ?? '', qrCode: b.qrCode || '', barcode: b.barcode || '' })}><Pencil size={14} /></button><button aria-label="Delete" className={btn.ghost} onClick={() => setDel(b)}><Trash2 size={14} /></button></div> },
  ];

  return (
    <>
      <PageHeader title="Batches" subtitle="Registered batches, with their QR codes and barcodes." actions={<button className={btn.primary} onClick={() => { setEdit({ ...EMPTY, medicineId: options[0]?.id || '' }); loadOptions(); }}><Plus size={15} />Add batch</button>} />
      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_200px_150px]">
        <SearchBox value={q} onChange={setQ} placeholder="Search batch number or manufacturer" />
        <select className={inputCls} value={medicineId} onChange={(e) => setMedicineId(e.target.value)} aria-label="Medicine"><option value="">All medicines</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <ListBody list={list} empty="No batches match.">{list.data && <><DataTable columns={cols} rows={list.data.items} /><Pagination {...list.data} onPage={list.setPage} /></>}</ListBody>

      {edit && (
        <Modal title={edit.id ? 'Edit batch' : 'Add batch'} onClose={() => setEdit(null)} wide>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Batch number *"><input required className={inputCls} value={edit.batchNumber} onChange={(e) => setEdit({ ...edit, batchNumber: e.target.value })} /></Field>
            <Field label="Medicine *">
              <select required disabled={optionsLoading || !options.length} className={inputCls} value={edit.medicineId} onChange={(e) => setEdit({ ...edit, medicineId: e.target.value })}>
                <option value="" disabled>{optionsLoading ? 'Loading medicines…' : 'Select…'}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              {optionsError && <span role="alert" className="mt-1 block text-[11.5px] text-[var(--color-danger)]">{optionsError} <button type="button" className="underline" onClick={loadOptions}>Try again</button></span>}
              {!optionsLoading && !optionsError && !options.length && <span className="mt-1 block text-[11.5px] text-[var(--color-ink-faint)]">No medicines available. Add a medicine first, then try again.</span>}
            </Field>
            <Field label="Manufacturer" hint="Defaults to the medicine's manufacturer"><input className={inputCls} value={edit.manufacturer} onChange={(e) => setEdit({ ...edit, manufacturer: e.target.value })} /></Field>
            <Field label="MRP (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={edit.mrp} onChange={(e) => setEdit({ ...edit, mrp: e.target.value })} /></Field>
            <Field label="Manufacturing date * (MM/YYYY)"><input required pattern="(0[1-9]|1[0-2])/\d{4}" placeholder="03/2025" className={inputCls} value={edit.manufacturingDate} onChange={(e) => setEdit({ ...edit, manufacturingDate: e.target.value })} /></Field>
            <Field label="Expiry date * (MM/YYYY)"><input required pattern="(0[1-9]|1[0-2])/\d{4}" placeholder="02/2027" className={inputCls} value={edit.expiryDate} onChange={(e) => setEdit({ ...edit, expiryDate: e.target.value })} /></Field>
            <Field label="QR code payload"><input className={inputCls} value={edit.qrCode} onChange={(e) => setEdit({ ...edit, qrCode: e.target.value })} /></Field>
            <Field label="Barcode"><input className={inputCls} value={edit.barcode} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} /></Field>
            <Field label="Status"><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <div className="flex items-end justify-end gap-2"><button type="button" className={btn.ghost} onClick={() => setEdit(null)}>Cancel</button><button className={btn.primary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
          </form>
        </Modal>
      )}
      {del && <Confirm danger title="Delete batch" confirmLabel="Delete" message={`Delete batch "${del.batchNumber}"? Past verification results are not altered.`} onClose={() => setDel(null)} onConfirm={async () => { try { await adminApi.deleteBatch(del.id); toast('Batch deleted'); setDel(null); list.reload(); } catch (err) { toast(errorMessage(err), 'error'); setDel(null); } }} />}
    </>
  );
}
