'use client';

import dynamic from 'next/dynamic';
import { memo, useMemo } from 'react';

import { toInterviewChartPoints } from '@/lib/interviewChartData';
import type { ProgressTrendPoint } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const InterviewScoreBarChart = dynamic(
  () =>
    import('@/components/interview/InterviewScoreBarChart').then((m) => m.InterviewScoreBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-surface-2)]" />
    ),
  },
);

export const GrowthTrendChart = memo(function GrowthTrendChart({
  points,
  focusAreas,
  className,
}: {
  points: ProgressTrendPoint[];
  focusAreas?: string[];
  className?: string;
}) {
  const chartPoints = useMemo(() => toInterviewChartPoints(points), [points]);

  const delta = useMemo(() => {
    if (chartPoints.length < 2) return null;
    const first = chartPoints[0]!.score;
    const latest = chartPoints[chartPoints.length - 1]!.score;
    return Math.round(latest - first);
  }, [chartPoints]);

  if (chartPoints.length < 2) {
    return (
      <p className={cn('text-xs text-white/45', className)}>
        Complete another session to see your trend chart.
      </p>
    );
  }

  const latest = chartPoints[chartPoints.length - 1]!.score;
  const first = chartPoints[0]!.score;

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-medium text-white/70">Readiness trend</span>
        {delta != null ? (
          <span
            className={cn(
              'font-semibold tabular-nums',
              delta >= 0 ? 'text-emerald-300' : 'text-amber-200',
            )}
          >
            {delta >= 0 ? '+' : ''}
            {delta} pts
          </span>
        ) : null}
      </div>
      <InterviewScoreBarChart
        points={chartPoints}
        focusAreas={focusAreas}
        height={200}
        barLabel="Readiness"
      />
      {first < 50 && latest >= 65 ? (
        <p className="mt-2 text-[11px] text-emerald-300/90">You crossed the interview-ready threshold.</p>
      ) : null}
    </div>
  );
});
