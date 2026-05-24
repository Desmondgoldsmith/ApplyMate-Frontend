'use client';

import { memo, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import {
  useAdaptiveProfile,
  useInterviewPrepProgress,
} from '@/hooks/useInterviewPrep';
import { useInterviewSessions } from '@/hooks/useInterviews';
import {
  enrichProgressTrendPoints,
  scoreFromProgressTrendPoint,
} from '@/lib/interviewDisplayScore';
import { SUGGESTED_MODE_LABELS } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const GrowthTrendChart = dynamic(
  () =>
    import('@/components/interview/GrowthTrendChart').then(
      (m) => m.GrowthTrendChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-surface-2)]" />
    ),
  },
);

export const ProgressCoachPanel = memo(function ProgressCoachPanel({
  className,
}: {
  className?: string;
}) {
  const profileQ = useAdaptiveProfile();
  const progressQ = useInterviewPrepProgress();
  const sessionsQ = useInterviewSessions();

  const trendPoints = useMemo(() => {
    const sessions = sessionsQ.data ?? [];
    const fromProgress = progressQ.data?.readinessGrowthChart;
    if (fromProgress?.length) {
      const mapped = fromProgress.map((p, i) => ({
        sessionId: `chart-${i}`,
        compositeScore: p.readinessScore,
        readinessScore: p.readinessScore,
        capturedAt: p.capturedAt,
      }));
      return enrichProgressTrendPoints(mapped, sessions);
    }
    const raw =
      progressQ.data?.improvementTrend ??
      profileQ.data?.improvementTrend ??
      progressQ.data?.sessions ??
      [];
    return enrichProgressTrendPoints(raw, sessions);
  }, [profileQ.data, progressQ.data, sessionsQ.data]);

  const recommended =
    profileQ.data?.recommendedDifficulty ??
    profileQ.data?.recommendedDifficulty ??
    'adaptive';

  const lastDelta = useMemo(() => {
    if (trendPoints.length < 2) return null;
    const sorted = [...trendPoints].sort(
      (a, b) =>
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );
    const prev = sorted[sorted.length - 2];
    const last = sorted[sorted.length - 1];
    if (!prev || !last) return null;
    const score = scoreFromProgressTrendPoint(last);
    const prevScore = scoreFromProgressTrendPoint(prev);
    if (score == null || prevScore == null) return null;
    return Math.round(score - prevScore);
  }, [trendPoints]);

  const recommendedLabel =
    SUGGESTED_MODE_LABELS[recommended] ?? recommended.replace(/_/g, ' ');

  if (profileQ.isLoading && progressQ.isLoading) {
    return (
      <div
        className={cn('ip-surface h-48 animate-pulse', className)}
        aria-hidden
      />
    );
  }

  return (
    <section
      className={cn(
        'ip-surface relative min-w-0 max-w-full p-5 sm:p-6',
        className,
      )}
      aria-labelledby="progress-coach-heading"
    >
      <span className="ip-badge-training">Training active</span>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0 pr-0 lg:pr-28">
          <h2
            id="progress-coach-heading"
            className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]"
          >
            <Sparkles className="h-4 w-4 text-[var(--text-teal)]" aria-hidden />
            Your progress coach
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            The system tracks your patterns and recommends what to practice
            next.
          </p>

          <p className="ip-section-label mt-5">Since last session</p>
          <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
            {lastDelta != null ? (
              <>
                {lastDelta >= 0 ? 'Improved' : 'Down'}{' '}
                <span
                  className={
                    lastDelta >= 0
                      ? 'text-[var(--text-green)]'
                      : 'text-[var(--text-amber)]'
                  }
                >
                  {lastDelta >= 0 ? '+' : ''}
                  {lastDelta} pts
                </span>{' '}
                on your readiness score.
              </>
            ) : (
              "Complete your next session to see how you're improving."
            )}
          </p>

          <p className="mt-4 text-[13px] text-[var(--text-secondary)]">
            Recommended next:{' '}
            <span className="inline-flex rounded-[var(--radius-pill)] border border-[var(--border-teal)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-teal)]">
              {recommendedLabel}
            </span>
          </p>

          {trendPoints.length > 1 ? (
            <div className="mt-5">
              <GrowthTrendChart
                points={trendPoints}
                focusAreas={
                  progressQ.data?.weakestCategories ??
                  profileQ.data?.weakestCategories ??
                  profileQ.data?.recommendedFocusAreas
                }
              />
            </div>
          ) : null}
        </div>

        <div className="w-full lg:w-[min(100%,200px)]">
          <button
            type="button"
            className="ip-btn-primary ip-btn-primary-lg w-full"
            onClick={() => {
              const wizard = document.getElementById('interview-setup-wizard');
              wizard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Start a session →
          </button>
        </div>
      </div>
    </section>
  );
});
