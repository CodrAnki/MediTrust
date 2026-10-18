import { Trash2, RefreshCw, FileImage } from 'lucide-react';
import { formatBytes } from '../../utils/formatBytes.js';

export default function ImagePreview({ file, previewUrl, onRemove, onChange }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
      <div className="flex items-center justify-center bg-[#F1F4F9] p-4">
        <img
          src={previewUrl}
          alt="Selected medicine package preview"
          className="max-h-72 rounded-xl object-contain"
        />
      </div>

      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <FileImage size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
              {file.name}
            </p>
            <p className="text-[12px] text-[var(--color-ink-faint)]">{formatBytes(file.size)}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onChange}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <RefreshCw size={14} />
            Change
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove image"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-ink-faint)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
