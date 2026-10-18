import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import AuthCard from "../components/auth/AuthCard.jsx";
import OtpInput from "../components/auth/OtpInput.jsx";
import Alert from "../components/ui/Alert.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { resendOtpRequest } from "../services/authService.js";

const PENDING_KEY = "mediTrust_pending_email";

// Maps the backend's error codes to messages a person can act on.
function describeError(err) {
  if (err.code === "ERR_NETWORK") return "Can't reach the server. Check your connection and try again.";
  const data = err.response?.data || {};
  switch (data.code) {
    case "OTP_INVALID":
      return data.remainingAttempts !== undefined
        ? `That code is not correct. ${data.remainingAttempts} attempt${data.remainingAttempts === 1 ? "" : "s"} left.`
        : "That code is not correct.";
    case "OTP_EXPIRED": return "This code has expired. Tap “Resend code” to get a new one.";
    case "OTP_TOO_MANY_ATTEMPTS": return "Too many incorrect attempts. Tap “Resend code” to get a new one.";
    case "OTP_COOLDOWN": return data.message;
    case "MAIL_NOT_CONFIGURED": return "Email sending isn't configured on the server yet, so a code can't be sent. Please contact the administrator.";
    case "MAIL_SEND_FAILED": return "We couldn't send the email just now. Please try “Resend code” in a moment.";
    case "ALREADY_VERIFIED": return "This email is already verified. Please log in.";
    default: return data.message || "Something went wrong. Please try again.";
  }
}

export default function VerifyEmail() {
  const { verifyEmail, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The address comes from Register/Login via router state; sessionStorage keeps it across a refresh.
  const email = location.state?.email || sessionStorage.getItem(PENDING_KEY) || "";
  const redirectTo = location.state?.from || "/dashboard";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(location.state?.notice || null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(Number(location.state?.resendIn) || 0);
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  useEffect(() => {
    if (email) sessionStorage.setItem(PENDING_KEY, email);
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  if (!email) return <Navigate to="/register" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      await verifyEmail({ email, otp });
      sessionStorage.removeItem(PENDING_KEY);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.response?.data?.code === "ALREADY_VERIFIED") setAlreadyVerified(true);
      if (["OTP_INVALID", "OTP_EXPIRED", "OTP_TOO_MANY_ATTEMPTS"].includes(err.response?.data?.code)) setOtp("");
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const data = await resendOtpRequest({ email });
      setOtp("");
      setCooldown(data.resendAvailableInSeconds || 60);
      setInfo("If this email is awaiting verification, a new code is on its way.");
    } catch (err) {
      if (err.response?.data?.retryAfterSeconds) setCooldown(err.response.data.retryAfterSeconds);
      setError(describeError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthCard
      title="Verify your email"
      subtitle={`We sent a 6-digit verification code to ${email}. It expires in 10 minutes.`}
      footer={
        <span className="text-[var(--color-ink-faint)]">
          Wrong address?{" "}
          <Link to="/register" onClick={() => sessionStorage.removeItem(PENDING_KEY)} className="font-medium text-[var(--color-primary)]">
            Start again
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <Alert type="error" onDismiss={() => setError(null)}>
            {error}{" "}
            {alreadyVerified && (
              <Link to="/login" className="font-medium underline">Go to log in</Link>
            )}
          </Alert>
        )}
        {info && !error && <Alert type="success" onDismiss={() => setInfo(null)}>{info}</Alert>}

        <OtpInput value={otp} onChange={setOtp} disabled={submitting} hasError={Boolean(error)} />

        <button
          type="submit"
          disabled={submitting || otp.length !== 6}
          className="mt-1 flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
        >
          <MailCheck size={16} />
          {submitting ? "Verifying…" : "Verify Email"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="text-[13.5px] font-medium text-[var(--color-primary)] disabled:text-[var(--color-ink-faint)]"
        >
          {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
        </button>
      </form>
    </AuthCard>
  );
}
