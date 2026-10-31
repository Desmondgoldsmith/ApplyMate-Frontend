'use client';

import { Check } from 'lucide-react';
import { createContext, useContext } from 'react';

import { cn } from '@/lib/utils';

/** When true, CV improvement diff Accept/Reject controls ignore clicks (parent has a request in flight). */
export const CvDiffActionsBusyContext = createContext(false);

/** Labels are plain words; any leading ✓ / ✕ from older callers is dropped (the buttons show their own). */
function cleanLabel(label: string): string {
  return label.replace(/^[✓✕✔✖×]\s*/u, '').trim();
}

export function CvDiffActionPair({
  className,
  acceptLabel,
  rejectLabel,
  onAccept,
  onReject,
  tone = 'theme',
}: {
  className?: string;
  acceptLabel: string;
  rejectLabel: string;
  onAccept?: () => void;
  onReject?: () => void;
  /** `paper`: on the white CV page; `theme`: on app surfaces. */
  tone?: 'theme' | 'paper';
}) {
  const busy = useContext(CvDiffActionsBusyContext);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        className={cn(
          'inline-flex h-8 items-center rounded-lg border px-3 text-[12px] font-semibold transition disabled:pointer-events-none disabled:opacity-40',
          tone === 'paper'
            ? 'border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]'
            : 'border-border-default bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
        )}
        onClick={() => !busy && onReject?.()}
      >
        {cleanLabel(rejectLabel)}
      </button>
      <button
        type="button"
        disabled={busy}
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#17B26A] px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#079455] disabled:pointer-events-none disabled:opacity-40"
        onClick={() => !busy && onAccept?.()}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        {cleanLabel(acceptLabel)}
      </button>
    </div>
  );
}
