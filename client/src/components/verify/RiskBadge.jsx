const colorMap = {
  verified: {
    bg: 'bg-[var(--color-verified-soft)]',
    text: 'text-[#0F7B3B]',
    dot: 'bg-[var(--color-verified)]',
  },
  warning: {
    bg: 'bg-[var(--color-warning-soft)]',
    text: 'text-[#9A5F08]',
    dot: 'bg-[var(--color-warning)]',
  },
  danger: {
    bg: 'bg-[var(--color-danger-soft)]',
    text: 'text-[#B91C1C]',
    dot: 'bg-[var(--color-danger)]',
  },
};

export default function RiskBadge({ color, children, size = 'md' }) {
  const style = colorMap[color] ?? colorMap.warning;
  const padding = size === 'lg' ? 'px-4 py-2 text-[14.5px]' : 'px-3 py-1.5 text-[13px]';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-semibold ${style.bg} ${style.text} ${padding}`}
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {children}
    </span>
  );
}
