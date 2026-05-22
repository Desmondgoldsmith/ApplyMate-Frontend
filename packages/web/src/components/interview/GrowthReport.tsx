'use client';

import { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { SkillChipList } from '@/components/interview/SkillChipList';
import { Button } from '@/components/ui/Button';
import { useEnrichedPrepSession, useInterviewImprovementPlan } from '@/hooks/useInterviewPrep';
import { formatCategoryLabel, SUGGESTED_MODE_LABELS } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const GrowthReport = memo(function GrowthReport({
  sessionId,
  className,
}: {
  sessionId: string;
  className?: string;
}) {
  const router = useRouter();
  const enrichedQ = useEnrichedPrepSession(sessionId, Boolean(sessionId));
  const planQ = useInterviewImprovementPlan(sessionId, Boolean(sessionId));

  const comparison = enrichedQ.data?.previousSessionComparison;
  const adaptation = enrichedQ.data?.adaptation;

  const improvedSkills = useMemo(() => {
    if (!comparison?.skillDelta) return [];
    return Object.entries(comparison.skillDelta)
      .filter(([, delta]) => delta > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => formatCategoryLabel(k));
  }, [comparison?.skillDelta]);

  const declinedSkills = useMemo(() => {
    if (!comparison?.skillDelta) return [];
    return Object.entries(comparison.skillDelta)
      .filter(([, delta]) => delta < 0)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([k]) => formatCategoryLabel(k));
  }, [comparison?.skillDelta]);

  const focusItems = useMemo(() => {
    const fromPlan = planQ.data?.items?.slice(0, 3).map((i) => i.action) ?? [];
    if (fromPlan.length >= 3) return fromPlan;
    const targeted = adaptation?.weaknessTargeted?.slice(0, 3 - fromPlan.length) ?? [];
    return [...fromPlan, ...targeted.map(formatCategoryLabel)];
  }, [adaptation?.weaknessTargeted, planQ.data?.items]);

  const suggestedMode = planQ.data?.suggestedMode ?? 'adaptive';
  const suggestedLabel = SUGGESTED_MODE_LABELS[suggestedMode] ?? suggestedMode.replace(/_/g, ' ');

  if (enrichedQ.isLoading && planQ.isLoading) {
    return <section className={cn('h-40 animate-pulse rounded-2xl bg-white/[0.04]', className)} />;
  }

  if (!comparison && !adaptation && !planQ.data) return null;

  return (
    <section
      className={cn('rounded-2xl border border-white/10 bg-[#0C0F0F] p-4 sm:p-5', className)}
      aria-labelledby="growth-report-heading"
    >
      <h3 id="growth-report-heading" className="text-sm font-semibold text-white">
        Your growth report
      </h3>
      {comparison?.improvementInsight ? (
        <p className="mt-2 text-sm leading-relaxed text-white/75">{comparison.improvementInsight}</p>
      ) : null}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">Improved</dt>
          <dd className="mt-1 text-sm text-white/80">
            {improvedSkills.length ? improvedSkills.join(' · ') : 'Complete another session to compare skills.'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">Needs work</dt>
          <dd className="mt-1 text-sm text-white/80">
            {declinedSkills.length ? declinedSkills.join(' · ') : 'No declines vs last session.'}
          </dd>
        </div>
      </dl>

      {comparison?.readinessDelta != null ? (
        <p className="mt-3 text-xs text-white/55">
          Readiness vs last session:{' '}
          <span className={comparison.readinessDelta >= 0 ? 'text-emerald-300' : 'text-amber-200'}>
            {comparison.readinessDelta >= 0 ? '+' : ''}
            {Math.round(comparison.readinessDelta)} pts
          </span>
        </p>
      ) : null}

      {adaptation?.weaknessTargeted?.length ? (
        <SkillChipList
          className="mt-4"
          title="Targeted this session"
          items={adaptation.weaknessTargeted}
          variant="weak"
        />
      ) : null}

      {focusItems.length ? (
        <ol className="mt-4 list-decimal space-y-1 pl-4 text-sm text-white/80">
          {focusItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}

      <p className="mt-4 text-xs text-[#00C9B1]">
        Recommended next mode: <span className="font-semibold">{suggestedLabel}</span>
      </p>

      <Button
        className="mt-4 w-full sm:w-auto"
        onClick={() =>
          router.push(
            `/dashboard/interview?adaptive=1&suggestedMode=${encodeURIComponent(suggestedMode)}`,
          )
        }
      >
        Start next adaptive session
      </Button>
    </section>
  );
});
