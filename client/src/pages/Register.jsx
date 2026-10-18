import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import AuthCard from '../components/auth/AuthCard.jsx';
import FormField from '../components/ui/FormField.jsx';
import Alert from '../components/ui/Alert.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateRegisterForm } from '../utils/authValidation.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((errs) => ({ ...errs, [name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validateRegisterForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await register(form);
      navigate('/verify-email', { replace: true, state: { email: result.email || form.email.trim(), resendIn: result.resendAvailableInSeconds } });
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresEmailVerification && data.email) {
        // Account exists but isn't confirmed (or the email couldn't be sent): continue on the verify screen.
        navigate('/verify-email', { replace: true, state: { email: data.email, notice: data.message, resendIn: data.retryAfterSeconds } });
        return;
      }
      const message =
        err.code === 'ERR_NETWORK'
          ? "Can't reach the server. Check your connection and try again."
          : data?.message || 'Could not create your account. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start verifying medicines in under a minute."
      footer={
        <span className="text-[var(--color-ink-faint)]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[var(--color-primary)]">
            Log in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && (
          <Alert type="error" onDismiss={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}

        <FormField
          id="name"
          label="Name"
          autoComplete="name"
          placeholder="Jordan Rivera"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
        >
          <UserPlus size={16} />
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
