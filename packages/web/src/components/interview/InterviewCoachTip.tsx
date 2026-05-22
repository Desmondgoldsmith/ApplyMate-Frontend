'use client';

import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import type { TurnCoaching } from '@/lib/interview-prep-types';
import { formatFocusAreaLabel } from '@/lib/interviewPersonaTone';
import { cn } from '@/lib/utils';

export const InterviewCoachTip = memo(function InterviewCoachTip({
  coaching,
  personaName,
  className,
  defaultOpen = true,
}: {
  coaching: TurnCoaching;
  personaName?: string;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const focusLabel = formatFocusAreaLabel(coaching.focusArea);

  return (
    <div
      className={cn(
        'ip-coach-tip rounded-xl border border-[var(--border-teal)]/30 bg-[var(--teal-10)]/80 p-3 shadow-lg backdrop-blur-sm',
        className,
      )}
      role="complementary"
      aria-label="Coach tip"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-xs font-semibold text-[var(--text-teal)]">
          💡 Coach tip{personaName ? ` · ${personaName}` : ''}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {coaching.message ? (
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{coaching.message}</p>
          ) : null}
          <p className="text-[11px] font-medium text-[var(--text-primary)]">
            <span className="text-[var(--text-muted)]">🎯 Focus:</span> {focusLabel}
          </p>
          <p className="text-xs leading-relaxed text-[var(--text-primary)]">
            <span className="font-semibold text-[var(--text-teal)]">⚡ Quick win:</span> {coaching.tip}
          </p>
        </div>
      ) : null}
    </div>
  );
});
