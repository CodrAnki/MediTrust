export default function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
        <p className="text-[13px] text-[var(--color-ink-faint)]">Loading…</p>
      </div>
    </div>
  );
}
