import { useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ScanLine, User, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import logoIcon from "../../assets/logo-icon.webp";

const navLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/verify", label: "Verify Medicine" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/");
  }

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logoIcon}
            alt="MediTrust logo"
            className="h-9 w-9 shrink-0 object-contain"
            width={36}
            height={36}
          />
          <span className="font-[var(--font-display)] text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">
            MediTrust
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex xl:gap-7">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `text-[14.5px] font-medium transition-colors ${link.hash ? "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]" : ""} ${
                  isActive && !link.hash
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 text-[14.5px] font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
              >
                <User size={15} />
                {user?.name?.split(" ")[0] || "Account"}
              </Link>
              <Link
                to="/history"
                className="text-[14.5px] font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
              >
                History
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-[14.5px] font-medium text-[var(--color-accent)]">
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[14.5px] font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-danger)]"
              >
                <LogOut size={15} />
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-[14.5px] font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
            >
              Login
            </Link>
          )}
          <Link
            to="/verify"
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-[14.5px] font-medium text-white shadow-sm shadow-emerald-900/10 transition-colors hover:bg-[var(--color-primary-dark)]"
          >
            <ScanLine size={16} />
            Verify Medicine
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-ink)] lg:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-[15px] font-medium ${
                    isActive
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      : "text-[var(--color-ink-soft)]"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2.5 border-t border-[var(--color-border)] pt-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium text-[var(--color-ink-soft)]"
                >
                  {user?.name || "Account"}
                </Link>
                <Link
                  to="/history"
                  className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium text-[var(--color-ink-soft)]"
                >
                  History
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium text-[var(--color-accent)]"
                  >
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium text-[var(--color-danger)]"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium text-[var(--color-ink-soft)]"
              >
                Login
              </Link>
            )}
            <Link
              to="/verify"
              className="flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-[15px] font-medium text-white"
            >
              <ScanLine size={16} />
              Verify Medicine
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
