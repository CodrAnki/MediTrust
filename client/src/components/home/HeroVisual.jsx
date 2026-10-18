import { ShieldCheck } from 'lucide-react';

// An original, abstract illustration standing in for a medicine package being
// scanned — deliberately not modeled on any real pharmaceutical brand.
export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[var(--color-primary-soft)]" />

      <div className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_20px_60px_-25px_rgba(15,27,45,0.35)]">
        {/* package card */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#F8FAFD] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="h-2.5 w-24 rounded-full bg-[var(--color-ink)]/80" />
              <div className="mt-2 h-2 w-16 rounded-full bg-[var(--color-ink-faint)]/60" />
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-[1px]"
                  style={{
                    backgroundColor: [0, 2, 4, 6, 8].includes(i)
                      ? 'var(--color-ink)'
                      : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="h-1.5 w-full rounded-full bg-[var(--color-border)]" />
            <div className="h-1.5 w-4/5 rounded-full bg-[var(--color-border)]" />
            <div className="h-1.5 w-3/5 rounded-full bg-[var(--color-border)]" />
          </div>

          <div className="mt-5 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[11px] font-medium text-[var(--color-ink-faint)]">
            <span>BATCH PCM20260123</span>
            <span>EXP 12/2028</span>
          </div>

          {/* scan beam, one deliberate motion moment */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden rounded-2xl">
            <div className="animate-scanline absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-[var(--color-primary)]/18 to-transparent" />
          </div>
        </div>

        {/* floating verified badge */}
        <div className="absolute -right-3 top-16 flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 shadow-[0_12px_30px_-12px_rgba(15,27,45,0.3)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-verified-soft)] text-[var(--color-verified)]">
            <ShieldCheck size={15} strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-semibold text-[var(--color-ink)]">Low Risk</p>
            <p className="text-[10.5px] text-[var(--color-ink-faint)]">98.5 / 100</p>
          </div>
        </div>

        {/* floating QR chip */}
        <div className="absolute -left-4 bottom-6 flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white shadow-[0_12px_30px_-14px_rgba(15,27,45,0.3)]">
          <div className="grid grid-cols-4 grid-rows-4 gap-[2px]">
            {[1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0].map((v, i) => (
              <span
                key={i}
                className="h-[3.5px] w-[3.5px] rounded-[0.5px]"
                style={{ backgroundColor: v ? 'var(--color-ink)' : 'transparent' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
