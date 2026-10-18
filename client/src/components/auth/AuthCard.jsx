import { Link } from "react-router-dom";
import logoFull from "../../assets/logo-full.webp";

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <section className="flex min-h-[calc(100vh-64px-1px)] items-center justify-center px-5 py-14 sm:px-6">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="flex items-center justify-center">
          <img
            src={logoFull}
            alt="MediTrust — Scan. Verify. Trust."
            className="h-16 w-auto object-contain sm:h-[70px]"
          />
        </Link>

        <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-white p-7 shadow-[0_20px_50px_-30px_rgba(15,27,45,0.35)]">
          <h1 className="text-[21px] font-semibold text-[var(--color-ink)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-ink-faint)]">
              {subtitle}
            </p>
          )}

          <div className="mt-6">{children}</div>
        </div>

        {footer && (
          <div className="mt-5 text-center text-[13.5px]">{footer}</div>
        )}
      </div>
    </section>
  );
}
