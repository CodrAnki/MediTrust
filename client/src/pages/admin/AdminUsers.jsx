import { useState } from 'react';
import { adminApi, errorMessage } from '../../services/adminApi.js';
import { PageHeader, DataTable, Pagination, Modal, SearchBox, ListBody, Badge, statusTone, btn, inputCls, usePaged, useDebounced, fmtDate, useToast } from '../../components/admin/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [q, setQ] = useState(''); const [role, setRole] = useState('');
  const list = usePaged(adminApi.users, { q: useDebounced(q), role });
  const [hist, setHist] = useState(null);

  const toggle = async (u) => { try { await adminApi.setUserActive(u.id, !u.isActive); toast(u.isActive ? 'User deactivated' : 'User activated'); list.reload(); } catch (err) { toast(errorMessage(err), 'error'); } };
  const open = async (u) => { try { const r = await adminApi.userHistory(u.id); setHist({ user: u, items: r.items }); } catch (err) { toast(errorMessage(err), 'error'); } };

  const cols = [
    { key: 'name', label: 'User', render: (u) => <div><p className="font-medium">{u.name}</p><p className="text-[11.5px] text-[var(--color-ink-faint)]">{u.email}</p></div> },
    { key: 'role', label: 'Role', render: (u) => <Badge tone={u.role === 'admin' ? 'cyan' : 'gray'}>{u.role}</Badge> },
    { key: 'registeredAt', label: 'Registered', render: (u) => fmtDate(u.registeredAt) },
    { key: 'lastActivity', label: 'Last activity', render: (u) => fmtDate(u.lastActivity) },
    { key: 'verificationCount', label: 'Verifications' },
    { key: 'isActive', label: 'Status', render: (u) => <Badge tone={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'act', label: '', render: (u) => <div className="flex gap-1.5"><button className={btn.ghost} onClick={() => open(u)}>History</button>{u.role !== 'admin' && u.id !== me?.id && <button className={btn.ghost} onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>}</div> },
  ];

  return (
    <>
      <PageHeader title="Users" subtitle="Accounts and their verification activity. Passwords are never shown." />
      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_160px]"><SearchBox value={q} onChange={setQ} placeholder="Search name or email" /><select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">All roles</option><option value="user">Users</option><option value="admin">Admins</option></select></div>
      <ListBody list={list} empty="No users match.">{list.data && <><DataTable columns={cols} rows={list.data.items} /><Pagination {...list.data} onPage={list.setPage} /></>}</ListBody>
      {hist && <Modal title={`History — ${hist.user.name}`} onClose={() => setHist(null)} wide>
        {!hist.items.length ? <p className="text-[13.5px] text-[var(--color-ink-faint)]">No verifications yet.</p> : <ul className="divide-y divide-[var(--color-border)]">{hist.items.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]"><span className="truncate">{s.medicineName} <span className="text-[var(--color-ink-faint)]">· {fmtDate(s.createdAt)}</span></span><Badge tone={statusTone(s.verificationStatus)}>{s.verificationStatus}</Badge></li>)}</ul>}
      </Modal>}
    </>
  );
}
