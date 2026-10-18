import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import AuthCard from "../components/auth/AuthCard.jsx";
import FormField from "../components/ui/FormField.jsx";
import Alert from "../components/ui/Alert.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { validateLoginForm } from "../utils/authValidation.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
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
    const validationErrors = validateLoginForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        navigate("/verify-email", { state: { email: err.response.data.email || form.email.trim(), notice: "Please verify your email to continue.", from: redirectTo } });
        return;
      }
      const message =
        err.code === "ERR_NETWORK"
          ? "Can't reach the server. Check your connection and try again."
          : err.response?.data?.message || "Invalid email or password.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Log in to MediTrust"
      subtitle="Verify medicines and view your scan history."
      footer={
        <span className="text-[var(--color-ink-faint)]">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-[var(--color-primary)]"
          >
            Create one
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
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
        >
          <LogIn size={16} />
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthCard>
  );
}
