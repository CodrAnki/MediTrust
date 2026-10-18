import { useState } from 'react';
import { Plus, Pencil, Trash2, Power } from 'lucide-react';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, DataTable, Pagination, Modal, Confirm, Field, SearchBox, ListBody, Badge, btn, inputCls, usePaged, useDebounced, useToast } from '../../components/admin/ui.jsx';

const EMPTY = { medicineName: '', brandName: '', genericName: '', composition: '', strength: '', dosageForm: '', manufacturer: '', mrp: '', packSize: '', description: '' };
const FIELDS = [['medicineName', 'Medicine name *'], ['brandName', 'Brand name'], ['genericName', 'Generic name'], ['composition', 'Composition'], ['strength', 'Strength'], ['dosageForm', 'Dosage form'], ['manufacturer', 'Manufacturer *'], ['mrp', 'MRP (₹)'], ['packSize', 'Pack size']];

export default function AdminMedicines() {
  const toast = useToast();
  const [q, setQ] = useState(''); const [source, setSource] = useState(''); const [active, setActive] = useState('');
  const dq = useDebounced(q);
  const list = usePaged(adminApi.medicines, { q: dq, source, active });
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...edit }; delete body.id;
      if (edit.id) await adminApi.updateMedicine(edit.id, body); else await adminApi.createMedicine(body);
      toast(edit.id ? 'Medicine updated' : 'Medicine created'); setEdit(null); list.reload();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setSaving(false); }
  }
  const toggle = async (m) => { try { await adminApi.updateMedicine(m.id, { active: !m.active }); toast(m.active ? 'Deactivated' : 'Activated'); list.reload(); } catch (err) { toast(errorMessage(err), 'error'); } };

  const cols = [
    { key: 'medicineName', label: 'Medicine', render: (m) => <div><p className="font-medium">{m.medicineName}</p><p className="text-[11.5px] text-[var(--color-ink-faint)]">{[m.strength, m.dosageForm].filter(Boolean).join(' · ') || '—'}</p></div> },
    { key: 'manufacturer', label: 'Manufacturer', render: (m) => m.manufacturer || <span className="text-[var(--color-ink-faint)]">Not available</span> },
    { key: 'source', label: 'Source', render: (m) => <Badge tone={m.source === 'drugsetu' ? 'cyan' : 'gray'}>{m.source === 'drugsetu' ? 'Legacy import' : m.source}</Badge> },
    { key: 'batchCount', label: 'Batches' },
    { key: 'approvedReferenceCount', label: 'Approved refs' },
    { key: 'active', label: 'Status', render: (m) => <Badge tone={m.active ? 'green' : 'gray'}>{m.active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'act', label: '', render: (m) => <div className="flex gap-1.5"><button aria-label="Edit" className={btn.ghost} onClick={() => setEdit({ ...EMPTY, ...Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)) })}><Pencil size={14} /></button><button aria-label="Toggle active" className={btn.ghost} onClick={() => toggle(m)}><Power size={14} /></button><button aria-label="Delete" className={btn.ghost} onClick={() => setDel(m)}><Trash2 size={14} /></button></div> },
  ];

  return (
    <>
      <PageHeader title="Medicines" subtitle="The trusted medicine records used by verification." actions={<button className={btn.primary} onClick={() => setEdit({ ...EMPTY })}><Plus size={15} />Add medicine</button>} />
      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_150px_150px]">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, brand, composition, manufacturer" />
        <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source"><option value="">All sources</option><option value="admin">Admin</option><option value="drugsetu">Legacy import</option><option value="seed">Seed</option></select>
        <select className={inputCls} value={active} onChange={(e) => setActive(e.target.value)} aria-label="Status"><option value="">Any status</option><option value="true">Active</option><option value="false">Inactive</option></select>
      </div>
      <ListBody list={list} empty="No medicines match.">{list.data && <><DataTable columns={cols} rows={list.data.items} /><Pagination {...list.data} onPage={list.setPage} /></>}</ListBody>

      {edit && (
        <Modal title={edit.id ? 'Edit medicine' : 'Add medicine'} onClose={() => setEdit(null)} wide>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([k, label]) => <Field key={k} label={label}><input className={inputCls} value={edit[k] ?? ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} required={label.endsWith('*')} type={k === 'mrp' ? 'number' : 'text'} step="0.01" min="0" /></Field>)}
            <div className="sm:col-span-2"><Field label="Description"><textarea className={`${inputCls} min-h-20`} value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
            <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={btn.ghost} onClick={() => setEdit(null)}>Cancel</button><button className={btn.primary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
          </form>
        </Modal>
      )}
      {del && <Confirm danger title="Delete medicine" confirmLabel="Delete" message={`Delete "${del.medicineName}" and its reference images? This cannot be undone. Medicines that have batches cannot be deleted — deactivate them instead.`} onClose={() => setDel(null)} onConfirm={async () => { try { await adminApi.deleteMedicine(del.id); toast('Medicine deleted'); setDel(null); list.reload(); } catch (err) { toast(errorMessage(err), 'error'); setDel(null); } }} />}
    </>
  );
}
