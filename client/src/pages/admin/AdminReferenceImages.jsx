import { useEffect, useState } from 'react';
import { Upload, Check, X as XIcon, Trash2, Replace, Power } from 'lucide-react';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, Pagination, Modal, Confirm, Field, ListBody, Badge, statusTone, btn, inputCls, usePaged, useToast } from '../../components/admin/ui.jsx';

const TYPES = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'STRIP', 'BOTTLE', 'LABEL', 'OTHER'];

export default function AdminReferenceImages() {
  const toast = useToast();
  const [status, setStatus] = useState(''); const [type, setType] = useState(''); const [source, setSource] = useState(''); const [medicineId, setMedicineId] = useState('');
  const [options, setOptions] = useState([]);
  const list = usePaged(adminApi.references, { status, type, source, medicineId });
  const [up, setUp] = useState(null); const [busy, setBusy] = useState(false); const [del, setDel] = useState(null); const [preview, setPreview] = useState(null);

  useEffect(() => { adminApi.medicineOptions('').then((r) => setOptions(r.items)).catch(() => {}); }, []);

  async function upload(e) {
    e.preventDefault();
    if (!up.files?.length) return toast('Select at least one image', 'error');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('medicineId', up.medicineId); fd.append('imageType', up.imageType); fd.append('notes', up.notes || ''); fd.append('approve', String(up.approve));
      [...up.files].forEach((f) => fd.append('images', f));
      const r = await adminApi.uploadReferences(fd);
      toast(`${r.items.length} uploaded${r.rejected.length ? `, ${r.rejected.length} skipped` : ''}`);
      r.rejected.forEach((x) => toast(`${x.name}: ${x.reason}`, 'error'));
      setUp(null); list.reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
      err?.response?.data?.rejected?.forEach((x) => toast(`${x.name}: ${x.reason}`, 'error'));
    } finally { setBusy(false); }
  }
  const patch = async (id, body, msg) => { try { await adminApi.updateReference(id, body); toast(msg); list.reload(); } catch (err) { toast(errorMessage(err), 'error'); } };
  const replaceFile = async (img, file) => { if (!file) return; const fd = new FormData(); fd.append('image', file); await patch(img.id, fd, 'Image replaced — set back to pending for re-review'); };

  return (
    <>
      <PageHeader title="Reference Images" subtitle="Only approved and enabled images are used for packaging comparison." actions={<button className={btn.primary} onClick={() => setUp({ medicineId: options[0]?.id || '', imageType: 'FRONT', notes: '', approve: true, files: null })}><Upload size={15} />Upload</button>} />
      <div className="mb-4 grid gap-2.5 sm:grid-cols-4">
        <select className={inputCls} value={medicineId} onChange={(e) => setMedicineId(e.target.value)} aria-label="Medicine"><option value="">All medicines</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Approval status"><option value="">Any status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">Any type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source"><option value="">Any source</option><option value="admin">Admin</option><option value="drugsetu">Legacy import</option><option value="seed">Seed</option></select>
      </div>

      <ListBody list={list} empty="No reference images match.">
        {list.data && <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {list.data.items.map((img) => (
              <div key={img.id} className={`overflow-hidden rounded-xl border bg-white ${img.enabled ? 'border-[var(--color-border)]' : 'border-dashed opacity-70'}`}>
                <button type="button" className="block aspect-square w-full bg-[#F1F5F4]" onClick={() => setPreview(img)} aria-label="Preview">
                  <img src={img.url} alt={`${img.medicine?.name || 'Medicine'} ${img.imageType}`} loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.opacity = 0.2; }} />
                </button>
                <div className="p-2.5">
                  <p className="truncate text-[12.5px] font-medium">{img.medicine?.name || '—'}</p>
                  <div className="mt-1 flex flex-wrap gap-1"><Badge>{img.imageType}</Badge><Badge tone={statusTone(img.verificationStatus)}>{img.verificationStatus}</Badge>{img.source !== 'admin' && <Badge tone="cyan">{img.source}</Badge>}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {img.verificationStatus !== 'approved' && <button aria-label="Approve" title="Approve" className={btn.ghost} onClick={() => patch(img.id, { verificationStatus: 'approved' }, 'Approved')}><Check size={13} /></button>}
                    {img.verificationStatus !== 'rejected' && <button aria-label="Reject" title="Reject" className={btn.ghost} onClick={() => patch(img.id, { verificationStatus: 'rejected' }, 'Rejected')}><XIcon size={13} /></button>}
                    <button aria-label="Enable or disable" title={img.enabled ? 'Disable' : 'Enable'} className={btn.ghost} onClick={() => patch(img.id, { enabled: !img.enabled }, img.enabled ? 'Disabled' : 'Enabled')}><Power size={13} /></button>
                    <label title="Replace image" className={`${btn.ghost} cursor-pointer`}><Replace size={13} /><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => replaceFile(img, e.target.files[0])} /></label>
                    <button aria-label="Delete" title="Delete" className={btn.ghost} onClick={() => setDel(img)}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination {...list.data} onPage={list.setPage} />
        </>}
      </ListBody>

      {up && (
        <Modal title="Upload reference images" onClose={() => setUp(null)}>
          <form onSubmit={upload} className="grid gap-3">
            <Field label="Medicine *"><select required className={inputCls} value={up.medicineId} onChange={(e) => setUp({ ...up, medicineId: e.target.value })}><option value="" disabled>Select…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
            <Field label="Image type"><select className={inputCls} value={up.imageType} onChange={(e) => setUp({ ...up, imageType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Images (JPG, PNG, WEBP · up to 10)"><input required type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => setUp({ ...up, files: e.target.files })} /></Field>
            <Field label="Notes"><input className={inputCls} value={up.notes} onChange={(e) => setUp({ ...up, notes: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={up.approve} onChange={(e) => setUp({ ...up, approve: e.target.checked })} />Approve on upload (I have verified these are genuine reference packs)</label>
            <div className="flex justify-end gap-2"><button type="button" className={btn.ghost} onClick={() => setUp(null)}>Cancel</button><button className={btn.primary} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button></div>
          </form>
        </Modal>
      )}
      {preview && <Modal title={`${preview.medicine?.name || 'Reference'} · ${preview.imageType}`} onClose={() => setPreview(null)} wide>
        <img src={preview.url} alt="" className="mx-auto max-h-[60vh] rounded-lg" />
        <dl className="mt-4 grid grid-cols-2 gap-2 text-[12.5px]"><div><dt className="text-[var(--color-ink-faint)]">Source</dt><dd>{preview.source}</dd></div><div><dt className="text-[var(--color-ink-faint)]">Status</dt><dd>{preview.verificationStatus}</dd></div><div className="col-span-2"><dt className="text-[var(--color-ink-faint)]">Image hash</dt><dd className="break-all font-[var(--font-mono)]">{preview.imageHash || '—'}</dd></div>{preview.sourceUrl && <div className="col-span-2"><dt className="text-[var(--color-ink-faint)]">Source URL</dt><dd className="break-all">{preview.sourceUrl}</dd></div>}</dl>
      </Modal>}
      {del && <Confirm danger title="Delete reference image" confirmLabel="Delete" message="This permanently removes the image file and record." onClose={() => setDel(null)} onConfirm={async () => { try { await adminApi.deleteReference(del.id); toast('Deleted'); setDel(null); list.reload(); } catch (err) { toast(errorMessage(err), 'error'); setDel(null); } }} />}
    </>
  );
}
