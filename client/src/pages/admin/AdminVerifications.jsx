import { useState } from 'react';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, DataTable, Pagination, Modal, SearchBox, ListBody, Badge, statusTone, inputCls, usePaged, useDebounced, fmtDate, btn, useToast } from '../../components/admin/ui.jsx';
import EvidencePanel from '../../components/verify/EvidencePanel.jsx';

const STATUSES = ['VERIFIED_AGAINST_REFERENCE', 'NEEDS_REVIEW', 'MISMATCH_DETECTED', 'EXPIRED', 'REFERENCE_NOT_FOUND', 'NOT_DETECTED', 'NOT_AVAILABLE', 'INVALID_INPUT', 'PROCESSING_FAILED'];
const tick = (v) => (v === null || v === undefined ? '—' : v ? 'Yes' : 'No');

export default function AdminVerifications() {
  const toast = useToast();
  const [f, setF] = useState({ medicine: '', batch: '', status: '', risk: '', from: '', to: '' });
  const filters = { ...f, medicine: useDebounced(f.medicine), batch: useDebounced(f.batch) };
  const list = usePaged(adminApi.verifications, filters);
  const [detail, setDetail] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const open = async (r) => { try { const d = await adminApi.verification(r.id); setDetail(d.item); } catch (err) { toast(errorMessage(err), 'error'); } };

  const cols = [
    { key: 'id', label: 'ID', render: (r) => <button className="font-[var(--font-mono)] text-[12px] text-[var(--color-primary)] underline" onClick={() => open(r)}>{r.id.slice(-8)}</button> },
    { key: 'medicine', label: 'Medicine' }, { key: 'batch', label: 'Batch' },
    { key: 'ocr', label: 'OCR consistent', render: (r) => tick(r.ocr) },
    { key: 'pk', label: 'Packaging', render: (r) => (r.packagingSimilarity != null ? `${r.packagingSimilarity}%` : 'N/A') },
    { key: 'qr', label: 'QR', render: (r) => (r.qr || '—').replace('QR_', '').replace(/_/g, ' ') },
    { key: 'batchResult', label: 'Batch', render: (r) => r.batchResult || '—' },
    { key: 'duplicate', label: 'Duplicate', render: (r) => tick(r.duplicate) },
    { key: 'riskScore', label: 'Score' },
    { key: 'riskLevel', label: 'Risk', render: (r) => <Badge tone={{ low: 'green', medium: 'amber', high: 'red' }[r.riskLevel]}>{r.riskLevel}</Badge> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'createdAt', label: 'When', render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Verifications" subtitle="Read-only log. Historical results cannot be edited or deleted from the admin." />
      <div className="mb-4 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <SearchBox value={f.medicine} onChange={(v) => setF({ ...f, medicine: v })} placeholder="Medicine" />
        <SearchBox value={f.batch} onChange={(v) => setF({ ...f, batch: v })} placeholder="Batch" />
        <select className={inputCls} value={f.status} onChange={set('status')} aria-label="Status"><option value="">Any status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={inputCls} value={f.risk} onChange={set('risk')} aria-label="Risk"><option value="">Any risk</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <input type="date" className={inputCls} value={f.from} onChange={set('from')} aria-label="From date" />
        <input type="date" className={inputCls} value={f.to} onChange={set('to')} aria-label="To date" />
      </div>
      <ListBody list={list} empty="No verifications match.">{list.data && <><DataTable columns={cols} rows={list.data.items} /><Pagination {...list.data} onPage={list.setPage} /></>}</ListBody>
      {detail && (
        <Modal title={`Verification ${detail.id.slice(-8)}`} onClose={() => setDetail(null)} wide>
          <p className="mb-3 text-[13px] text-[var(--color-ink-soft)]">{detail.medicineName} · batch {detail.batchNumber} · {detail.user?.email || 'unknown user'} · {fmtDate(detail.createdAt)}</p>
          <p className="mb-3 text-[13px]"><Badge tone={statusTone(detail.verificationStatus)}>{detail.verificationStatus}</Badge> <span className="ml-2">score {detail.riskScore} ({detail.riskLevel})</span></p>
          <EvidencePanel record={detail} />
          {detail.detectedIssues?.length > 0 && <ul className="mt-3 list-disc pl-5 text-[12.5px] text-[var(--color-ink-soft)]">{detail.detectedIssues.map((i, n) => <li key={n}>{i}</li>)}</ul>}
          <div className="mt-4 text-right"><button className={btn.ghost} onClick={() => setDetail(null)}>Close</button></div>
        </Modal>
      )}
    </>
  );
}
