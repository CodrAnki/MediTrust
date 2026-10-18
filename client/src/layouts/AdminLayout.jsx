import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Pill, Images, Layers, QrCode, ClipboardList, Users, Gauge, Settings, ScrollText, Menu, X, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ToastProvider } from '../components/admin/ui.jsx';

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/medicines', label: 'Medicines', icon: Pill },
  { to: '/admin/reference-images', label: 'Reference Images', icon: Images },
  { to: '/admin/batches', label: 'Batches', icon: Layers },
  { to: '/admin/codes', label: 'QR / Barcodes', icon: QrCode },
  { to: '/admin/verifications', label: 'Verifications', icon: ClipboardList },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/risk-engine', label: 'Risk Engine', icon: Gauge },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => { logout(); navigate('/admin/login'); };

  const links = (
    <nav className="flex flex-col gap-0.5 px-3">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${isActive ? 'bg-white/12 text-white' : 'text-white/65 hover:bg-white/8 hover:text-white'}`}>
          <Icon size={17} />{label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--color-bg)] lg:grid lg:grid-cols-[250px_1fr]">
        <aside className="hidden bg-[var(--color-ink)] py-5 lg:block">
          <div className="mb-6 flex items-center gap-2 px-6 text-white"><ShieldCheck size={22} className="text-[var(--color-primary)]" /><span className="font-[var(--font-display)] text-[17px] font-semibold">MediTrust Admin</span></div>
          {links}
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-[260px] overflow-y-auto bg-[var(--color-ink)] py-5">
              <div className="mb-6 flex items-center justify-between px-6 text-white"><span className="font-[var(--font-display)] text-[17px] font-semibold">MediTrust Admin</span><button aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button></div>
              {links}
            </aside>
          </div>
        )}

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-white/90 px-4 backdrop-blur sm:px-6">
            <button type="button" aria-label="Open menu" className="rounded-lg p-1.5 text-[var(--color-ink)] lg:hidden" onClick={() => setOpen(true)}><Menu size={20} /></button>
            <span className="hidden text-[13px] text-[var(--color-ink-faint)] lg:block">Signed in as <strong className="text-[var(--color-ink)]">{user?.email}</strong></span>
            <button type="button" onClick={signOut} className="flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-danger)]"><LogOut size={15} />Log out</button>
          </header>
          <main className="mx-auto max-w-[1200px] p-4 sm:p-6"><Outlet /></main>
        </div>
      </div>
    </ToastProvider>
  );
}
