'use client';

import { Calendar } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { DateRangePicker } from '@/components/cv/DateRangePicker';
import { formatCvDateLabel, normalizeCvDateInput } from '@/lib/cvDate';
import { cn } from '@/lib/utils';

const fieldClass =
  'w-full rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0c1010] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)]';

type CvDateFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  helper?: string;
  onFocus?: () => void;
  placeholder?: string;
  /** Prefer year-only picker (education dates) */
  preferYear?: boolean;
};

export function CvDateField({
  label,
  value,
  onChange,
  disabled,
  helper,
  onFocus,
  placeholder = 'e.g. 2018 or Jan 2020',
  preferYear = false,
}: CvDateFieldProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const displayHint = value.trim() ? formatCvDateLabel(value) || value : '';

  return (
    <div ref={rootRef}>
      <label className="mb-1 block text-xs text-white/45">{label}</label>
      <div className="flex gap-1.5">
        <input
          type="text"
          className={cn(fieldClass, 'min-w-0 flex-1')}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={displayHint && displayHint !== value ? `${panelId}-hint` : undefined}
          onChange={(e) => onChange(normalizeCvDateInput(e.target.value))}
          onFocus={onFocus}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`Pick ${label}`}
          aria-expanded={open}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0c1010] text-white/50 transition hover:border-[#00C9B1]/40 hover:text-[#00C9B1] disabled:opacity-40"
          onClick={() => setOpen((v) => !v)}
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
      {displayHint && displayHint !== value.trim() ? (
        <p id={`${panelId}-hint`} className="mt-1 text-[10px] text-white/35">
          Shows as: {displayHint}
        </p>
      ) : null}
      {helper ? <p className="mt-1 text-[10px] text-white/30">{helper}</p> : null}
      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[2000] flex items-end justify-center p-3 sm:items-center"
              onClick={() => setOpen(false)}
            >
              <div
                className="max-h-[min(90dvh,520px)] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={`${label} picker`}
              >
                <DateRangePicker
                  start={value}
                  end=""
                  mode="single"
                  defaultGranularity={preferYear ? 'year' : undefined}
                  onApply={(start) => {
                    onChange(start);
                    setOpen(false);
                  }}
                  onClose={() => setOpen(false)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
