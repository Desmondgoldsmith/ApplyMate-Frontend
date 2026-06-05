'use client';

import type { ReactNode } from 'react';

import { DashboardDeepDiveShell } from '@/components/dashboard/DashboardDeepDiveShell';
import { buildDashboardViewModel } from '@/lib/dashboardViewModel';
import { formatSemanticOutlookBand } from '@/lib/dashboardSemanticOutlook';
import {
  effectiveDeterministicIndexValue,
  type CareerMomentumPayload,
  type GoalAlignmentPayload,
  type HabitProgressPayload,
  type PredictiveOutlookPayload,
  type TodayPlanPayload,
} from '@/lib/today-plan';

export const sectionMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export type CommittedExperience = {
  heroTitle: string;
  heroSubtitle: string | null;
  heroCtaHref: string | null;
  heroCtaLabel: string | null;
  heroCtaHelper: string | null;
  heroMinutes: number | null;
  heroShowCta: boolean;
  heroArcLabel: string | null;
  heroContinuityLine: string | null;
  heroWhyMatters: string | null;
  heroEmotionalTone: string | null;
  momentumLine: string | null;
  continuation:
    | NonNullable<ReturnType<typeof buildDashboardViewModel>>['continuation']
    | null;
  pipelineMetrics: NonNullable<
    ReturnType<typeof buildDashboardViewModel>
  >['pipelineMetrics'];
  insightSurfaces: NonNullable<
    ReturnType<typeof buildDashboardViewModel>
  >['informationalSurfaces'];
  mode: string | null;
  narrativeFatigueAdjusted: boolean | null;
  experienceSessionId: string | null;
  experienceRevision: number | null;
  hydrationConsistencyKey: string | null;
};

export function companyInitial(company: string): string {
  const t = company.trim();
  if (!t) return '?';
  return t.charAt(0).toUpperCase();
}

export function greetingLine(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${name}.`;
  if (h < 17) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

export function getPersonalisedSubtext(
  cvProfileCount: number,
  totalJobsAnalyzed: number,
): string {
  if (cvProfileCount === 0) {
    return "Let's get your CV set up — it takes less than 2 minutes.";
  }
  if (totalJobsAnalyzed === 0) {
    return 'Your CV is ready. Paste a job description to see how well you match.';
  }
  return `You've analyzed ${totalJobsAnalyzed} jobs. Keep going.`;
}

const HABIT_BAND_LABEL: Record<
  NonNullable<HabitProgressPayload['streakStatus']>,
  string
> = {
  starting: 'Starting',
  building: 'Building',
  strong: 'Strong',
  elite: 'Elite',
};

export function tierWordFromMomentum(tier: CareerMomentumPayload['tier']): string {
  if (!tier) return '—';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function deepDiveCareerMomentumSummary(data: CareerMomentumPayload): string {
  const v = effectiveDeterministicIndexValue(data.momentumIndex, data.score);
  const scorePart = v != null ? `${v}/100` : '—';
  return `Career Momentum · ${scorePart} · ${tierWordFromMomentum(data.tier)}`;
}

export function deepDivePredictiveSummary(data: PredictiveOutlookPayload): string {
  const band = data.interviewOutlook?.value;
  const bandLabel = band ? formatSemanticOutlookBand(band) : '—';
  const hint =
    data.headline?.trim()?.split(/\s+/).slice(0, 2).join(' ') || 'Outlook';
  return `Interview Outlook · ${bandLabel} · ${hint}`;
}

export function deepDiveGoalSummary(alignment: GoalAlignmentPayload): string {
  const score =
    typeof alignment.score === 'number' && Number.isFinite(alignment.score)
      ? Math.max(0, Math.min(100, Math.round(alignment.score)))
      : null;
  return score != null ? `Goal Alignment · ${score}/100` : 'Goal Alignment';
}

export function deepDiveHabitSummary(data: HabitProgressPayload): string {
  const d =
    typeof data.currentStreakDays === 'number' &&
    Number.isFinite(data.currentStreakDays)
      ? Math.max(0, Math.round(data.currentStreakDays))
      : null;
  const streakPart = d != null ? `${d}-Day Streak` : 'Consistency';
  const band = data.streakStatus ? HABIT_BAND_LABEL[data.streakStatus] : '';
  return band ? `${streakPart} · ${band}` : streakPart;
}

export function deepDiveCareerAchievementsSummary(
  career: TodayPlanPayload['careerAchievements'],
  achievements: TodayPlanPayload['achievements'],
): string {
  const lvl = career?.level;
  if (lvl?.number != null && lvl.title?.trim()) {
    return `Career achievements · Level ${lvl.number} · ${lvl.title.trim()}`;
  }
  if (lvl?.number != null) {
    return `Career achievements · Level ${lvl.number}`;
  }
  if (lvl?.title?.trim()) {
    return `Career achievements · ${lvl.title.trim()}`;
  }
  const tu = career?.summary?.totalUnlocked;
  if (typeof tu === 'number') {
    return `Career achievements · ${tu} unlocked`;
  }
  const earned = Array.isArray(achievements) ? achievements.length : 0;
  return `Career achievements · ${earned} badge${earned === 1 ? '' : 's'}`;
}

export function wrapProgressCore(
  id:
    | 'career_momentum'
    | 'predictive_outlook'
    | 'goal_alignment'
    | 'habit_progress'
    | 'today_plan_achievements',
  summary: string,
  inner: ReactNode,
): ReactNode {
  const anchorId =
    id === 'career_momentum'
      ? 'dashboard-deep-career-momentum'
      : id === 'predictive_outlook'
        ? 'dashboard-deep-predictive-outlook'
        : id === 'goal_alignment'
          ? 'dashboard-deep-goal-alignment'
          : id === 'habit_progress'
            ? 'dashboard-deep-consistency'
            : 'dashboard-deep-achievements';
  return (
    <DashboardDeepDiveShell summary={summary} anchorId={anchorId}>
      {inner}
    </DashboardDeepDiveShell>
  );
}
