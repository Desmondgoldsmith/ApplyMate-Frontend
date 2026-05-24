'use client';

import { motion } from 'framer-motion';
import {
  BarChart2,
  Briefcase,
  Check,
  FileText,
  GraduationCap,
  MessageSquare,
  Rocket,
  Share2,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { DashboardLandscapeCard } from '@/components/dashboard/DashboardLandscapeCard';
import { DashboardCommandBar } from '@/components/dashboard/DashboardCommandBar';
import { DashboardDeepDiveShell } from '@/components/dashboard/DashboardDeepDiveShell';
import { DashboardFocusSection } from '@/components/dashboard/DashboardFocusSection';
import {
  DashboardStatsRow,
  type DashboardStatChip,
} from '@/components/dashboard/DashboardStatsRow';
import { ContinuationSection } from '@/components/dashboard/ContinuationSection';
import { DashboardUpcomingInterviewsSection } from '@/components/dashboard/DashboardUpcomingInterviewsSection';
import { DashboardInterviewPreparationSection } from '@/components/dashboard/DashboardInterviewPreparationSection';
import { InterviewPendingResultBanner } from '@/components/dashboard/InterviewPendingResultBanner';
import { DashboardRecommendedMoveSection } from '@/components/dashboard/DashboardRecommendedMoveSection';
import { DashboardGoalAlignmentCard } from '@/components/dashboard/DashboardGoalAlignmentCard';
import { DashboardGoalStrategicCoachingCard } from '@/components/dashboard/DashboardGoalStrategicCoachingCard';
import { DashboardAdaptiveCoachingCard } from '@/components/dashboard/DashboardAdaptiveCoachingCard';
import { DashboardCareerAchievementsSection } from '@/components/dashboard/DashboardCareerAchievementsSection';
import { DashboardHabitProgressCard } from '@/components/dashboard/DashboardHabitProgressCard';
import { DashboardMilestoneCelebration } from '@/components/dashboard/DashboardMilestoneCelebration';
import { DashboardCareerMomentumCard } from '@/components/dashboard/DashboardCareerMomentumCard';
import { DashboardPredictiveOutlookCard } from '@/components/dashboard/DashboardPredictiveOutlookCard';
import { DashboardStrategicWeeklyCoachingCard } from '@/components/dashboard/DashboardStrategicWeeklyCoachingCard';
import { DashboardWeeklyBriefingCard } from '@/components/dashboard/DashboardWeeklyBriefingCard';
import { DashboardStrategicCoachingCard } from '@/components/dashboard/DashboardStrategicCoachingCard';
import { AiUsageBadge } from '@/components/dashboard/AiUsageBadge';
import { CreateCVProfileModal } from '@/components/dashboard/CreateCVProfileModal';
import { DashboardCvProfileTeaser } from '@/components/dashboard/DashboardCvProfileTeaser';
import { DashboardUpgradeCard } from '@/components/dashboard/DashboardUpgradeCard';
import {
  AssistantHeaderRenderer,
  planStableForHero,
  HeroRenderer,
  InsightRenderer,
  modeShellClass,
  PipelineRenderer,
} from '@/components/dashboard/experience-renderer';
import { assistantToneHeroAccentClass } from '@/components/dashboard/assistant-voice';
import { MatchScoreRing } from '@/components/dashboard/MatchScoreRing';
import { InfoHint } from '@/components/ui/InfoHint';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { useJobHistory } from '@/hooks/useJobHistory';
import { useTodayPlan } from '@/hooks/useTodayPlan';
import { useWeeklyStallSummary } from '@/hooks/useWeeklyStallSummary';
import { useDashboardSeen } from '@/hooks/useDashboardSeen';
import {
  useGrowthAchievements,
  useGrowthDailyDirection,
  useGrowthMomentumNudges,
  useGrowthProgress,
  useTrackGrowthEvent,
} from '@/hooks/useGrowth';
import type { CvProfileSummary, JobHistoryItem } from '@/lib/api';
import { trackFunnelEvent } from '@/lib/actionFunnel';
import { getDisplayName } from '@/lib/display-name';
import { ensureArray } from '@/lib/ensure-array';
import {
  computeOwnedClusters,
  isHeroDominant,
  shouldRenderSection,
  shouldShowLandscapeSection,
} from '@/lib/dashboardOrchestration';
import {
  buildSecondaryCardsCollapsibleOrder,
  resolveDashboardPhase14Layout,
  shouldShowSecondaryCard,
} from '@/lib/dashboardPhase14Layout';
import {
  buildDashboardCtaHrefSet,
  canonicalDashboardHref,
} from '@/lib/dashboardHrefDedupe';
import { filterFocusItemsRemovingGenericInterviewCoaching } from '@/lib/genericInterviewCoaching';
import { selectActionablePriorityCardIds } from '@/lib/dashboardSectionOrder';
import { buildDashboardFocusItems } from '@/lib/dashboardFocusMerge';
import { resolveRecommendedMove } from '@/lib/dashboardNextBestAction';
import { dashboardVitalsToStatChips } from '@/lib/dashboardVitalsToStatChips';
import {
  dedupeNearDuplicateSentences,
  mergePipelineLandscapeBodies,
  pipelineHeadlineSubsumedByBody,
} from '@/lib/dashboardPipelineNarrative';
import { whereThingsStandPrimaryLine } from '@/lib/dashboardWhereThingsStand';
import {
  canonicalRowByRecommendationId,
  effectiveHeroRecommendationId,
  isOrchestrationV1,
  orchestratedRowByRecommendationId,
} from '@/lib/dashboardOrchestrationModel';
import { buildDashboardViewModel } from '@/lib/dashboardViewModel';
import { resolveExecutionDestination } from '@/lib/executionRouting';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import {
  MOVEMENT_SECTION_HINT,
  MOVEMENT_FIT_TREND_HINT,
  MOVEMENT_FOLLOWUPS_HINT,
  MOVEMENT_ROLES_FORWARD_HINT,
  MOVEMENT_TYPICAL_FIT_HINT,
} from '@/lib/dashboardDashboardHints';
import { TOOLTIP_JOB_MATCH_SCORE } from '@/lib/dashboardIntelligenceTooltips';
import { trackProductEvent } from '@/lib/productAnalytics';
import { emitDashboardBehaviorEvent } from '@/lib/dashboardBehaviorEvents';
import {
  atmosphereForMode,
  dashboardWelcomeLine,
  pickReassuranceLine,
  readLastDashboardOpenMs,
  writeDashboardOpenedNow,
} from '@/components/dashboard/assistant-voice';
import { listContinuationItemsForDisplay } from '@/lib/interviewContinuation';
import {
  dashboardEmptyStateFor,
  effectiveDeterministicIndexValue,
  isAppliedOrLaterState,
  normalizedSectionTitle,
  type CareerMomentumPayload,
  type DashboardExperienceInformationalSurface,
  type GoalAlignmentPayload,
  type HabitProgressPayload,
  type PredictiveOutlookPayload,
  type TodayPlanItem,
  type TodayPlanPayload,
} from '@/lib/today-plan';
import {
  formatConfidenceShort,
  scanLabelForJobHistoryRow,
  subtextClassForMomentumType,
} from '@/lib/todayPlanLabels';
import { mergeDashboardUpcomingInterviews } from '@/lib/upcomingInterviews';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { DashboardProgressIntelligenceCollapsible } from '@/components/dashboard/DashboardProgressIntelligenceCollapsible';

const sectionMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

type CommittedExperience = {
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

function companyInitial(company: string): string {
  const t = company.trim();
  if (!t) return '?';
  return t.charAt(0).toUpperCase();
}

function greetingLine(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${name}.`;
  if (h < 17) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

function getPersonalisedSubtext(
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

function tierWordFromMomentum(tier: CareerMomentumPayload['tier']): string {
  if (!tier) return '—';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function deepDiveCareerMomentumSummary(data: CareerMomentumPayload): string {
  const v = effectiveDeterministicIndexValue(data.momentumIndex, data.score);
  const scorePart = v != null ? `${v}/100` : '—';
  return `Career Momentum · ${scorePart} · ${tierWordFromMomentum(data.tier)}`;
}

function deepDivePredictiveSummary(data: PredictiveOutlookPayload): string {
  const iv = effectiveDeterministicIndexValue(
    data.interviewOutlook,
    data.interviewProbability,
  );
  const pct = iv != null ? `${iv}%` : '—';
  const hint =
    data.headline?.trim()?.split(/\s+/).slice(0, 2).join(' ') || 'Outlook';
  return `Interview Outlook · ${pct} · ${hint}`;
}

function deepDiveGoalSummary(alignment: GoalAlignmentPayload): string {
  const score =
    typeof alignment.score === 'number' && Number.isFinite(alignment.score)
      ? Math.max(0, Math.min(100, Math.round(alignment.score)))
      : null;
  return score != null ? `Goal Alignment · ${score}/100` : 'Goal Alignment';
}

function deepDiveHabitSummary(data: HabitProgressPayload): string {
  const d =
    typeof data.currentStreakDays === 'number' &&
    Number.isFinite(data.currentStreakDays)
      ? Math.max(0, Math.round(data.currentStreakDays))
      : null;
  const streakPart = d != null ? `${d}-Day Streak` : 'Consistency';
  const band = data.streakStatus ? HABIT_BAND_LABEL[data.streakStatus] : '';
  return band ? `${streakPart} · ${band}` : streakPart;
}

function deepDiveCareerAchievementsSummary(
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

function wrapProgressCore(
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

function GrowthProgressCard({
  window,
  onWindowChange,
  emptyStateCopy,
  sectionTitle,
}: {
  window: 'daily' | 'weekly' | 'monthly';
  onWindowChange: (next: 'daily' | 'weekly' | 'monthly') => void;
  emptyStateCopy?: string | null;
  /** Backend-authored section heading (falls back to legacy label when omitted). */
  sectionTitle?: string | null;
}) {
  const progress = useGrowthProgress(window);
  const metrics = progress.data?.metrics;
  const loading = progress.isLoading;
  const movementHeading = sectionTitle?.trim() || 'Your Movement Over Time';

  if (loading) {
    return (
      <section className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <Skeleton height={22} width={200} borderRadius={6} className="mb-4" />
        <Skeleton height={88} width="100%" borderRadius={12} />
      </section>
    );
  }

  const jp = metrics?.jobsProgressed ?? 0;
  const fu = metrics?.followUpsCompleted ?? 0;
  const mq = Math.round(metrics?.matchQualityAvg ?? 0);
  const md = metrics?.matchQualityDelta ?? 0;
  const noMovementYet =
    !loading && jp === 0 && fu === 0 && mq === 0 && md === 0;

  if (noMovementYet) {
    return (
      <section className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[15px] font-semibold text-white/90">
                {movementHeading}
              </p>
              <InfoHint
                text={MOVEMENT_SECTION_HINT}
                buttonClassName="translate-y-px"
              />
            </div>
            <p className="mt-1 text-[12px] text-white/45">
              {emptyStateCopy?.trim() ||
                'Your progress will appear here as you analyze roles and complete applications.'}
            </p>
          </div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((key) => (
              <button
                key={key}
                type="button"
                title={
                  key === 'daily'
                    ? 'Last 24 hours'
                    : key === 'weekly'
                      ? 'Last 7 days'
                      : 'Last 30 days'
                }
                onClick={() => onWindowChange(key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
                  key === window
                    ? 'bg-[#00C9B1] text-[#080A0A]'
                    : 'text-white/50 hover:text-white/80',
                )}
              >
                {key.slice(0, 1)}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[15px] font-semibold text-white/90">
              {movementHeading}
            </p>
            <InfoHint
              text={MOVEMENT_SECTION_HINT}
              buttonClassName="translate-y-px"
            />
          </div>
          <p className="mt-1 text-[12px] text-white/45">
            Steady progress beats chasing perfection.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(['daily', 'weekly', 'monthly'] as const).map((key) => (
            <button
              key={key}
              type="button"
              title={
                key === 'daily'
                  ? 'Last 24 hours'
                  : key === 'weekly'
                    ? 'Last 7 days'
                    : 'Last 30 days'
              }
              onClick={() => onWindowChange(key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
                key === window
                  ? 'bg-[#00C9B1] text-[#080A0A]'
                  : 'text-white/50 hover:text-white/80',
              )}
            >
              {key.slice(0, 1)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Roles you moved forward
            </p>
            <InfoHint text={MOVEMENT_ROLES_FORWARD_HINT} className="shrink-0" />
          </div>
          <p className="mt-1 text-[20px] font-semibold text-white">
            {metrics?.jobsProgressed ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Follow-ups you closed
            </p>
            <InfoHint text={MOVEMENT_FOLLOWUPS_HINT} className="shrink-0" />
          </div>
          <p className="mt-1 text-[20px] font-semibold text-white">
            {metrics?.followUpsCompleted ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Typical fit on analyzed roles
            </p>
            <InfoHint text={MOVEMENT_TYPICAL_FIT_HINT} className="shrink-0" />
          </div>
          <p className="mt-1 text-[20px] font-semibold text-white">
            {Math.round(metrics?.matchQualityAvg ?? 0)}%
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Fit trend vs last window
            </p>
            <InfoHint text={MOVEMENT_FIT_TREND_HINT} className="shrink-0" />
          </div>
          <p
            className={cn(
              'mt-1 text-[20px] font-semibold',
              (metrics?.matchQualityDelta ?? 0) >= 0
                ? 'text-[#00C9B1]'
                : 'text-amber-300',
            )}
          >
            {(metrics?.matchQualityDelta ?? 0) >= 0 ? '+' : ''}
            {(metrics?.matchQualityDelta ?? 0).toFixed(1)}
          </p>
        </div>
      </div>
    </section>
  );
}

function DashboardTopMatchesSection({
  items,
  onInvalidNavigate,
  todayPlanPayload,
}: {
  items: TodayPlanItem[];
  onInvalidNavigate: () => void;
  /** When orchestration v1, canonical CTA + routes from recommendation graph */
  todayPlanPayload?: TodayPlanPayload | null;
}) {
  const router = useRouter();
  const canonById = useMemo(() => {
    if (!todayPlanPayload || !isOrchestrationV1(todayPlanPayload)) return null;
    return canonicalRowByRecommendationId(todayPlanPayload);
  }, [todayPlanPayload]);
  const isAppliedOrLater = (it: TodayPlanItem): boolean => {
    return isAppliedOrLaterState(it.state, it.isApplied);
  };
  const filtered = useMemo(
    () =>
      items.filter((it) => (it.matchScore ?? 0) >= 50 && !isAppliedOrLater(it)),
    [items],
  );
  if (filtered.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-white/90">
            Top matches
          </h2>
          <InfoHint
            text={TOOLTIP_JOB_MATCH_SCORE}
            buttonAriaLabel="What are match scores?"
          />
        </div>
        <Link
          href="/dashboard/job-board"
          className="text-[13px] font-medium text-[#00C9B1] hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {filtered.map((it) => {
          const href = resolveExecutionDestination({
            cta: it.cta,
            reasonCodes: it.reasonCodes,
            actionType: it.ctaHint,
            journeyNextRoute: it.journey?.nextRoute ?? null,
            safeFallback: '/dashboard/jobs',
            orchestrationCanonicalRoute:
              canonById?.get(it.id)?.canonicalRoute ?? null,
            orchestrationFallbackRoute:
              canonById?.get(it.id)?.fallbackRoute ?? null,
          }).href;
          const ctaPill =
            canonById?.get(it.id)?.canonicalActionLabel?.trim() ||
            'Review & apply →';
          const company = it.company ?? 'Company';
          const title = it.jobTitle ?? it.title;
          const score = it.matchScore ?? 0;
          const shellClass = cn(
            'group flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 transition-[border-color,background-color] duration-200 motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:p-4',
            href &&
              'cursor-pointer hover:border-white/[0.12] hover:bg-white/[0.055]',
          );
          const matchScan = formatConfidenceShort(score);
          const inner = (
            <>
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.15)] text-[14px] font-semibold text-[#00C9B1] sm:h-10 sm:w-10">
                  {companyInitial(company)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-[14px] font-semibold text-white">
                      {title}
                    </p>
                    {matchScan ? (
                      <span className="shrink-0 rounded-full border border-[#00C9B1]/28 bg-[#00C9B1]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CF5EA]">
                        {matchScan}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[13px] font-medium text-white/50">
                    {company}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                <MatchScoreRing score={score} size={36} stroke={2} />
                {href ? (
                  <span className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/50 px-4 py-2 text-center text-[13px] font-medium text-[#00C9B1] transition-colors group-hover:bg-[#00C9B1] group-hover:text-[#080A0A] sm:min-h-0">
                    {ctaPill}
                  </span>
                ) : (
                  <span className="text-[13px] font-medium text-white/35">
                    Open in app
                  </span>
                )}
              </div>
            </>
          );
          return href ? (
            <Link
              key={it.id}
              href={href}
              className={shellClass}
              onMouseEnter={() => {
                router.prefetch(href);
                trackFunnelEvent('topmatch_prefetched', {
                  itemId: it.id,
                  href,
                });
              }}
              onFocus={() => {
                router.prefetch(href);
                trackFunnelEvent('topmatch_prefetched', {
                  itemId: it.id,
                  href,
                });
              }}
              onClick={(e) => {
                if (isAppliedOrLater(it)) {
                  e.preventDefault();
                  onInvalidNavigate();
                }
              }}
            >
              {inner}
            </Link>
          ) : (
            <div key={it.id} className={shellClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentAnalysesStickyColumn({
  history,
  onRefreshPriorities,
}: {
  history: ReturnType<typeof useJobHistory>;
  onRefreshPriorities: () => void;
}) {
  const toast = useToast();
  const items = ensureArray<JobHistoryItem>(history.data).slice(0, 4);
  const isInterviewStage = (item: JobHistoryItem): boolean => {
    const state = String(item.state ?? '')
      .trim()
      .toLowerCase();
    const pipeline = String(item.pipelineStatus ?? '')
      .trim()
      .toLowerCase();
    return (
      pipeline === 'interviewing' ||
      state === 'interviewing' ||
      state === 'interview_scheduled' ||
      state === 'interviewed'
    );
  };
  const isAppliedOrLater = (item: JobHistoryItem): boolean => {
    return (
      isAppliedOrLaterState(item.state, item.isApplied) ||
      isAppliedOrLaterState(item.pipelineStatus, item.isApplied)
    );
  };

  const nextStepForAnalysis = (
    item: JobHistoryItem,
  ): { label: string; href: string } => {
    if (isInterviewStage(item)) {
      const qp = new URLSearchParams();
      qp.set('jobAnalysisId', item.id);
      const jt = (item.jobTitle || item.title || '').trim();
      const company = (item.company ?? '').trim();
      const cvProfileId = (item.cvProfileId ?? '').trim();
      const tailoringCvProfileId = (item.tailoredCvProfileId ?? '').trim();
      if (jt) qp.set('jobTitle', jt);
      if (company) qp.set('company', company);
      if (cvProfileId) qp.set('cvProfileId', cvProfileId);
      if (tailoringCvProfileId)
        qp.set('preferredCvProfileId', tailoringCvProfileId);
      if (tailoringCvProfileId)
        qp.set('tailoringCvProfileId', tailoringCvProfileId);
      return {
        label: 'Prep for interview',
        href: `/dashboard/interview?${qp.toString()}`,
      };
    }
    if (isAppliedOrLater(item)) {
      return {
        label: 'Continue in Job Hub',
        href: `/dashboard/jobs?jobId=${encodeURIComponent(item.id)}`,
      };
    }
    if (!item.hasCoverLetter) {
      return {
        label: 'Generate cover letter',
        href: `/dashboard/jobs?jobId=${encodeURIComponent(item.id)}&tab=cover`,
      };
    }
    if (!item.isTailored) {
      return {
        label: 'Tailor CV',
        href: `/dashboard/jobs/analyze?jobId=${encodeURIComponent(item.id)}&openTailor=1`,
      };
    }
    return {
      label: 'Open in Job Hub',
      href: `/dashboard/jobs?jobId=${encodeURIComponent(item.id)}`,
    };
  };

  return (
    <section
      id="dashboard-deep-recent-analyses"
      className="scroll-mt-4 rounded-3xl border border-white/[0.06] bg-white/[0.015] p-4 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.04] sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-white/90">
            Recent analyses
          </h2>
          <InfoHint
            text={TOOLTIP_JOB_MATCH_SCORE}
            buttonAriaLabel="What are match scores?"
          />
        </div>
        <Link
          href="/dashboard/jobs"
          className="text-[13px] font-medium text-[#00C9B1] hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-3">
        {history.isLoading ? (
          <>
            <Skeleton height={64} borderRadius={12} />
            <Skeleton height={64} borderRadius={12} />
            <Skeleton height={64} borderRadius={12} />
          </>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center">
            <BarChart2
              className="mx-auto h-6 w-6 text-[#00C9B1]"
              strokeWidth={1.5}
            />
            <p className="mt-2 text-[13px] font-semibold text-white">
              No analyses yet
            </p>
            <p className="mt-1 text-[12px] font-medium text-white/40">
              Paste a job to see your match score
            </p>
            <Link
              href="/dashboard/jobs/analyze"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#00C9B1] px-4 py-2 text-[13px] font-semibold text-[#080A0A]"
            >
              Analyze a job →
            </Link>
          </div>
        ) : (
          items.map((item) => {
            const company = item.company ?? 'Unknown';
            const title = item.jobTitle || item.title || 'Untitled role';
            const score = item.matchScore ?? 0;
            const next = nextStepForAnalysis(item);
            const scan = scanLabelForJobHistoryRow(item);
            const scanTone =
              scan.tone === 'warn'
                ? 'border-amber-400/35 bg-amber-500/12 text-amber-100'
                : scan.tone === 'passive'
                  ? 'border-white/12 bg-white/[0.06] text-white/48'
                  : 'border-[#00C9B1]/30 bg-[#00C9B1]/11 text-[#9CF5EA]';
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none hover:border-white/[0.11] hover:bg-white/[0.045] hover:shadow-[0_12px_36px_-24px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.15)] text-[13px] font-semibold text-[#00C9B1]">
                    {companyInitial(company)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-[13px] font-medium text-white">
                        {title}
                      </p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
                          scanTone,
                        )}
                      >
                        {scan.label}
                      </span>
                    </div>
                    <p className="truncate text-[11px] font-medium text-white/40">
                      {company} · {formatRelativeEdited(item.createdAt)}
                    </p>
                  </div>
                  <MatchScoreRing score={score} size={36} stroke={2} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-white/45">Next step</p>
                  <Link
                    href={next.href}
                    className="text-[12px] font-medium text-[#00C9B1] hover:underline"
                    onClick={(e) => {
                      const allowedPostApplyLabels = new Set([
                        'Continue in Job Hub',
                        'Prep for interview',
                      ]);
                      if (
                        isAppliedOrLater(item) &&
                        !allowedPostApplyLabels.has(next.label)
                      ) {
                        e.preventDefault();
                        toast.info(
                          'This task was already resolved. Refreshing your current priorities.',
                        );
                        onRefreshPriorities();
                      }
                    }}
                  >
                    {next.label} →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function AnalyzeNextRoleBanner({
  primaryGoal,
  defaultProfile,
}: {
  primaryGoal: string | null | undefined;
  defaultProfile: CvProfileSummary | null;
}) {
  const cvHref =
    defaultProfile != null
      ? `/dashboard/cv?profileId=${encodeURIComponent(defaultProfile.id)}`
      : '/dashboard/cv';

  const config =
    primaryGoal === 'jobs'
      ? {
          icon: Briefcase,
          title: 'Ready to analyze your next role?',
          body: 'Paste any job description to get your match score and a tailored cover letter in about 60 seconds.',
          cta: 'Analyze a Job →',
          href: '/dashboard/jobs/analyze',
        }
      : primaryGoal === 'cv'
        ? {
            icon: FileText,
            title: 'Sharpen your CV in the Clinic',
            body: 'Run a full scan for section-by-section suggestions and a clear score you can improve.',
            cta: 'Open CV Clinic →',
            href: cvHref,
          }
        : primaryGoal === 'interviews'
          ? {
              icon: MessageSquare,
              title: 'Interview prep is on the way',
              body: 'Mock interviews tailored to your role are coming soon — keep your CV ready.',
              cta: 'View interviews →',
              href: '/dashboard/interview',
            }
          : primaryGoal === 'student'
            ? {
                icon: GraduationCap,
                title: 'Start building your story',
                body: 'The student career guide is coming soon. Your CV is the best place to begin.',
                cta: 'Build my CV →',
                href: cvHref,
              }
            : {
                icon: Rocket,
                title: 'Ready to analyze your next role?',
                body: 'Paste any job description to get your match score and a tailored cover letter in about 60 seconds.',
                cta: 'Analyze a Job →',
                href: '/dashboard/jobs/analyze',
              };

  const Icon = config.icon;

  return (
    <motion.section
      {...sectionMotion}
      transition={{
        duration: 0.35,
        delay: 0.45,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="rounded-2xl border border-[rgba(0,201,177,0.3)] bg-gradient-to-br from-[rgba(0,201,177,0.15)] to-[rgba(0,201,177,0.05)] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(0,201,177,0.12)] sm:h-14 sm:w-14">
          <Icon className="h-7 w-7 text-[#00C9B1] sm:h-8 sm:w-8" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold text-white">
            {config.title}
          </h3>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-white/60">
            {config.body}
          </p>
        </div>
      </div>
      <Link
        href={config.href}
        className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#00C9B1] px-4 py-3 text-[14px] font-semibold text-[#080A0A] transition-colors hover:bg-[#33d4c2]"
      >
        {config.cta}
      </Link>
    </motion.section>
  );
}

function GettingStartedChecklist({
  hasCvProfile,
  anyProfileScored,
  totalJobsAnalyzed,
}: {
  hasCvProfile: boolean;
  anyProfileScored: boolean;
  totalJobsAnalyzed: number;
}) {
  const items: Array<{ label: string; done: boolean }> = [
    { label: 'Create your account', done: true },
    { label: 'Build or upload a CV', done: hasCvProfile },
    { label: 'Score your CV', done: anyProfileScored },
    { label: 'Analyze your first job', done: totalJobsAnalyzed > 0 },
  ];

  return (
    <motion.section
      {...sectionMotion}
      transition={{
        duration: 0.35,
        delay: 0.35,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      data-tour="getting-started"
      className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
    >
      <p className="mb-4 text-[15px] font-semibold text-white/90">
        Get the most out of ApplyMate
      </p>
      <div className="flex flex-row flex-wrap gap-x-6 gap-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-[140px] items-center gap-2"
          >
            {item.done ? (
              <Check
                className="h-4 w-4 shrink-0 text-[#00C9B1]"
                strokeWidth={2.5}
              />
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border border-white/25" />
            )}
            <span
              className={
                item.done
                  ? 'text-[13px] font-medium text-white'
                  : 'text-[13px] font-medium text-white/25'
              }
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function DashboardOverviewPageContent() {
  const { data: user } = useCurrentUser();
  const storeUser = useAuthStore((s) => s.user);
  const effectiveUser = user ?? storeUser;
  const primaryGoal = effectiveUser?.primaryGoal ?? null;
  const aiUsage = useDailyAiUsage();

  const analytics = useAnalytics();
  const toast = useToast();
  const { displayRows } = useCvProfileRowsDisplay();
  const effectiveCvCountForCopy = displayRows.length;
  const defaultProfile = useMemo(
    () => displayRows.find((p) => p.isDefault) ?? displayRows[0] ?? null,
    [displayRows],
  );
  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);
  const searchParams = useSearchParams();
  const includeHiddenDashboardCards =
    searchParams.get('includeHiddenDashboardCards') === 'true';
  const todayPlan = useTodayPlan({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
    includeHiddenDashboardCards,
  });
  const cvSectionVisible = shouldRenderSection('cv', todayPlan.data ?? null);
  const analyzeSectionVisible = shouldRenderSection(
    'analyze',
    todayPlan.data ?? null,
  );
  const showAnalyzeNextRoleBanner =
    analyzeSectionVisible &&
    !(cvSectionVisible && (primaryGoal === 'cv' || primaryGoal === 'student'));
  const showCvProfileTeaserPromo =
    !cvSectionVisible &&
    !(
      analyzeSectionVisible &&
      (primaryGoal === 'cv' || primaryGoal === 'student')
    );
  const dashboardVm = useMemo(
    () =>
      buildDashboardViewModel(todayPlan.data, {
        defaultCvProfileId: defaultProfile?.id ?? null,
      }),
    [todayPlan.data, defaultProfile?.id],
  );
  const [committedExp, setCommittedExp] = useState<CommittedExperience | null>(
    null,
  );
  const markDashboardSeen = useDashboardSeen();
  const weeklyStall = useWeeklyStallSummary({ limit: 5 });
  const growthDirection = useGrowthDailyDirection();
  const growthNudges = useGrowthMomentumNudges();
  const growthAchievements = useGrowthAchievements();
  const trackGrowthEvent = useTrackGrowthEvent();
  const welcomeName = getDisplayName(user);
  const history = useJobHistory();
  const totalJobsAnalyzed = analytics.data?.jobsAnalyzed ?? 0;
  const anyProfileScored = displayRows.some((p) => p.score !== null);
  const showChecklist =
    displayRows.length === 0 || !anyProfileScored || totalJobsAnalyzed === 0;

  const [createCvOpen, setCreateCvOpen] = useState(false);
  const [growthWindow, setGrowthWindow] = useState<
    'daily' | 'weekly' | 'monthly'
  >('weekly');
  const [returnWelcomeLine, setReturnWelcomeLine] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const prev = readLastDashboardOpenMs();
    setReturnWelcomeLine(
      dashboardWelcomeLine({ firstName: welcomeName, lastOpenedAtMs: prev }),
    );
    writeDashboardOpenedNow();
  }, [welcomeName]);

  const showLimitInHero =
    !aiUsage.isPaidTier &&
    !aiUsage.isLoading &&
    (aiUsage.remaining ?? 0) === 0 &&
    aiUsage.limit != null;

  const topMatches = todayPlan.data?.topMatches ?? [];
  const dashboardHeader = todayPlan.data?.dashboardHeader;
  const heroAction = dashboardHeader?.actionContext;
  const heroClusterId = (heroAction?.recommendationClusterId ?? '').trim();
  const heroDominant = isHeroDominant(todayPlan.data);
  const hasUnifiedPriorities =
    (todayPlan.data?.unifiedPriorities.items.length ?? 0) > 0;
  const heroSubtext =
    committedExp?.momentumLine?.trim() ||
    (todayPlan.data
      ? dashboardVm?.momentumLine?.trim() ||
        dashboardHeader?.momentumMessage?.trim() ||
        growthDirection.data?.identitySignal ||
        getPersonalisedSubtext(effectiveCvCountForCopy, totalJobsAnalyzed)
      : null);

  const hasCompressedAssistantNarrative = Boolean(
    todayPlan.data?.assistantNarrative?.headline?.trim() &&
    todayPlan.data?.assistantNarrative?.supporting?.trim() &&
    todayPlan.data?.assistantNarrative?.ctaLabel?.trim(),
  );
  const heroActionHeadline = useMemo(() => {
    if (!heroAction) return null;
    const company = (heroAction.companyName ?? '').trim();
    const role = (heroAction.roleTitle ?? '').trim();
    const days =
      typeof heroAction.daysSinceActivity === 'number' &&
      Number.isFinite(heroAction.daysSinceActivity)
        ? Math.max(1, Math.round(heroAction.daysSinceActivity))
        : null;
    if (company && days)
      return `Your ${company} application went quiet ${days} day${days === 1 ? '' : 's'} ago.`;
    if (role && days)
      return `${role} went quiet ${days} day${days === 1 ? '' : 's'} ago.`;
    if (company) return `Your ${company} application needs attention.`;
    if (role) return `${role} needs attention.`;
    return null;
  }, [heroAction]);
  const heroActionBenefit = heroAction?.expectedOutcome?.trim() || null;
  const heroActionCtaLabel = heroAction?.suggestedAction?.trim() || null;
  const heroActionHref = useMemo(() => {
    if (!heroAction) return null;
    return resolveExecutionDestination({
      actionType: heroAction.type,
      executionContext: {
        canonicalRoute: heroAction.canonicalRoute,
        deepLink: heroAction.deepLink,
        fallbackRoute: heroAction.fallbackRoute,
        resolutionState: heroAction.resolutionState,
        applicationId: heroAction.applicationId,
        canonicalJobId: heroAction.canonicalJobId,
        cvProfileId: heroAction.cvProfileId,
      },
      executionPayload: heroAction.executionPayload ?? null,
      ids: {
        applicationId: heroAction.applicationId,
        jobAnalysisId: heroAction.canonicalJobId,
        cvProfileId: heroAction.cvProfileId,
      },
      safeFallback: '/dashboard/jobs',
    }).href;
  }, [heroAction]);
  const orchestratedHero = useMemo(() => {
    const plan = todayPlan.data;
    if (!plan || !isOrchestrationV1(plan)) return null;
    if (dashboardVm?.usesExperienceLayer && dashboardVm.hero?.title?.trim())
      return null;
    const hid = effectiveHeroRecommendationId(plan);
    if (!hid) return null;
    const item = plan.unifiedPriorities.items.find((x) => x.id === hid);
    const row = orchestratedRowByRecommendationId(plan).get(hid);
    if (!item || !row) return null;
    const href = resolveExecutionDestination({
      cta: item.cta,
      kind: item.kind,
      reasonCodes: item.reasonCodes,
      actionType: item.ctaHint,
      executionContext: item.executionContext,
      executionPayload: item.executionPayload,
      journeyNextRoute: item.journey?.nextRoute ?? null,
      ids: item.ids,
      defaultCvProfileId: defaultProfile?.id ?? null,
      orchestrationCanonicalRoute: row.canonicalRoute,
      orchestrationFallbackRoute: row.fallbackRoute,
      safeFallback: '/dashboard/jobs',
    }).href;
    const label = row.canonicalActionLabel?.trim();
    if (!href || !label) return null;
    const minutes =
      typeof item.executionContext?.estimatedMinutes === 'number' &&
      Number.isFinite(item.executionContext.estimatedMinutes)
        ? Math.max(1, Math.round(item.executionContext.estimatedMinutes))
        : null;
    return {
      href,
      label,
      arcLabel: plan.dashboardNarrative?.arcLabel?.trim() || null,
      supportingLine:
        (
          item.compactDisplay?.primaryLine ??
          item.subtitle ??
          item.reasonShort ??
          ''
        ).trim() || null,
      minutes,
    };
  }, [
    todayPlan.data,
    defaultProfile?.id,
    dashboardVm?.usesExperienceLayer,
    dashboardVm?.hero?.title,
  ]);
  const heroActionMinutes =
    typeof heroAction?.estimatedMinutes === 'number' &&
    Number.isFinite(heroAction.estimatedMinutes)
      ? Math.max(1, Math.round(heroAction.estimatedMinutes))
      : null;
  const nudgesTop = useMemo(
    () =>
      [...(growthNudges.data?.items ?? [])]
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3),
    [growthNudges.data?.items],
  );
  const primaryDirectionHref = useMemo(() => {
    const primaryId = growthDirection.data?.dailyDirection.primaryPriorityId;
    const fallbackId =
      growthDirection.data?.continuationState.suggestedPriorityId;
    const targetId = primaryId ?? fallbackId ?? null;
    if (!targetId) return '/dashboard/jobs';
    const item = todayPlan.data?.unifiedPriorities.items.find(
      (x) => x.id === targetId,
    );
    if (!item) return '/dashboard/jobs';
    return resolveExecutionDestination({
      cta: item.cta,
      kind: item.kind,
      reasonCodes: item.reasonCodes,
      actionType: item.ctaHint,
      executionContext: item.executionContext,
      executionPayload: item.executionPayload,
      journeyNextRoute: item.journey?.nextRoute ?? null,
      ids: item.ids,
      defaultCvProfileId: defaultProfile?.id ?? null,
      safeFallback: '/dashboard/jobs',
    }).href;
  }, [
    defaultProfile?.id,
    growthDirection.data,
    todayPlan.data?.unifiedPriorities.items,
  ]);
  const filteredNudges = useMemo(() => {
    const blockedRoutes = new Set<string>();
    const blockedClusters = new Set<string>();
    if (heroActionHref) blockedRoutes.add(heroActionHref);
    if (dashboardVm?.hero?.href) blockedRoutes.add(dashboardVm.hero.href);
    if (orchestratedHero?.href) blockedRoutes.add(orchestratedHero.href);
    if (primaryDirectionHref) blockedRoutes.add(primaryDirectionHref);
    if (heroClusterId) blockedClusters.add(heroClusterId);
    const ownedClusters = computeOwnedClusters(
      todayPlan.data?.unifiedPriorities.items ?? [],
      'hero',
    );
    for (const cluster of ownedClusters) blockedClusters.add(cluster);
    return nudgesTop
      .filter((n) => !blockedRoutes.has(n.route))
      .filter((n) => {
        const cluster = String(
          (n as { recommendationClusterId?: string | null })
            .recommendationClusterId ?? '',
        ).trim();
        return !cluster || !blockedClusters.has(cluster);
      })
      .slice(
        0,
        heroDominant ? 1 : heroActionHref || orchestratedHero?.href ? 1 : 2,
      );
  }, [
    heroActionHref,
    dashboardVm?.hero?.href,
    orchestratedHero?.href,
    nudgesTop,
    primaryDirectionHref,
    heroClusterId,
    todayPlan.data?.unifiedPriorities.items,
    heroDominant,
  ]);

  const footerNudges = useMemo(() => {
    const bannerPromotesAnalyzeJob =
      showAnalyzeNextRoleBanner &&
      primaryGoal !== 'cv' &&
      primaryGoal !== 'student' &&
      primaryGoal !== 'interviews';
    if (!bannerPromotesAnalyzeJob) return filteredNudges;
    return filteredNudges.filter(
      (n) => String(n.route) !== '/dashboard/jobs/analyze',
    );
  }, [filteredNudges, showAnalyzeNextRoleBanner, primaryGoal]);

  useEffect(() => {
    if (!todayPlan.data || markDashboardSeen.isPending) return;
    const storageKey = 'applymate:dashboard:last-seen-marked-at';
    const now = Date.now();
    const minGapMs = 6 * 60 * 60 * 1000;
    let last = 0;
    try {
      last = Number(window.localStorage.getItem(storageKey) ?? 0);
    } catch {
      last = 0;
    }
    if (Number.isFinite(last) && now - last < minGapMs) return;
    markDashboardSeen.mutate(undefined, {
      onSuccess: () => {
        try {
          window.localStorage.setItem(storageKey, String(now));
        } catch {
          // ignore storage failures; seen marker is best effort
        }
      },
    });
  }, [todayPlan.data, markDashboardSeen]);

  // Commit the experience hero once it exists, and keep it stable across refetches.
  useEffect(() => {
    if (!dashboardVm?.usesExperienceLayer) return;
    const st = todayPlan.data?.experienceStability;
    if (!planStableForHero(todayPlan.data)) return;
    if (!dashboardVm.hero?.title?.trim()) return;
    setCommittedExp((prev) => {
      const sessionId = todayPlan.data?.experienceSessionId?.trim() || null;
      const revision =
        typeof todayPlan.data?.experienceRevision === 'number'
          ? todayPlan.data.experienceRevision
          : null;
      const experienceKey =
        sessionId && revision != null ? `${sessionId}:${revision}` : null;
      // If key didn't change, keep stable rendering (no flip-flop / re-animate).
      const hk =
        st?.hydrationConsistencyKey?.trim() ||
        todayPlan.data?.resumeTarget?.hydrationConsistencyKey?.trim() ||
        null;
      if (
        prev &&
        prev.experienceSessionId &&
        prev.experienceRevision != null &&
        experienceKey
      ) {
        const prevKey = `${prev.experienceSessionId}:${prev.experienceRevision}`;
        if (prevKey === experienceKey) return prev;
      }
      if (
        prev &&
        prev.hydrationConsistencyKey &&
        hk &&
        prev.hydrationConsistencyKey === hk
      )
        return prev;
      // If we have a committed hero and no key is available, avoid churn on minor refreshes.
      if (prev && prev.heroTitle.trim() && !hk && !experienceKey) return prev;
      const hero = dashboardVm.hero!;
      const compressedNarrative = Boolean(
        todayPlan.data?.assistantNarrative?.headline?.trim() &&
        todayPlan.data?.assistantNarrative?.supporting?.trim() &&
        todayPlan.data?.assistantNarrative?.ctaLabel?.trim(),
      );
      const exp = todayPlan.data?.dashboardExperience ?? null;
      const pipelineInfo =
        exp?.surfaces.find(
          (s): s is DashboardExperienceInformationalSurface =>
            s.kind === 'informational' &&
            s.category.trim().toLowerCase() === 'pipeline',
        ) ?? null;
      const rawInsights = dashboardVm.informationalSurfaces ?? [];
      const insights = rawInsights.filter(
        (s) => s.category.trim().toLowerCase() !== 'pipeline',
      );
      const dn = todayPlan.data?.dashboardNarrative ?? null;
      const narrative = exp?.narrative ?? null;
      const continuityLine =
        narrative?.momentumCopy?.trim() ||
        dn?.momentumCopy?.trim() ||
        dashboardVm.momentumLine?.trim() ||
        null;
      const heroArcLabel = compressedNarrative
        ? null
        : todayPlan.data?.experienceState?.narrativeFocusLabel?.trim() ||
          todayPlan.data?.humanizedLabels?.narrativeArc?.trim() ||
          dn?.arcLabel?.trim() ||
          hero.arcLabel?.trim() ||
          null;
      const heroContinuityLine =
        compressedNarrative || !continuityLine?.trim()
          ? null
          : continuityLine.trim() !== hero.subtitle?.trim()
            ? continuityLine.trim()
            : null;
      return {
        heroTitle: hero.title.trim(),
        heroSubtitle: hero.subtitle?.trim() || null,
        heroCtaHref: hero.href,
        heroCtaLabel: hero.ctaLabel?.trim() || null,
        heroCtaHelper: hero.ctaHelper?.trim() || null,
        heroMinutes: hero.minutes ?? null,
        heroShowCta: hero.showPrimaryCta,
        heroArcLabel,
        heroContinuityLine,
        heroWhyMatters: compressedNarrative
          ? null
          : hero.expectedOutcome?.trim() || null,
        heroEmotionalTone: hero.emotionalTone?.trim() || null,
        momentumLine: dashboardVm.momentumLine?.trim() || null,
        continuation: dashboardVm.continuation ?? null,
        pipelineMetrics: dashboardVm.pipelineMetrics ?? [],
        // Keep pipeline copy inside the pipeline card; insights hold the rest.
        insightSurfaces: [
          ...(pipelineInfo
            ? [
                {
                  category: 'pipeline',
                  insightCategory: null,
                  visualPriority: pipelineInfo.visualPriority ?? null,
                  headline: pipelineInfo.headline,
                  body: pipelineInfo.body,
                  supportingMetric: pipelineInfo.supportingMetric,
                  visualWeight: 'normal' as const,
                  confidence: pipelineInfo.confidence ?? null,
                  disclosure: null,
                },
              ]
            : []),
          ...insights,
        ],
        mode: dashboardVm.mode ?? null,
        narrativeFatigueAdjusted: narrative?.fatigueAdjusted ?? null,
        experienceSessionId: sessionId,
        experienceRevision: revision,
        hydrationConsistencyKey: hk,
      };
    });
  }, [dashboardVm, todayPlan.data]);

  const landscapeInfoSurface = useMemo(() => {
    const exp = todayPlan.data?.dashboardExperience;
    if (!exp) return null;
    const informational = exp.surfaces.filter(
      (s): s is DashboardExperienceInformationalSurface =>
        s.kind === 'informational',
    );
    return informational.find((s) => s.id?.trim() === 'exp-landscape') ?? null;
  }, [todayPlan.data?.dashboardExperience]);

  const pipelineInfoSurface = useMemo(() => {
    const exp = todayPlan.data?.dashboardExperience;
    if (!exp) return null;
    const informational = exp.surfaces.filter(
      (s): s is DashboardExperienceInformationalSurface =>
        s.kind === 'informational',
    );
    const byPipelineId = informational.find(
      (s) => s.id?.trim() === 'exp-pipeline-snapshot',
    );
    return (
      byPipelineId ??
      informational.find(
        (s) => s.category.trim().toLowerCase() === 'pipeline',
      ) ??
      null
    );
  }, [todayPlan.data?.dashboardExperience]);

  const landscapeSectionTitle = useMemo(() => {
    const p = todayPlan.data;
    return (
      normalizedSectionTitle(p, 'landscape', '') ||
      p?.sectionPayloads?.landscape?.title?.trim() ||
      'Your Landscape'
    );
  }, [todayPlan.data]);

  const landscapeCoachingBody = useMemo(() => {
    const surf = landscapeInfoSurface;
    const sec = todayPlan.data?.sectionPayloads?.landscape;
    if (typeof surf?.body === 'string') return surf.body;
    if (typeof sec?.body === 'string') return sec.body;
    if (typeof surf?.headline === 'string') return surf.headline;
    return null;
  }, [landscapeInfoSurface, todayPlan.data?.sectionPayloads?.landscape]);

  const insightSurfaces = useMemo(() => {
    const raw =
      committedExp?.insightSurfaces ?? dashboardVm?.informationalSurfaces ?? [];
    return raw.filter((s) => {
      const c = s.category.trim().toLowerCase();
      if (c === 'pipeline' || c === 'landscape') return false;
      const sid =
        'surfaceId' in s
          ? String((s as { surfaceId?: string | null }).surfaceId ?? '').trim()
          : '';
      if (sid === 'exp-landscape') return false;
      return true;
    });
  }, [committedExp?.insightSurfaces, dashboardVm?.informationalSurfaces]);

  const [dismissedInsights, setDismissedInsights] = useState<
    ReadonlySet<string>
  >(new Set());
  const visibleInsightSurfaces = useMemo(() => {
    if (dismissedInsights.size === 0) return insightSurfaces;
    return insightSurfaces.filter((s) => {
      const key = `${String(s.category ?? '').trim()}:${String(s.headline ?? '').trim()}:${String(s.insightCategory ?? '').trim()}`;
      return !dismissedInsights.has(key);
    });
  }, [dismissedInsights, insightSurfaces]);

  const showLegacyNudges = !(
    (committedExp?.mode || dashboardVm?.mode) &&
    dashboardVm?.usesExperienceLayer &&
    ((committedExp?.mode || dashboardVm?.mode) === 'interviewing' ||
      (committedExp?.mode || dashboardVm?.mode) === 'recovery')
  );

  const hasExperienceHeroCandidate = Boolean(
    dashboardVm?.usesExperienceLayer && dashboardVm.hero?.title?.trim(),
  );
  const experienceStable = planStableForHero(todayPlan.data);
  const shouldHoldExperienceUi =
    Boolean(dashboardVm?.usesExperienceLayer) &&
    committedExp == null &&
    (!experienceStable ||
      todayPlan.isLoading ||
      todayPlan.isFetching ||
      hasExperienceHeroCandidate);

  /**
   * Avoid flashing generic dashboard copy before the real today-plan + experience hero is ready.
   * - Without `todayPlan.data`, many strings fall back to growth/analytics heuristics.
   * - With experience layer enabled, wait until `committedExp` is committed (hero skeleton already exists).
   */
  const shouldHoldInitialDashboardUi =
    !todayPlan.data || todayPlan.isLoading || shouldHoldExperienceUi;

  const experienceMode = committedExp?.mode ?? dashboardVm?.mode ?? null;
  const assistantAtmosphere = useMemo(
    () => atmosphereForMode(experienceMode),
    [experienceMode],
  );
  const reassuranceWhisper = useMemo(() => {
    if (hasCompressedAssistantNarrative) return null;
    return pickReassuranceLine({
      mode: experienceMode,
      seed: `${todayPlan.data?.experienceSessionId ?? ''}|${todayPlan.data?.digestVersion ?? ''}|${welcomeName}`,
    });
  }, [
    experienceMode,
    hasCompressedAssistantNarrative,
    todayPlan.data?.digestVersion,
    todayPlan.data?.experienceSessionId,
    welcomeName,
  ]);

  const phase14Layout = useMemo(
    () =>
      resolveDashboardPhase14Layout(
        todayPlan.data?.dashboardLayoutConfig ?? null,
        {
          heroSuppressesInsights: Boolean(
            hasCompressedAssistantNarrative && dashboardVm?.hero?.title?.trim(),
          ),
        },
      ),
    [
      todayPlan.data?.dashboardLayoutConfig,
      hasCompressedAssistantNarrative,
      dashboardVm?.hero?.title,
    ],
  );

  /** Follow-up card is allowed here alongside the command bar so the queue + “Show all” surface can render. */
  const priorityIntelligenceExcludeIds = useMemo(() => new Set<string>(), []);

  const priorityZoneCardIds = useMemo(
    () =>
      selectActionablePriorityCardIds(
        todayPlan.data ?? null,
        phase14Layout,
        3,
        priorityIntelligenceExcludeIds,
      ),
    [todayPlan.data, phase14Layout, priorityIntelligenceExcludeIds],
  );

  const secondaryCollapsibleIds = useMemo(
    () => buildSecondaryCardsCollapsibleOrder(),
    [],
  );

  const isBrandNewUser = useMemo(
    () =>
      displayRows.length === 0 &&
      (analytics.data?.jobsAnalyzed ?? 0) === 0 &&
      !(todayPlan.data?.unifiedPriorities?.items?.length ?? 0),
    [
      displayRows.length,
      analytics.data?.jobsAnalyzed,
      todayPlan.data?.unifiedPriorities?.items?.length,
    ],
  );

  const focusItemsRaw = useMemo(
    () =>
      buildDashboardFocusItems({
        plan: todayPlan.data ?? null,
        continuation: dashboardVm?.continuation ?? null,
        weeklyStall: weeklyStall.data,
        defaultCvProfileId: defaultProfile?.id ?? null,
        heroClusterId: heroClusterId || null,
      }),
    [
      todayPlan.data,
      dashboardVm?.continuation,
      weeklyStall.data,
      defaultProfile?.id,
      heroClusterId,
    ],
  );

  const upcomingInterviews = useMemo(() => {
    const fromPlan = todayPlan.data?.upcomingInterviews ?? [];
    return mergeDashboardUpcomingInterviews(fromPlan, history.data);
  }, [todayPlan.data?.upcomingInterviews, history.data]);
  const upcomingRowsCount = upcomingInterviews.length;

  const focusItemsFilteredForInterview = useMemo(
    () =>
      filterFocusItemsRemovingGenericInterviewCoaching(
        focusItemsRaw,
        upcomingRowsCount > 0 ? 1 : 0,
      ),
    [focusItemsRaw, upcomingRowsCount],
  );

  const continuationList = useMemo(
    () => listContinuationItemsForDisplay(todayPlan.data ?? null),
    [todayPlan.data],
  );
  const continuationTotal =
    todayPlan.data?.continuationCount ?? continuationList.length;

  const recommendedMove = useMemo(
    () => resolveRecommendedMove(todayPlan.data ?? null),
    [todayPlan.data],
  );

  const recommendedMoveEyebrow = useMemo(() => {
    const p = todayPlan.data;
    const a = normalizedSectionTitle(p, 'recommended_move', '').trim();
    const b = normalizedSectionTitle(p, 'your_next_best_action', '').trim();
    return a || b || 'Recommended Move';
  }, [todayPlan.data]);

  const careerAchievementsHeading = useMemo(() => {
    const p = todayPlan.data;
    const a = normalizedSectionTitle(p, 'career_achievements', '').trim();
    const b = normalizedSectionTitle(p, 'achievements', '').trim();
    return a || b || 'Career Achievements';
  }, [todayPlan.data]);

  const focusItems = focusItemsFilteredForInterview;

  const dashboardPrimaryDedupeHrefs = useMemo(
    () =>
      buildDashboardCtaHrefSet([
        ...focusItems.map((i) => i.ctaHref),
        ...continuationList.map((c) => c.ctaHref),
        ...upcomingInterviews.map((u) => u.ctaHref),
      ]),
    [focusItems, continuationList, upcomingInterviews],
  );
  const upcomingCountRaw = todayPlan.data?.upcomingInterviewCount;
  const upcomingCountN =
    typeof upcomingCountRaw === 'number' && Number.isFinite(upcomingCountRaw)
      ? Math.max(0, Math.round(upcomingCountRaw))
      : 0;
  /** Prefer explicit total from API, but never ignore non-empty snapshot rows. */
  const upcomingInterviewTotal = Math.max(upcomingCountN, upcomingRowsCount);
  const suppressGenericInterviewCoaching = upcomingInterviewTotal > 0;

  const cvClinicSuppressedByDedupe = useMemo(() => {
    for (const h of dashboardPrimaryDedupeHrefs) {
      if (h.startsWith('/dashboard/cv')) return true;
    }
    return false;
  }, [dashboardPrimaryDedupeHrefs]);

  const goalAlignmentHrefCanon = useMemo(() => {
    const raw = todayPlan.data?.goalAlignment?.ctaHref?.trim();
    return raw ? canonicalDashboardHref(raw) : '';
  }, [todayPlan.data?.goalAlignment?.ctaHref]);

  const goalAlignmentSuppressedByDedupe = Boolean(
    goalAlignmentHrefCanon &&
    dashboardPrimaryDedupeHrefs.has(goalAlignmentHrefCanon),
  );

  const whereThingsStandHeadline = useMemo(() => {
    const m = dashboardVm?.pipelineMetrics ?? [];
    if (!m.length) return null;
    return whereThingsStandPrimaryLine(m);
  }, [dashboardVm?.pipelineMetrics]);

  const statsChips = useMemo((): DashboardStatChip[] => {
    const plan = todayPlan.data;
    const a = analytics.data;

    if (plan?.dashboardVitals) {
      const fromApi = dashboardVitalsToStatChips(plan.dashboardVitals, plan);
      const hasRealValues = fromApi.some(
        (c) => c.value !== '—' && c.value.trim() !== '',
      );
      if (fromApi.length > 0 && hasRealValues) return fromApi;
    }

    const chips: DashboardStatChip[] = [];

    if (plan?.careerMomentum) {
      const cm = plan.careerMomentum;
      const v = effectiveDeterministicIndexValue(cm.momentumIndex, cm.score);
      const value =
        v != null
          ? `${v}/100`
          : cm.headline?.trim().includes('/')
            ? cm.headline.trim()
            : `${cm.score ?? '—'}/100`;
      const tier =
        cm.tier === 'building'
          ? 'Building'
          : cm.tier === 'steady'
            ? 'Steady'
            : cm.tier === 'strong'
              ? 'Strong'
              : cm.tier === 'surging'
                ? 'Surging'
                : 'Steady';
      chips.push({
        key: 'career_momentum',
        label: 'Career Momentum',
        value,
        status: tier,
        scrollTargetId: 'dashboard-deep-career-momentum',
      });
    }

    if (plan?.predictiveOutlook) {
      const po = plan.predictiveOutlook;
      const iv = effectiveDeterministicIndexValue(
        po.interviewOutlook,
        po.interviewProbability,
      );
      const words =
        po.headline?.trim()?.split(/\s+/).slice(0, 2).join(' ') || 'On track';
      chips.push({
        key: 'predictive_outlook',
        label: 'Interview Outlook',
        value: iv != null ? `${iv}%` : '—',
        status: words,
        scrollTargetId: 'dashboard-deep-predictive-outlook',
      });
    }

    chips.push({
      key: 'best_match',
      label: 'Best Match',
      value: `${Math.round(a?.averageMatchScore ?? 0)}%`,
      status: 'Latest analyses',
      scrollTargetId: 'dashboard-deep-recent-analyses',
    });

    {
      const snap = dashboardVm?.pipelineSnapshot;
      let appValue = String(a?.applicationsSent ?? 0);
      let appStatus = 'In your pipeline';
      if (snap) {
        const interviewing =
          (snap.interviewing ?? 0) + (snap.interviewsUpcoming7d ?? 0);
        let sum = 0;
        for (const v of Object.values(snap)) {
          if (typeof v === 'number' && Number.isFinite(v) && v > 0) sum += v;
        }
        if (sum > 0) {
          appValue = String(sum);
          appStatus =
            interviewing > 0 ? `${interviewing} active` : 'Moving forward';
        }
      }
      chips.push({
        key: 'applications',
        label: 'Applications',
        value: appValue,
        status: appStatus,
        scrollTargetId: 'dashboard-deep-summary',
      });
    }

    if (
      plan?.habitProgress &&
      typeof plan.habitProgress.currentStreakDays === 'number'
    ) {
      const d = Math.max(0, Math.round(plan.habitProgress.currentStreakDays));
      chips.push({
        key: 'streak',
        label: 'Streak',
        value: `${d} days`,
        status:
          plan.habitProgress.streakStatus === 'elite'
            ? 'Elite'
            : plan.habitProgress.streakStatus === 'strong'
              ? 'Strong'
              : plan.habitProgress.streakStatus === 'building'
                ? 'Building'
                : 'Starting',
        scrollTargetId: 'dashboard-deep-consistency',
      });
    }

    return chips;
  }, [todayPlan.data, analytics.data, dashboardVm?.pipelineSnapshot]);

  const phase14SecondaryFlags = useMemo(
    () => ({
      allowGrowthMomentum: shouldRenderSection(
        'momentum',
        todayPlan.data ?? null,
      ),
      allowGrowthAchievements:
        shouldRenderSection('achievements', todayPlan.data ?? null) &&
        (growthAchievements.data?.items?.length ?? 0) > 0,
    }),
    [todayPlan.data, growthAchievements.data?.items?.length],
  );

  const pipelineDisplayHeadline = useMemo(() => {
    const raw =
      whereThingsStandHeadline ??
      (typeof pipelineInfoSurface?.headline === 'string'
        ? pipelineInfoSurface.headline
        : null);
    const bodyPreview =
      typeof pipelineInfoSurface?.body === 'string'
        ? pipelineInfoSurface.body
        : null;
    if (!raw?.trim()) return raw;
    const mergedPreview = phase14Layout.mergeLandscapeIntoPipeline
      ? mergePipelineLandscapeBodies(bodyPreview, landscapeCoachingBody)
      : bodyPreview;
    if (pipelineHeadlineSubsumedByBody(raw, mergedPreview)) return null;
    return raw;
  }, [
    whereThingsStandHeadline,
    pipelineInfoSurface,
    phase14Layout.mergeLandscapeIntoPipeline,
    landscapeCoachingBody,
  ]);

  const pipelineMergedBody = useMemo(() => {
    const pipelineBody =
      typeof pipelineInfoSurface?.body === 'string'
        ? pipelineInfoSurface.body
        : null;
    const landscapeBody = landscapeCoachingBody;
    const merged = phase14Layout.mergeLandscapeIntoPipeline
      ? mergePipelineLandscapeBodies(pipelineBody, landscapeBody)
      : (pipelineBody ?? null);
    const s = merged?.trim();
    return s ? dedupeNearDuplicateSentences(s) : null;
  }, [
    phase14Layout.mergeLandscapeIntoPipeline,
    pipelineInfoSurface,
    landscapeCoachingBody,
  ]);

  const showMergedPipelineCard = useMemo(() => {
    const m = dashboardVm?.pipelineMetrics?.length ?? 0;
    const hasPipelineSurface = pipelineInfoSurface != null;
    const mergedNarrativeOnly =
      phase14Layout.mergeLandscapeIntoPipeline &&
      Boolean(landscapeCoachingBody?.trim());
    return m > 0 || hasPipelineSurface || mergedNarrativeOnly;
  }, [
    dashboardVm?.pipelineMetrics?.length,
    pipelineInfoSurface,
    phase14Layout.mergeLandscapeIntoPipeline,
    landscapeCoachingBody,
  ]);

  const showStandaloneLandscapeCard = useMemo(() => {
    if (phase14Layout.hidden.has('landscape')) return false;
    if (phase14Layout.mergeLandscapeIntoPipeline) return false;
    return shouldShowLandscapeSection(todayPlan.data ?? null);
  }, [
    phase14Layout.hidden,
    phase14Layout.mergeLandscapeIntoPipeline,
    todayPlan.data,
  ]);

  const hideCvClinicPromo = phase14Layout.hidden.has('cv_clinic_promo');
  const showCvTeaserInExecution =
    showCvProfileTeaserPromo && !hideCvClinicPromo;
  const showCvClinicSectionInExecution =
    cvSectionVisible && !hideCvClinicPromo && !cvClinicSuppressedByDedupe;

  const hasProgressCollapsibleContent = useMemo(
    () =>
      secondaryCollapsibleIds.some((id) =>
        shouldShowSecondaryCard(
          id,
          todayPlan.data ?? null,
          phase14Layout,
          priorityZoneCardIds,
          phase14SecondaryFlags,
        ),
      ),
    [
      secondaryCollapsibleIds,
      todayPlan.data,
      phase14Layout,
      priorityZoneCardIds,
      phase14SecondaryFlags,
    ],
  );

  const hasGoalsStrategyCard = useMemo(
    () =>
      shouldShowSecondaryCard(
        'goal_strategic_coaching',
        todayPlan.data ?? null,
        phase14Layout,
        priorityZoneCardIds,
        phase14SecondaryFlags,
      ),
    [todayPlan.data, phase14Layout, priorityZoneCardIds, phase14SecondaryFlags],
  );

  const phase14SecondaryWrapClass =
    'min-w-0 self-start rounded-3xl shadow-[0_24px_60px_-28px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.08] transition-shadow duration-300 hover:shadow-[0_28px_70px_-26px_rgba(0,201,177,0.12)] [&>section]:rounded-3xl [&>section]:border-white/[0.06] [&>section]:shadow-none';

  if (shouldHoldInitialDashboardUi) {
    return <DashboardOverviewLoadingSkeleton />;
  }

  return (
    <div className="dashboard-premium mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col pb-10 max-md:pb-16 lg:min-h-0 lg:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-8 lg:overflow-hidden">
        <div
          className={cn(
            'app-scrollbar scroll-content-end-pad flex w-full min-w-0 flex-col pr-0 lg:mx-auto lg:max-w-[760px] lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2',
            dashboardVm?.usesExperienceLayer
              ? cn(
                  modeShellClass(
                    committedExp?.mode ?? dashboardVm?.mode ?? null,
                  ),
                  'gap-0',
                )
              : 'gap-0',
          )}
        >
          <motion.section
            {...sectionMotion}
            transition={
              dashboardVm?.usesExperienceLayer
                ? {
                    duration: assistantAtmosphere.motionTransition.duration,
                    ease: assistantAtmosphere.motionTransition.ease as [
                      number,
                      number,
                      number,
                      number,
                    ],
                  }
                : {
                    duration: 0.35,
                    delay: 0,
                    ease: [0.21, 0.47, 0.32, 0.98] as const,
                  }
            }
            className={cn(
              'mb-6 max-md:mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10',
              'rounded-none border-0 bg-transparent p-0 pb-2 shadow-none ring-0 sm:pb-3',
              dashboardVm?.usesExperienceLayer &&
                assistantToneHeroAccentClass(
                  todayPlan.data?.assistantTone ?? null,
                ),
            )}
          >
            <div className="min-w-0 max-w-[65ch]">
              <p
                className={cn(
                  assistantAtmosphere.heroTitleClass,
                  'mb-3 font-normal leading-relaxed tracking-normal text-[var(--text-secondary)]',
                )}
              >
                {greetingLine(welcomeName)}
              </p>
              {!hasCompressedAssistantNarrative && returnWelcomeLine ? (
                <p className="mb-4 mt-0 text-[13px] leading-relaxed text-[#9CF5EA]/72">
                  {returnWelcomeLine}
                </p>
              ) : null}
              {/* Phase 5 compressed hero: suppress legacy strip + reasoning when assistantNarrative is present. */}
              {dashboardVm?.usesExperienceLayer &&
              !hasCompressedAssistantNarrative ? (
                <AssistantHeaderRenderer
                  compact={
                    Boolean(committedExp?.heroTitle?.trim()) &&
                    !shouldHoldExperienceUi
                  }
                  assistantTone={todayPlan.data?.assistantTone ?? null}
                  emotionalSummary={todayPlan.data?.emotionalSummary ?? null}
                  dailyNarrativeSummary={
                    todayPlan.data?.dailyNarrativeSummary ?? null
                  }
                  narrativeProgression={
                    todayPlan.data?.narrativeProgression ?? null
                  }
                  memorySummary={todayPlan.data?.memorySummary ?? null}
                  assistantReasoning={
                    todayPlan.data?.assistantReasoning ?? null
                  }
                  adaptiveReasoning={todayPlan.data?.adaptiveReasoning ?? []}
                  assistantState={todayPlan.data?.assistantState ?? null}
                  humanizedLabels={todayPlan.data?.humanizedLabels ?? null}
                  personalizationContext={
                    todayPlan.data?.personalizationContext ?? null
                  }
                />
              ) : null}
              {shouldHoldExperienceUi ? (
                <HeroRenderer variant="skeleton" />
              ) : committedExp?.heroTitle ? (
                <HeroRenderer
                  variant="committed"
                  column="primary"
                  title={committedExp.heroTitle}
                  subtitle={committedExp.heroSubtitle}
                  arcLabel={committedExp.heroArcLabel}
                  continuityLine={committedExp.heroContinuityLine}
                  whyMatters={committedExp.heroWhyMatters}
                  reassuranceWhisper={reassuranceWhisper}
                  emotionalTone={committedExp.heroEmotionalTone}
                  mode={committedExp.mode ?? dashboardVm?.mode ?? null}
                  fatigueAdjusted={committedExp.narrativeFatigueAdjusted}
                  primaryTitleClass={
                    hasCompressedAssistantNarrative
                      ? undefined
                      : assistantAtmosphere.heroTitleClass
                  }
                  compressedVisual={hasCompressedAssistantNarrative}
                />
              ) : orchestratedHero?.arcLabel ? (
                <p className="mt-2 text-[13px] font-medium text-white/72">
                  {orchestratedHero.arcLabel}
                </p>
              ) : heroActionHeadline ? (
                <p className="mt-2 text-[13px] font-medium text-white/72">
                  {heroActionHeadline}
                </p>
              ) : (
                <p
                  className={cn(
                    'mt-2 text-[13px] font-medium',
                    subtextClassForMomentumType(dashboardHeader?.momentumType),
                  )}
                >
                  {heroSubtext}
                </p>
              )}
              {dashboardVm?.usesExperienceLayer &&
              dashboardVm.hero
                ?.title ? null : orchestratedHero?.supportingLine ? (
                <p className="mt-1 text-[12px] text-white/50">
                  {orchestratedHero.supportingLine}
                </p>
              ) : heroActionBenefit ? (
                <p className="mt-1 text-[12px] text-white/50">
                  {heroActionBenefit}
                </p>
              ) : null}
              {growthDirection.data?.dailyDirection.progressContext &&
              !heroAction &&
              !orchestratedHero &&
              !dashboardVm?.hero?.title ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[#00C9B1]/85">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                  {growthDirection.data.dailyDirection.progressContext}
                </p>
              ) : null}
            </div>
            <div className="w-full shrink-0 lg:max-w-[38%] lg:pt-0.5 lg:pr-2">
              {shouldHoldExperienceUi ? (
                <div
                  className="flex w-full flex-col items-stretch gap-3 sm:items-end"
                  aria-hidden
                >
                  <Skeleton
                    className="max-w-[11rem] sm:ml-auto"
                    height={14}
                    width="100%"
                    borderRadius={8}
                  />
                  <Skeleton
                    className="max-w-[13rem] sm:ml-auto"
                    height={44}
                    width="100%"
                    borderRadius={999}
                  />
                </div>
              ) : committedExp?.heroTitle ? (
                <HeroRenderer
                  variant="committed"
                  column="aside"
                  emotionalTone={committedExp.heroEmotionalTone}
                  mode={committedExp.mode ?? dashboardVm?.mode ?? null}
                  fatigueAdjusted={committedExp.narrativeFatigueAdjusted}
                  showPrimaryCta={committedExp.heroShowCta}
                  ctaHref={committedExp.heroCtaHref}
                  ctaLabel={committedExp.heroCtaLabel}
                  ctaHelper={committedExp.heroCtaHelper}
                  microcopyBelowCta={hasCompressedAssistantNarrative}
                  suppressFallbackTip={hasCompressedAssistantNarrative}
                  minutes={committedExp.heroMinutes}
                  showLimitInHero={showLimitInHero}
                  onCtaClick={() => {
                    if (!committedExp.heroCtaHref) return;
                    emitDashboardBehaviorEvent({
                      eventName: 'dashboard_hero_clicked',
                      context: {
                        recommendationId:
                          dashboardVm?.hero?.recommendationId ?? null,
                        canonicalRoute: committedExp.heroCtaHref,
                        surfaceKind: 'hero',
                      },
                    });
                    trackProductEvent('recommendation_clicked', {
                      ctaSource: 'dashboard_experience_hero',
                      route: committedExp.heroCtaHref,
                    });
                  }}
                />
              ) : showLimitInHero ? (
                <AiUsageBadge variant="default" className="w-full sm:w-auto" />
              ) : orchestratedHero ? (
                <>
                  {orchestratedHero.minutes ? (
                    <p className="text-[12px] font-medium leading-relaxed text-white/35">
                      Usually takes ~{orchestratedHero.minutes} min
                    </p>
                  ) : null}
                  <Link
                    href={orchestratedHero.href}
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                    onClick={() => {
                      trackProductEvent('recommendation_clicked', {
                        ctaSource: 'orchestrated_hero',
                        route: orchestratedHero.href,
                      });
                    }}
                  >
                    {orchestratedHero.label}
                  </Link>
                </>
              ) : heroActionHref && heroActionCtaLabel ? (
                <>
                  {heroActionMinutes ? (
                    <p className="text-[12px] font-medium leading-relaxed text-white/35">
                      Usually takes ~{heroActionMinutes} min
                    </p>
                  ) : null}
                  <Link
                    href={heroActionHref}
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        console.info('[Dashboard CTA route]', {
                          recommendationId:
                            heroAction?.recommendationId ?? null,
                          title:
                            heroActionHeadline ??
                            heroAction?.roleTitle ??
                            'Hero action',
                          canonicalRoute:
                            heroAction?.executionPayload?.canonicalRoute ??
                            heroAction?.canonicalRoute ??
                            null,
                          deepLink: heroAction?.deepLink ?? null,
                          finalNavigatedRoute: heroActionHref,
                        });
                      }
                      trackProductEvent('recommendation_clicked', {
                        ctaSource: 'hero_action_context',
                        actionType: heroAction?.type ?? null,
                        route: heroActionHref,
                        recommendationId: heroAction?.recommendationId ?? null,
                        applicationId: heroAction?.applicationId ?? null,
                        canonicalJobId: heroAction?.canonicalJobId ?? null,
                        cvProfileId: heroAction?.cvProfileId ?? null,
                        executionMode: heroAction?.executionMode ?? null,
                      });
                    }}
                  >
                    {heroActionCtaLabel}
                  </Link>
                </>
              ) : !dashboardVm?.usesExperienceLayer ? (
                <p className="text-[12px] font-medium leading-relaxed text-white/35">
                  Tip: Revisit your top matches weekly — small updates to your
                  CV often move the needle on fit scores.
                </p>
              ) : null}
              {!shouldHoldExperienceUi &&
              !dashboardVm?.usesExperienceLayer &&
              !orchestratedHero &&
              !(
                committedExp?.heroTitle &&
                committedExp.heroShowCta &&
                committedExp.heroCtaHref &&
                committedExp.heroCtaLabel
              ) &&
              (!heroActionHref || !heroActionCtaLabel) ? (
                <Link
                  href={primaryDirectionHref}
                  className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                  onClick={() => {
                    trackGrowthEvent.mutate({
                      eventName: 'daily_direction_completed',
                      context: { route: primaryDirectionHref },
                    });
                  }}
                >
                  Start today&apos;s mission
                </Link>
              ) : null}
            </div>
          </motion.section>

          <div
            className={cn(
              'flex min-w-0 flex-col',
              dashboardVm?.usesExperienceLayer
                ? assistantAtmosphere.sectionGapClass
                : 'gap-[var(--page-gap)] max-md:gap-4',
            )}
          >
            <DashboardCommandBar
              plan={todayPlan.data ?? undefined}
              isBrandNewUser={isBrandNewUser}
              omitCanonicalCtaHrefs={dashboardPrimaryDedupeHrefs}
              suppressGenericInterviewPriority={upcomingRowsCount > 0}
            />
            <DashboardStatsRow
              chips={statsChips}
              loading={analytics.isLoading}
            />
            {upcomingInterviews.length > 0 && (
              <DashboardUpcomingInterviewsSection
                interviews={upcomingInterviews}
                upcomingInterviewCount={
                  todayPlan.data?.upcomingInterviewCount ??
                  upcomingInterviews.length
                }
              />
            )}
            <ContinuationSection
              items={continuationList}
              continuationCount={continuationTotal}
            />
            {recommendedMove ? (
              <DashboardRecommendedMoveSection
                action={recommendedMove}
                sectionEyebrow={recommendedMoveEyebrow}
                followUpJobsSnapshotCount={
                  todayPlan.data?.followUpJobs?.length ?? 0
                }
                followUpJobsTotalCount={
                  todayPlan.data?.followUpJobsTotalCount ?? null
                }
                followUpJobsViewAllHref={
                  todayPlan.data?.followUpJobsViewAllHref ?? null
                }
              />
            ) : null}
            <DashboardFocusSection
              items={focusItems}
              sectionHeading={normalizedSectionTitle(
                todayPlan.data,
                'focus',
                'Your Focus',
              )}
              phase15Empty={dashboardEmptyStateFor(todayPlan.data, 'focus')}
            />
            <InterviewPendingResultBanner className="mb-2" />
            {!suppressGenericInterviewCoaching ? (
              <DashboardInterviewPreparationSection
                cards={todayPlan.data?.interviewPreparationCards ?? []}
              />
            ) : null}

            {showMergedPipelineCard || showStandaloneLandscapeCard ? (
              <motion.section
                id="dashboard-deep-summary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: 0.1,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                className="scroll-mt-4 flex flex-col gap-6"
                aria-label="Where things stand"
              >
                {showMergedPipelineCard ? (
                  <PipelineRenderer
                    metrics={dashboardVm?.pipelineMetrics ?? []}
                    headline={pipelineDisplayHeadline}
                    body={
                      pipelineMergedBody ??
                      (typeof pipelineInfoSurface?.body === 'string'
                        ? dedupeNearDuplicateSentences(pipelineInfoSurface.body)
                        : null)
                    }
                    forceRender={true}
                    titleOverride={null}
                    emptyStateCopyOverride={null}
                    sectionEyebrow={
                      normalizedSectionTitle(
                        todayPlan.data,
                        'search_at_a_glance',
                        '',
                      )?.trim() || 'Where things stand'
                    }
                    primaryLineFallback={null}
                    disableOuterMotion
                    mode={committedExp?.mode ?? dashboardVm?.mode ?? null}
                    fatigueAdjusted={
                      todayPlan.data?.dashboardExperience?.narrative
                        ?.fatigueAdjusted ??
                      committedExp?.narrativeFatigueAdjusted ??
                      null
                    }
                  />
                ) : null}
                {showStandaloneLandscapeCard ? (
                  <DashboardLandscapeCard
                    title={landscapeSectionTitle}
                    body={landscapeCoachingBody}
                    emptyStateCopy={
                      todayPlan.data?.sectionPayloads?.landscape
                        ?.emptyStateCopy ?? null
                    }
                  />
                ) : null}
              </motion.section>
            ) : null}

            {showCvTeaserInExecution ? (
              <motion.section
                {...sectionMotion}
                transition={{
                  duration: 0.35,
                  delay: 0.09,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                aria-label="CV profiles"
              >
                <DashboardCvProfileTeaser
                  onNewCv={() => setCreateCvOpen(true)}
                />
              </motion.section>
            ) : null}

            {showCvClinicSectionInExecution ? (
              <motion.section
                {...sectionMotion}
                transition={{
                  duration: 0.35,
                  delay: 0.095,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                aria-label="CV Clinic"
                className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.05] sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white/90">
                      {normalizedSectionTitle(todayPlan.data, 'cv', '') ||
                        todayPlan.data?.sectionPayloads?.cv?.title?.trim() ||
                        'CV Clinic'}
                    </h2>
                    <p className="mt-2 text-[13px] font-medium leading-relaxed text-white/50">
                      Start with a scan to get a score and section-by-section
                      improvements.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/cv"
                    className="text-[13px] font-medium text-[#00C9B1] hover:underline"
                  >
                    Open CV Clinic →
                  </Link>
                </div>
              </motion.section>
            ) : null}

            {!hasUnifiedPriorities ? (
              <motion.section
                {...sectionMotion}
                transition={{
                  duration: 0.35,
                  delay: 0.118,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
              >
                <DashboardTopMatchesSection
                  items={topMatches}
                  todayPlanPayload={todayPlan.data ?? null}
                  onInvalidNavigate={() => {
                    toast.info(
                      'That task is already resolved. Showing your current priorities.',
                    );
                    void todayPlan.refetch();
                  }}
                />
              </motion.section>
            ) : null}

            {hasProgressCollapsibleContent ? (
              <DashboardProgressIntelligenceCollapsible>
                {secondaryCollapsibleIds.map((id) => {
                  if (id === 'goal_strategic_coaching') return null;
                  if (
                    !shouldShowSecondaryCard(
                      id,
                      todayPlan.data ?? null,
                      phase14Layout,
                      priorityZoneCardIds,
                      phase14SecondaryFlags,
                    )
                  ) {
                    return null;
                  }
                  const plan = todayPlan.data;
                  if (!plan) return null;
                  let inner: ReactNode = null;
                  switch (id) {
                    case 'career_momentum':
                      inner = plan.careerMomentum
                        ? wrapProgressCore(
                            'career_momentum',
                            deepDiveCareerMomentumSummary(plan.careerMomentum),
                            <DashboardCareerMomentumCard
                              data={plan.careerMomentum}
                              phase15Empty={dashboardEmptyStateFor(
                                todayPlan.data,
                                'career_momentum',
                              )}
                            />,
                          )
                        : null;
                      break;
                    case 'predictive_outlook':
                      inner = plan.predictiveOutlook
                        ? wrapProgressCore(
                            'predictive_outlook',
                            deepDivePredictiveSummary(plan.predictiveOutlook),
                            <DashboardPredictiveOutlookCard
                              data={plan.predictiveOutlook}
                              phase15Empty={dashboardEmptyStateFor(
                                todayPlan.data,
                                'predictive_outlook',
                              )}
                            />,
                          )
                        : null;
                      break;
                    case 'weekly_briefing':
                      inner = plan.weeklyBriefing ? (
                        <DashboardWeeklyBriefingCard
                          data={plan.weeklyBriefing}
                        />
                      ) : null;
                      break;
                    case 'strategic_weekly_coaching':
                      inner = plan.strategicWeeklyCoaching ? (
                        <DashboardStrategicWeeklyCoachingCard
                          data={plan.strategicWeeklyCoaching}
                        />
                      ) : null;
                      break;
                    case 'goal_alignment':
                      inner =
                        plan.goalAlignment && !goalAlignmentSuppressedByDedupe
                          ? wrapProgressCore(
                              'goal_alignment',
                              deepDiveGoalSummary(plan.goalAlignment),
                              <DashboardGoalAlignmentCard
                                alignment={plan.goalAlignment}
                                careerProfile={plan.careerGoalProfile ?? null}
                              />,
                            )
                          : null;
                      break;
                    case 'strategic_coaching':
                      inner =
                        plan.strategicCoaching &&
                        !(
                          suppressGenericInterviewCoaching &&
                          plan.strategicCoaching.reason === 'interview_focus'
                        ) ? (
                          <DashboardStrategicCoachingCard
                            data={plan.strategicCoaching}
                          />
                        ) : null;
                      break;
                    case 'adaptive_coaching':
                      inner =
                        plan.adaptiveCoaching &&
                        !(
                          suppressGenericInterviewCoaching &&
                          plan.adaptiveCoaching.category ===
                            'interview_momentum'
                        ) ? (
                          <DashboardAdaptiveCoachingCard
                            data={plan.adaptiveCoaching}
                          />
                        ) : null;
                      break;
                    case 'milestone_celebration':
                      inner = plan.milestoneCelebration ? (
                        <DashboardMilestoneCelebration
                          data={plan.milestoneCelebration}
                          timeZone={browserTz}
                        />
                      ) : null;
                      break;
                    case 'habit_progress':
                      inner = plan.habitProgress
                        ? wrapProgressCore(
                            'habit_progress',
                            deepDiveHabitSummary(plan.habitProgress),
                            <DashboardHabitProgressCard
                              data={plan.habitProgress}
                            />,
                          )
                        : null;
                      break;
                    case 'today_plan_achievements':
                      inner =
                        plan.careerAchievements != null ||
                        plan.achievements != null
                          ? wrapProgressCore(
                              'today_plan_achievements',
                              deepDiveCareerAchievementsSummary(
                                plan.careerAchievements,
                                plan.achievements,
                              ),
                              <DashboardCareerAchievementsSection
                                digestVersion={
                                  todayPlan.data?.digestVersion ?? ''
                                }
                                career={plan.careerAchievements}
                                achievements={plan.achievements}
                                heading={careerAchievementsHeading}
                                phase15Empty={dashboardEmptyStateFor(
                                  todayPlan.data,
                                  'achievements',
                                )}
                              />,
                            )
                          : null;
                      break;
                    case 'growth_momentum':
                      inner = (
                        <GrowthProgressCard
                          window={growthWindow}
                          onWindowChange={setGrowthWindow}
                          emptyStateCopy={
                            todayPlan.data?.sectionPayloads?.momentum
                              ?.emptyStateCopy ?? null
                          }
                          sectionTitle={
                            normalizedSectionTitle(
                              todayPlan.data,
                              'momentum',
                              '',
                            ) ||
                            todayPlan.data?.sectionPayloads?.momentum?.title?.trim() ||
                            null
                          }
                        />
                      );
                      break;
                    case 'growth_achievements':
                      inner =
                        shouldRenderSection(
                          'achievements',
                          todayPlan.data ?? null,
                        ) && growthAchievements.data?.items?.length ? (
                          <section className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
                            <p className="mb-3 text-[15px] font-semibold text-white/90">
                              {normalizedSectionTitle(
                                todayPlan.data,
                                'achievements',
                                '',
                              ) ||
                                todayPlan.data?.sectionPayloads?.achievements?.title?.trim() ||
                                'Achievements'}
                            </p>
                            <div className="space-y-2">
                              {growthAchievements.data.items
                                .slice(0, 3)
                                .map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[13px] font-semibold text-white">
                                        {item.title}
                                      </p>
                                      <p className="truncate text-[12px] text-white/50">
                                        {item.subtitle}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/15 px-2.5 text-[12px] text-white/75 hover:border-[#00C9B1]/40 hover:text-[#00C9B1]"
                                      onClick={async () => {
                                        const text = `${item.sharePayload.badge}${item.sharePayload.value != null ? `: ${item.sharePayload.value}` : ''} - ${item.sharePayload.note}`;
                                        if (navigator.share) {
                                          try {
                                            await navigator.share({
                                              title: item.title,
                                              text,
                                            });
                                            return;
                                          } catch {
                                            // ignore and fallback to clipboard
                                          }
                                        }
                                        await navigator.clipboard.writeText(
                                          text,
                                        );
                                        toast.success(
                                          'Achievement copied for sharing',
                                        );
                                      }}
                                    >
                                      <Share2
                                        className="h-3.5 w-3.5"
                                        aria-hidden
                                      />
                                      Share
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </section>
                        ) : null;
                      break;
                    default:
                      inner = null;
                  }
                  if (!inner) return null;
                  return (
                    <div key={id} className={phase14SecondaryWrapClass}>
                      {inner}
                    </div>
                  );
                })}
              </DashboardProgressIntelligenceCollapsible>
            ) : null}

            {hasGoalsStrategyCard && todayPlan.data?.goalStrategicCoaching ? (
              <motion.section
                {...sectionMotion}
                transition={{
                  duration: 0.35,
                  delay: 0.117,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                aria-label="Goals and strategy"
              >
                <div className={phase14SecondaryWrapClass}>
                  <DashboardGoalStrategicCoachingCard
                    data={todayPlan.data.goalStrategicCoaching}
                  />
                </div>
              </motion.section>
            ) : null}

            {dashboardVm?.usesExperienceLayer &&
            visibleInsightSurfaces.length > 0 &&
            !phase14Layout.suppressInsightGuidance &&
            todayPlan.data?.assistantNarrative?.suppressGuidanceCard !==
              true ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: assistantAtmosphere.motionTransition.duration,
                  ease: assistantAtmosphere.motionTransition.ease as [
                    number,
                    number,
                    number,
                    number,
                  ],
                }}
              >
                <section
                  className="grid gap-4 sm:grid-cols-2"
                  aria-label="Guidance for you"
                >
                  {visibleInsightSurfaces
                    .slice(
                      0,
                      assistantAtmosphere.insightDensity === 'sparse' ? 4 : 6,
                    )
                    .map((surf, i) => (
                      <InsightRenderer
                        key={`${surf.category}-${i}`}
                        surface={surf}
                        mode={committedExp?.mode ?? dashboardVm?.mode ?? null}
                        insightDensity={assistantAtmosphere.insightDensity}
                        fatigueAdjusted={
                          todayPlan.data?.dashboardExperience?.narrative
                            ?.fatigueAdjusted ??
                          committedExp?.narrativeFatigueAdjusted ??
                          null
                        }
                        onDismiss={() => {
                          const k = `${String(surf.category ?? '').trim()}:${String(surf.headline ?? '').trim()}:${String(surf.insightCategory ?? '').trim()}`;
                          setDismissedInsights((prev) => {
                            const next = new Set(prev);
                            next.add(k);
                            return next;
                          });
                          emitDashboardBehaviorEvent({
                            eventName: 'dashboard_insight_dismissed',
                            context: {
                              surfaceKind: 'insight',
                              category: surf.category ?? null,
                              insightCategory: surf.insightCategory ?? null,
                              headline: surf.headline ?? null,
                            },
                          });
                        }}
                      />
                    ))}
                </section>
              </motion.div>
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.14,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
            >
              {showLegacyNudges &&
              !dashboardVm?.continuation &&
              shouldRenderSection('nudges', todayPlan.data ?? null) &&
              footerNudges.length > 0 ? (
                <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.05] sm:p-6">
                  <p className="mb-3 text-xl font-semibold tracking-tight text-white/90">
                    {normalizedSectionTitle(todayPlan.data, 'nudges', '') ||
                      todayPlan.data?.sectionPayloads?.nudges?.title?.trim() ||
                      'Suggestions for you'}
                  </p>
                  <div className="space-y-2">
                    {footerNudges.map((nudge) => (
                      <Link
                        key={nudge.id}
                        href={nudge.route}
                        className="block rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                      >
                        <p className="text-[13px] font-semibold text-white">
                          {nudge.title}
                        </p>
                        <p className="mt-1 text-[12px] text-white/50">
                          {nudge.message}
                        </p>
                        <p className="mt-2 text-[12px] font-medium text-[#00C9B1]">
                          {nudge.actionLabel} →
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </motion.div>

            {showChecklist ? (
              <GettingStartedChecklist
                hasCvProfile={displayRows.length > 0}
                anyProfileScored={anyProfileScored}
                totalJobsAnalyzed={totalJobsAnalyzed}
              />
            ) : null}

            {showAnalyzeNextRoleBanner ? (
              <AnalyzeNextRoleBanner
                primaryGoal={primaryGoal}
                defaultProfile={defaultProfile}
              />
            ) : null}
          </div>

          <CreateCVProfileModal
            open={createCvOpen}
            onOpenChange={setCreateCvOpen}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.35,
            delay: 0.12,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="flex w-full shrink-0 flex-col border-t border-white/[0.08] pt-8 lg:flex lg:h-full lg:min-h-0 lg:w-[min(100%,340px)] lg:flex-col lg:border-l lg:border-white/[0.06] lg:border-t-0 lg:pl-6 lg:pt-0 xl:w-[360px] xl:pl-8"
        >
          <div className="lg:hidden">
            <div className="mb-6 h-px w-full bg-white/[0.08]" />
          </div>
          <div className="pr-0 pb-10 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:pb-3 app-scrollbar">
            <RecentAnalysesStickyColumn
              history={history}
              onRefreshPriorities={() => {
                void todayPlan.refetch();
                void history.refetch();
                toast.info('Refreshed your current priorities.');
              }}
            />
            <DashboardUpgradeCard className="mt-8 lg:mt-10" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function DashboardOverviewLoadingSkeleton() {
  return (
    <div className="dashboard-premium mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col pb-10 max-md:pb-16 lg:min-h-0 lg:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-8 lg:overflow-hidden">
        <div className="flex w-full min-w-0 flex-col pr-0 lg:mx-auto lg:max-w-[760px] lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 app-scrollbar">
          <div className="mb-6 max-md:mb-5 rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] sm:p-7">
            <div className="min-w-0 max-w-[65ch] space-y-3">
              <Skeleton height={34} width={280} borderRadius={12} />
              <Skeleton height={22} width="92%" borderRadius={12} />
              <Skeleton height={16} width="78%" borderRadius={10} />
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton height={44} width={220} borderRadius={999} />
              <Skeleton height={14} width={260} borderRadius={10} />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-[88px] min-w-[140px] shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 md:min-w-0"
                >
                  <div className="space-y-2">
                    <Skeleton height={12} width={86} borderRadius={8} />
                    <Skeleton height={22} width={70} borderRadius={10} />
                    <Skeleton height={10} width={96} borderRadius={8} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <Skeleton height={18} width={220} borderRadius={10} />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <Skeleton height={16} width="55%" borderRadius={10} />
                  <div className="mt-2">
                    <Skeleton height={12} width="80%" borderRadius={10} />
                  </div>
                  <div className="mt-4">
                    <Skeleton height={40} width={180} borderRadius={999} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col border-t border-white/[0.08] pt-8 lg:h-full lg:min-h-0 lg:w-[min(100%,340px)] lg:border-l lg:border-white/[0.06] lg:border-t-0 lg:pl-6 lg:pt-0 xl:w-[360px] xl:pl-8">
          <div className="space-y-4">
            <Skeleton height={18} width={170} borderRadius={10} />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <Skeleton height={14} width="70%" borderRadius={10} />
                <div className="mt-2">
                  <Skeleton height={12} width="90%" borderRadius={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<DashboardOverviewLoadingSkeleton />}>
      <DashboardOverviewPageContent />
    </Suspense>
  );
}
