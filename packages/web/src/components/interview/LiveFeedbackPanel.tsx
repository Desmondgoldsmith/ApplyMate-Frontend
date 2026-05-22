'use client';

import { ChevronDown } from 'lucide-react';
import { memo, useMemo } from 'react';

import type { StarFeedback, TurnAnswerScores } from '@/lib/interview-prep-types';
import { formatCategoryLabel } from '@/lib/interview-prep-types';
import type { ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { personaFeedbackMessage } from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

const STAR_PARTS = ['situation', 'task', 'action', 'result'] as const;

function formatScore(value: number): string {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return v === 0 ? '—' : String(v);
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const display = formatScore(value);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[90px] shrink-0 text-xs text-[var(--text-secondary)]">{label}</span>
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div
          className="ip-score-bar-fill h-full rounded-full bg-[var(--teal)]"
          style={{ width: `${v}%` }}
        />
      </div>
      <span
        className={cn(
          'w-7 shrink-0 text-right text-xs font-semibold tabular-nums',
          v > 0 ? 'text-[var(--text-teal)]' : 'text-[var(--text-muted)]',
        )}
      >
        {display}
      </span>
    </div>
  );
}

export const LiveFeedbackPanel = memo(function LiveFeedbackPanel({
  persona,
  scores,
  starFeedback,
  category,
  className,
  open = true,
  onOpenChange,
}: {
  persona: ResolvedInterviewPersona;
  scores?: TurnAnswerScores | null;
  starFeedback?: StarFeedback | null;
  category?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  if (!persona.showMidSessionFeedback) return null;

  const starCompleteness = useMemo(() => {
    if (!starFeedback?.missingParts?.length) return 100;
    const missing = new Set(starFeedback.missingParts);
    const have = STAR_PARTS.filter((p) => !missing.has(p)).length;
    return Math.round((have / STAR_PARTS.length) * 100);
  }, [starFeedback]);

  const liveMessage = personaFeedbackMessage(persona, scores ?? undefined);
  const structureScore = scores?.structureScore ?? starCompleteness;

  return (
    <section
      className={cn('border-b border-[var(--border-subtle)] px-5 py-4', className)}
      aria-label="Live coaching meters"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => onOpenChange?.(!open)}
        aria-expanded={open}
      >
        <p className="ip-section-label">Live feedback</p>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <>
          {liveMessage ? (
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{liveMessage}</p>
          ) : null}
          {category ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Testing:{' '}
              <span className="font-medium text-[var(--text-teal)]">{formatCategoryLabel(category)}</span>
            </p>
          ) : null}
          <div className="mt-3 space-y-2">
            <ScoreRow label="STAR structure" value={structureScore} />
            <ScoreRow label="Clarity" value={scores?.clarityScore ?? 0} />
            <ScoreRow label="Confidence" value={scores?.relevanceScore ?? 0} />
          </div>
          {starFeedback?.suggestionText ? (
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
              {starFeedback.suggestionText}
            </p>
          ) : (
            <p className="mt-2 text-xs italic text-[var(--text-muted)]">Answer to see live scores.</p>
          )}
        </>
      ) : null}
    </section>
  );
});
