import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { errorMessage } from '../../services/adminApi.js';
import { btn, inputCls, Field } from '../../components/admin/ui.jsx';

export default function AdminLogin() {
  const { adminLogin, isAuthenticated, isAdmin, initializing, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(location.state?.forbidden ? 'This area is for administrators only.' : '');
  const [busy, setBusy] = useState(false);

  if (!initializing && isAuthenticated && isAdmin) return <Navigate to="/admin" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (isAuthenticated) logout(); // drop a non-admin session before signing in as admin
      await adminLogin(form);
      navigate(location.state?.from?.startsWith('/admin') ? location.state.from : '/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Couldn't sign in. Please try again."));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-white p-7 shadow-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><ShieldCheck size={22} /></span>
        <h1 className="mt-4 font-[var(--font-display)] text-[22px] font-semibold text-[var(--color-ink)]">Admin sign in</h1>
        <p className="mt-1 text-[13px] text-[var(--color-ink-faint)]">MediTrust administration</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[#B91C1C]">{error}</p>}
        <div className="mt-5 grid gap-4">
          <Field label="Email"><input className={inputCls} type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password"><input className={inputCls} type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <button type="submit" disabled={busy} className={`${btn.primary} py-2.5`}>{busy && <Loader2 size={15} className="animate-spin" />}Sign in</button>
        </div>
      </form>
    </div>
  );
}
