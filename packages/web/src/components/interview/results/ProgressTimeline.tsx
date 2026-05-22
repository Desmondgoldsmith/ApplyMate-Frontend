'use client';

import dynamic from 'next/dynamic';
import { memo, useMemo } from 'react';

import { toInterviewChartPoints } from '@/lib/interviewChartData';
import {
  averageDisplayScore,
  enrichProgressTrendPoints,
} from '@/lib/interviewDisplayScore';
import type { InterviewSession } from '@/lib/api';
import type { InterviewProgressSnapshot } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const InterviewScoreBarChart = dynamic(
  () =>
    import('@/components/interview/InterviewScoreBarChart').then((m) => m.InterviewScoreBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-[var(--radius-md)] bg-white/[0.04]" />
    ),
  },
);

export const ProgressTimeline = memo(function ProgressTimeline({
  progress,
  sessions = [],
  currentSessionId,
  className,
}: {
  progress: InterviewProgressSnapshot | null | undefined;
  sessions?: InterviewSession[];
  currentSessionId?: string;
  className?: string;
}) {
  const enrichedSessions = useMemo(
    () => enrichProgressTrendPoints(progress?.sessions ?? [], sessions),
    [progress?.sessions, sessions],
  );

  const chartPoints = useMemo(() => {
    if (enrichedSessions.length < 2) return [];
    return toInterviewChartPoints(enrichedSessions, { currentSessionId });
  }, [currentSessionId, enrichedSessions]);

  const averageScore = useMemo(() => averageDisplayScore(enrichedSessions), [enrichedSessions]);

  const focusAreas = progress?.weakestCategories ?? [];

  if (chartPoints.length < 2) return null;

  const trend = progress?.trend;

  return (
    <section
      className={cn('rounded-2xl border border-white/10 bg-[#0C0F0F] p-4 sm:p-5', className)}
      aria-labelledby="progress-timeline-heading"
    >
      <h3 id="progress-timeline-heading" className="text-sm font-semibold text-white">
        Your progress
      </h3>
      {trend ? (
        <p className="mt-1 text-xs text-white/50">
          {trend.sessionCount} sessions · avg {averageScore ?? Math.round(trend.averageComposite)}%
          {trend.improvementVelocity > 0 ? (
            <span className="text-emerald-300"> · improving</span>
          ) : trend.improvementVelocity < 0 ? (
            <span className="text-amber-200"> · needs focus</span>
          ) : null}
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-white/40">Hover a bar for score and focus areas.</p>
      <div className="mt-4">
        <InterviewScoreBarChart
          points={chartPoints}
          focusAreas={focusAreas}
          height={200}
          barLabel="Readiness"
        />
      </div>
    </section>
  );
});
