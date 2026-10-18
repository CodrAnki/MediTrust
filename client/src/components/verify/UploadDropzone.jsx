import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES } from '../../utils/fileValidation.js';

export default function UploadDropzone({
  onFileSelected,
  disabled = false,
  multiple = true,
  title = '+ Add Image',
  description = 'Drag and drop, or click to browse',
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const files = [...(e.dataTransfer.files || [])];
    if (files.length) onFileSelected(multiple ? files : files.slice(0, 1));
  }

  function handleChange(e) {
    const files = [...(e.target.files || [])];
    if (files.length) onFileSelected(files);
    e.target.value = '';
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
        dragActive
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
          : 'border-[var(--color-border)] bg-[#F8FAFD] hover:border-[var(--color-primary)]/50'
      }`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        <UploadCloud size={22} strokeWidth={1.8} />
      </span>
      <p className="mt-4 text-[15px] font-medium text-[var(--color-ink)]">{title}</p>
      <p className="mt-1.5 text-[13px] text-[var(--color-ink-faint)]">{description}</p>
      <p className="mt-3 text-[12px] text-[var(--color-ink-faint)]">
        JPG, PNG or WEBP · up to 10MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
