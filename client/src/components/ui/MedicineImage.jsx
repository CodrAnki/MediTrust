import { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';

// A drop-in <img> replacement used everywhere a medicine photo is shown
// (upload preview, processing screen, result page, dashboard, history).
// If `src` is missing or fails to load, this renders a clean placeholder
// instead of the browser's broken-image icon.
export default function MedicineImage({ src, alt = '', className = '', iconSize = 18 }) {
  const [failed, setFailed] = useState(false);

  // Reset the failed state whenever the underlying image changes (e.g. a
  // different scan record, or a new upload replacing the previous one).
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showPlaceholder = !src || failed;

  if (showPlaceholder) {
    return (
      <div
        role="img"
        aria-label={alt || 'Medicine image unavailable'}
        className={`flex items-center justify-center bg-[#F1F4F9] text-[var(--color-ink-faint)] ${className}`}
      >
        <ImageOff size={iconSize} strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
