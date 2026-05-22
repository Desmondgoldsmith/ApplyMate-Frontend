'use client';

import { memo } from 'react';

import { ProcessingLoadingShell } from '@/components/ui/ProcessingLoadingShell';
import type { ProcessingInsightsDisplay } from '@/lib/interviewProcessingInsights';
import { cn } from '@/lib/utils';

export const AnswerCoachingLoadingPanel = memo(function AnswerCoachingLoadingPanel({
  insights,
  className,
}: {
  insights: ProcessingInsightsDisplay;
  className?: string;
}) {
  const tips = insights.whileYouWaitTips.filter((t) => t.trim()).slice(0, 3);

  return (
    <div className={cn('flex w-full flex-col items-center justify-center space-y-3', className)}>
      <ProcessingLoadingShell
        variant="card"
        className="mx-auto w-full max-w-md"
        title={insights.headline}
        description={insights.description}
        steps={insights.steps}
      />
      {insights.interviewerContext?.trim() ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            What the interviewer wanted
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            {insights.interviewerContext.trim()}
          </p>
        </div>
      ) : null}
      {tips.length > 0 ? (
        <div className="rounded-lg border border-[var(--border-teal)]/25 bg-[var(--teal-10)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-teal)]">
            While you wait
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            {tips.map((hint) => (
              <li key={hint}>· {hint}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
});
