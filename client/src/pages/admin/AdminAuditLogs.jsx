import { useState } from 'react';
import { adminApi } from '../../services/adminApi.js';
import { PageHeader, DataTable, Pagination, ListBody, Badge, statusTone, inputCls, usePaged, fmtDate } from '../../components/admin/ui.jsx';

export default function AdminAuditLogs() {
  const [action, setAction] = useState(''); const [result, setResult] = useState('');
  const list = usePaged(adminApi.auditLogs, { action, result });
  const cols = [
    { key: 'timestamp', label: 'When', render: (r) => fmtDate(r.timestamp) },
    { key: 'admin', label: 'Admin' },
    { key: 'action', label: 'Action', render: (r) => <span className="font-[var(--font-mono)] text-[12px]">{r.action}</span> },
    { key: 'resource', label: 'Resource', render: (r) => `${r.resource || '—'}${r.resourceId ? ` · ${r.resourceId.slice(-6)}` : ''}` },
    { key: 'result', label: 'Result', render: (r) => <Badge tone={statusTone(r.result)}>{r.result}</Badge> },
    { key: 'ip', label: 'IP' },
  ];
  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Append-only record of administrator activity. Secrets are never stored." />
      <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
        <select className={inputCls} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action"><option value="">All actions</option>{(list.data?.actions || []).map((a) => <option key={a}>{a}</option>)}</select>
        <select className={inputCls} value={result} onChange={(e) => setResult(e.target.value)} aria-label="Result"><option value="">Any result</option><option value="success">Success</option><option value="failure">Failure</option></select>
      </div>
      <ListBody list={list} empty="No audit entries yet.">{list.data && <><DataTable columns={cols} rows={list.data.items} /><Pagination {...list.data} onPage={list.setPage} /></>}</ListBody>
    </>
  );
}
