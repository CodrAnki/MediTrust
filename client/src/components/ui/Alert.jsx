import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

const styles = {
  success: {
    bg: 'bg-[var(--color-verified-soft)]',
    text: 'text-[#0F7B3B]',
    icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-[var(--color-warning-soft)]',
    text: 'text-[#9A5F08]',
    icon: AlertTriangle,
  },
  error: {
    bg: 'bg-[var(--color-danger-soft)]',
    text: 'text-[#B91C1C]',
    icon: XCircle,
  },
};

export default function Alert({ type = 'error', children, onDismiss }) {
  const style = styles[type] ?? styles.error;
  const Icon = style.icon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl ${style.bg} px-4 py-3 text-[13.5px] ${style.text}`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" strokeWidth={2} />
      <p className="flex-1 leading-relaxed">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
