const colorVar = {
  verified: 'var(--color-verified)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

export default function ScoreRing({ score, color, label }) {
  const ringColor = colorVar[color] ?? colorVar.warning;
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div
      className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full sm:h-44 sm:w-44"
      style={{
        background: `conic-gradient(${ringColor} ${pct * 3.6}deg, var(--color-border) 0deg)`,
      }}
      role="img"
      aria-label={`Authenticity risk score ${score} out of 100`}
    >
      <div className="flex h-[calc(100%-16px)] w-[calc(100%-16px)] flex-col items-center justify-center rounded-full bg-white">
        <span className="font-[var(--font-display)] text-[34px] font-semibold leading-none text-[var(--color-ink)] sm:text-[38px]">
          {score}
        </span>
        <span className="mt-1 text-[12px] text-[var(--color-ink-faint)]">out of 100</span>
        {label && (
          <span className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
