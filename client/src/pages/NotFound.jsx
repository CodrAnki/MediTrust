import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-28 text-center sm:px-6">
      <p className="font-[var(--font-display)] text-[64px] font-semibold leading-none text-[var(--color-primary)]">
        404
      </p>
      <h1 className="mt-4 text-[22px] font-semibold text-[var(--color-ink)]">Page not found</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-faint)]">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-primary)]"
      >
        <ArrowLeft size={15} />
        Back to home
      </Link>
    </section>
  );
}
