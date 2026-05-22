'use client';

import { memo } from 'react';

import { AnswerQualityMeter } from '@/components/interview/coaching/AnswerQualityMeter';
import { StarCoachingHint } from '@/components/interview/StarCoachingHint';
import type { CoachInsight, CoachInsightScore } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const CoachInsightPanel = memo(function CoachInsightPanel({
  insight,
  scores,
  meterClass,
  personaName,
  className,
}: {
  insight: CoachInsight;
  scores: CoachInsightScore;
  meterClass?: string;
  personaName?: string;
  className?: string;
}) {
  const points = (insight.improvementPoints ?? []).filter((p) => p?.trim()).slice(0, 4);

  return (
    <div className={cn('space-y-3', className)} role="region" aria-label="Coach insight">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {personaName ? `${personaName} · ` : ''}Coach insight
        </p>
        {insight.weakAnswer ? (
          <span className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
            Needs work
          </span>
        ) : (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
            On track
          </span>
        )}
      </div>

      {insight.feedback?.trim() ? (
        <p className="text-sm font-medium leading-snug text-[var(--text-primary)]">{insight.feedback.trim()}</p>
      ) : null}

      <AnswerQualityMeter scores={scores} meterClass={meterClass} />

      {insight.hint?.trim() ? (
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-teal)]">Tip — </span>
          {insight.hint.trim()}
        </p>
      ) : null}

      {points.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-[var(--border-subtle)] bg-black/15 px-3 py-2">
          {points.map((point) => (
            <li key={point} className="flex gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              <span className="text-[var(--text-teal)]" aria-hidden>
                •
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {insight.star ? <StarCoachingHint feedback={insight.star} className="pt-0.5" /> : null}
    </div>
  );
});
