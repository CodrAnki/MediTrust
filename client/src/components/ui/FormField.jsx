import { forwardRef } from 'react';

const FormField = forwardRef(function FormField(
  { label, id, error, type = 'text', ...inputProps },
  ref
) {
  return (
    <div>
      <label htmlFor={id} className="text-[13.5px] font-medium text-[var(--color-ink)]">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        name={id}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-ink-faint)] ${
          error
            ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
            : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'
        }`}
        {...inputProps}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
});

export default FormField;
