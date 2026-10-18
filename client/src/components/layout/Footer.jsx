import { Link } from "react-router-dom";
import logoIcon from "../../assets/logo-icon.webp";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <img src={logoIcon} alt="MediTrust logo" className="h-8 w-8 shrink-0 object-contain" width={32} height={32} />
              <span className="font-[var(--font-display)] text-[15px] font-semibold text-[var(--color-ink)]">MediTrust</span>
            </div>
            <p className="mt-3 max-w-[260px] text-[13.5px] leading-relaxed text-[var(--color-ink-faint)]">
              Multi-Layer Medicine Verification Platform
            </p>
          </div>

          <FooterColumn
            title="Explore"
            links={[
              { to: "/", label: "Home" },
              { to: "/how-it-works", label: "How It Works" },
              { to: "/verify", label: "Verify Medicine" },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { to: "/contact", label: "Contact" },
              { to: "/privacy", label: "Privacy" },
              { to: "/terms", label: "Terms" },
            ]}
          />
        </div>

        <div className="mt-10 border-t border-[var(--color-border)] pt-6">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-ink-faint)]">
            MediTrust provides a technology-assisted verification assessment based
            on available evidence. Results should not replace professional medical
            advice or official regulatory verification.
          </p>
          <p className="mt-3 text-[12.5px] text-[var(--color-ink-faint)]">
            © {new Date().getFullYear()} MediTrust. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
        {title}
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="text-[13.5px] text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-primary)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
