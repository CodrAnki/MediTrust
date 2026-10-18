import { useRef } from "react";

// Six single-digit boxes with auto-advance, backspace navigation and paste support.
export default function OtpInput({ value, onChange, disabled, hasError }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  function setAt(index, char) {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join("").slice(0, 6));
  }

  function handleChange(index, e) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    setAt(index, char);
    if (char && index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of 6`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={`h-12 w-11 rounded-lg border bg-white text-center text-[20px] font-semibold text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-primary)] disabled:opacity-60 ${
            hasError ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"
          }`}
        />
      ))}
    </div>
  );
}
