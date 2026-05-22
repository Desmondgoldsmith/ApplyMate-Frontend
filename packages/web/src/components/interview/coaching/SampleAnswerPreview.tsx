'use client';

import { ChevronDown } from 'lucide-react';
import { memo } from 'react';

import { cn } from '@/lib/utils';

export const SampleAnswerPreview = memo(function SampleAnswerPreview({
  sampleAnswer,
  className,
}: {
  sampleAnswer: string;
  className?: string;
}) {
  const text = sampleAnswer.trim();
  if (!text) return null;

  return (
    <details
      className={cn(
        'group rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)]',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          Example answer (not required)
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-[var(--border-subtle)] px-3 py-2.5">
        <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
          Template only — use your own experience, not word-for-word.
        </p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
          {text}
        </p>
      </div>
    </details>
  );
});
