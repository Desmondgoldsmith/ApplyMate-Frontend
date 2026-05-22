'use client';

import { memo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import type { InterviewPersonaMemory } from '@/hooks/useInterviewPersonaMemory';
import { formatFocusAreaLabel } from '@/lib/interviewPersonaTone';
import { cn } from '@/lib/utils';

function trendLabel(score: number | null, velocity: number): string {
  if (score != null && score >= 6) return 'Improving steadily';
  if (score != null && score <= -2) return 'Needs consistency';
  if (velocity > 2) return 'Trending up';
  if (velocity < -1) return 'Plateauing';
  return 'Building momentum';
}

function GrowthItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export const InterviewGrowthProfile = memo(function InterviewGrowthProfile({
  memory,
  className,
}: {
  memory: InterviewPersonaMemory;
  className?: string;
}) {
  const {
    repeatedWeaknesses,
    strongestSkillArea,
    primaryFocusArea,
    improvementTrendScore,
    improvementVelocity,
    sessionCount,
    isLoading,
  } = memory;

  const hasContent =
    repeatedWeaknesses.length > 0 ||
    strongestSkillArea ||
    primaryFocusArea ||
    improvementTrendScore != null ||
    sessionCount > 0;

  if (isLoading) {
    return (
      <section
        className={cn('h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]', className)}
        aria-hidden
      />
    );
  }

  if (!hasContent) return null;

  const trend = trendLabel(improvementTrendScore, improvementVelocity);
  const trendUp =
    (improvementTrendScore != null && improvementTrendScore >= 0) || improvementVelocity >= 0;

  return (
    <section
      className={cn('rounded-2xl border border-[#00C9B1]/20 bg-[#00C9B1]/5 p-4 sm:p-5', className)}
      aria-labelledby="interview-growth-profile-heading"
    >
      <h3 id="interview-growth-profile-heading" className="text-sm font-semibold text-white">
        Your Interview Growth Profile
      </h3>
      <p className="mt-1 text-xs text-white/50">
        Memory from your recent practice — questions and coaching adapt over time.
      </p>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <GrowthItem label="Repeated weaknesses">
          {repeatedWeaknesses.length ? (
            <ul className="mt-1 space-y-0.5 text-sm text-white/85">
              {repeatedWeaknesses.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-white/60">No recurring patterns yet — keep practicing.</p>
          )}
        </GrowthItem>

        <GrowthItem label="Improvement trend">
          <div className="mt-1 flex items-center gap-2 text-sm text-white/85">
            {trendUp ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            ) : (
              <TrendingDown className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            )}
            <span>{trend}</span>
          </div>
        </GrowthItem>

        <GrowthItem label="Strongest skill area">
          <p className="mt-1 text-sm font-medium text-emerald-200/95">
            {strongestSkillArea ?? 'Emerging — complete more sessions to identify strengths.'}
          </p>
        </GrowthItem>

        <GrowthItem label="Next focus area">
          <p className="mt-1 text-sm font-medium text-[#00C9B1]">
            {primaryFocusArea
              ? formatFocusAreaLabel(primaryFocusArea)
              : 'Structure and clarity in your next answers.'}
          </p>
        </GrowthItem>
      </dl>
    </section>
  );
});
