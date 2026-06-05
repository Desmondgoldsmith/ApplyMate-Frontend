'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ChevronRight,
  ClipboardList,
  Loader2,
  Rocket,
  RotateCw,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { StatusTag, inferStatusTagVariant } from '@/components/dashboard/StatusTag';
import { InfoHint } from '@/components/ui/InfoHint';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useApplications } from '@/hooks/useApplications';
import { useJobHistory } from '@/hooks/useJobHistory';
import { api } from '@/lib/api';
import { trackFunnelEvent } from '@/lib/actionFunnel';
import { orchestratePriorities, shouldRenderSection } from '@/lib/dashboardOrchestration';
import {
  canonicalRowByRecommendationId,
  effectiveContinuationRecommendationId,
  effectiveHeroRecommendationId,
  getOrchestratedRowForItem,
  isOrchestrationV1,
  isPrimaryPrioritySurface,
  orchestratedRowByRecommendationId,
} from '@/lib/dashboardOrchestrationModel';
import { buildDashboardViewModel, shouldSuppressPriorityForContinuationDup } from '@/lib/dashboardViewModel';
import { resolveExecutionDestination } from '@/lib/executionRouting';
import type {
  OrchestratedRecommendation,
  TodayPlanItem,
  TodayPlanPayload,
  UnifiedPriorityItem,
} from '@/lib/today-plan';
import {
  isAppliedOrLaterState,
  isPriorityInvalidByState,
  discoveryJobBoardCanonicalDedupeKey,
  todayPlanItemDedupeKey,
  unifiedPriorityDedupeKey,
} from '@/lib/today-plan';
import { cacheNextActionPrefetchBundle, prefillJobAnalyzerInStorage } from '@/lib/jobHubPrefill';
import { trackProductEvent } from '@/lib/productAnalytics';
import {
  formatBlockersPreview,
  formatConfidenceShort,
  formatInterruptionAge,
  inferEffortBand,
  labelForEffortBand,
  labelForReadyState,
  labelForWorkflowState,
  laneChipClassesForPriorityState,
  laneLabelForPriorityState,
  shellAccentClassesForPriorityState,
} from '@/lib/todayPlanLabels';
import { safeHumanText, stripTechnicalTokens } from '@/components/dashboard/assistant-voice';
import { cn } from '@/lib/utils';

function formatSeenRecency(iso: string | null): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const hours = Math.floor((Date.now() - ts) / (1000 * 60 * 60));
  if (hours < 1) return 'updated recently';
  if (hours < 24) return `updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `updated ${days}d ago`;
  return null;
}

function buildWhyNow(item: UnifiedPriorityItem): string | null {
  const parts: string[] = [];
  const strategy = item.locationStrategy ?? item.recommendationSource;
  const locationText = item.locationLabel ?? item.recommendationLocation;
  if (strategy === 'local' && locationText) {
    parts.push(`local match in ${locationText}`);
  } else if (strategy === 'local') {
    parts.push('local match');
  } else if (strategy === 'remote_fallback') {
    parts.push('remote fallback (no local qualifying matches)');
  }
  if (typeof item.postedAgeHours === 'number' && Number.isFinite(item.postedAgeHours)) {
    if (item.postedAgeHours < 24) parts.push(`posted ${Math.max(1, Math.round(item.postedAgeHours))}h ago`);
    else parts.push(`posted ${Math.round(item.postedAgeHours / 24)}d ago`);
  }
  const recency = formatSeenRecency(item.lastSeenAt ?? item.firstSeenAt);
  if (recency) parts.push(recency);
  if (item.priorityScore > 0) parts.push(`priority ${Math.round(item.priorityScore)}`);
  if (item.whyNowShort) parts.push(item.whyNowShort);
  else if (item.reasonText) parts.push(item.reasonText);
  if (parts.length === 0) return null;
  return `Why now: ${parts.join(', ')}`;
}

function isVagueMissionContext(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  return (
    /quick cv improvement/.test(t) ||
    /lift\b.*\bmatch quality/.test(t) ||
    /upcoming application/.test(t) ||
    /improvement can\b/.test(t) ||
    /can improve\b.*\bmatch/.test(t) ||
    /can lift\b.*\bmatch/.test(t)
  );
}

function sanitizeHeroPlanCopy(text: string | null | undefined): string | null {
  const value = (text ?? '').trim();
  if (!value) return null;
  if (isVagueMissionContext(value)) return null;
  return value;
}

const DEGRADED_SUPPRESSION_REASONS = new Set([
  'missing_job_context',
  'invalid_application_reference',
  'stale_execution_reference',
]);
const MISSING_INTERVIEW_CONTEXT_REASON = 'missing_interview_context';

function isKnownDashboardHref(href: string): boolean {
  if (!href.startsWith('/')) return false;
  return (
    href.startsWith('/dashboard/jobs') ||
    href.startsWith('/dashboard/interview') ||
    href.startsWith('/dashboard/cv') ||
    href.startsWith('/dashboard/job-board') ||
    href.startsWith('/dashboard/settings') ||
    href.startsWith('/dashboard/analyses') ||
    href.startsWith('/dashboard/interviews') ||
    href.startsWith('/dashboard/cv-profiles') ||
    href.startsWith('/dashboard/job-hub') ||
    href.startsWith('/dashboard/job-analyzer') ||
    href.startsWith('/dashboard/career-goals') ||
    href.startsWith('/dashboard/interview-prep')
  );
}

function PlanStatusTags({
  statusLabel,
  tagLabel,
}: {
  statusLabel?: string | null;
  tagLabel?: string | null;
}) {
  const primary = statusLabel?.trim() || null;
  const tag = tagLabel?.trim() || null;
  if (!primary && !tag) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {primary ? (
        <span className="text-[12px] font-medium leading-relaxed text-white/60">{primary}</span>
      ) : null}
      {tag ? (
        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-white/65">
          {tag}
        </span>
      ) : null}
    </div>
  );
}

function PlanCtaPill({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1 rounded-full border border-[#00C9B1]/50 bg-transparent px-4 py-2 text-[13px] font-medium text-[#00C9B1] transition-colors duration-150 group-hover:border-[#00C9B1] group-hover:bg-[#00C9B1] group-hover:text-[#080A0A] sm:min-h-0 sm:w-auto sm:self-center sm:justify-center">
      {label}
      <ChevronRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
    </span>
  );
}

function FastPathBadge({ minutes, actionLabel }: { minutes?: number | null; actionLabel?: string }) {
  const mins = typeof minutes === 'number' && Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : 1;
  const k = String(actionLabel ?? '').trim().toLowerCase();
  const label =
    k.includes('apply')
      ? 'Quick apply'
      : k.includes('fix')
        ? 'Quick fix'
        : k.includes('analys') || k.includes('analyz')
          ? 'Quick analysis'
          : k.includes('review')
            ? 'Quick review'
            : k.includes('follow')
              ? 'Quick follow-up'
              : k.includes('open')
                ? 'Quick step'
                : 'Quick win';
  return (
    <span className="inline-flex items-center rounded-full border border-[#00C9B1]/45 bg-[#00C9B1]/18 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7EF4E6]">
      {label} (~{mins} min)
    </span>
  );
}

function appendQueryParam(href: string, key: string, value: string): string {
  const [path, hash = ''] = href.split('#');
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  if (!params.has(key)) params.set(key, value);
  const next = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  return hash ? `${next}#${hash}` : next;
}

function shouldFocusCvImprovementsPriority(item: UnifiedPriorityItem, actionLabel: string): boolean {
  const corpus = [
    item.kind,
    item.title,
    item.subtitle,
    item.reasonText,
    item.microcopy,
    item.compactDisplay?.primaryLine,
    item.compactDisplay?.actionLabel,
    actionLabel,
    ...(item.reasonCodes ?? []),
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();
  return /(improv|improvement|cv fix|resume fix|rewrite|bullet|grammar|spelling|spell check|ats)/.test(corpus);
}

function PlanInnerCard({
  item,
  icon: Icon,
  defaultCvProfileId,
  canonicalActionLabel,
  orchestrationCanonicalRoute,
  orchestrationFallbackRoute,
}: {
  item: TodayPlanItem;
  icon: React.ComponentType<{ className?: string }>;
  defaultCvProfileId?: string | null;
  /** Orchestration v1 — backend canonical CTA copy when present */
  canonicalActionLabel?: string | null;
  orchestrationCanonicalRoute?: string | null;
  orchestrationFallbackRoute?: string | null;
}) {
  const remappedHref = resolveExecutionDestination({
    cta: item.cta,
    kind: 'plan_item',
    reasonCodes: item.reasonCodes,
    actionType:
      typeof item.cta.action === 'object' && item.cta.action && !Array.isArray(item.cta.action)
        ? String((item.cta.action as Record<string, unknown>).type ?? '')
        : null,
    journeyNextRoute: item.journey?.nextRoute ?? null,
    ids: { cvProfileId: defaultCvProfileId ?? null },
    defaultCvProfileId,
    safeFallback: '/dashboard/jobs',
    orchestrationCanonicalRoute: orchestrationCanonicalRoute ?? null,
    orchestrationFallbackRoute: orchestrationFallbackRoute ?? null,
  }).href;
  const href =
    remappedHref === '/dashboard/cv' && defaultCvProfileId
      ? `/dashboard/cv?profileId=${encodeURIComponent(defaultCvProfileId)}`
      : remappedHref;
  const titleTrimmed = item.title.trim();
  const rawSubtitle = item.subtitle ?? item.rationale;
  const subtitleTrimmed = typeof rawSubtitle === 'string' ? rawSubtitle.trim() : '';
  const jobLine =
    item.company || item.jobTitle ? [item.jobTitle, item.company].filter(Boolean).join(', ') : '';
  const normEq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  let line2: string | null = null;
  if (jobLine) {
    if (!normEq(jobLine, titleTrimmed)) line2 = jobLine;
  } else if (subtitleTrimmed && !normEq(subtitleTrimmed, titleTrimmed)) {
    line2 = subtitleTrimmed;
  }

  const statusPrimaryRaw = item.statusLabel?.trim() ?? '';
  const effectiveStatusLabel =
    statusPrimaryRaw &&
    !normEq(statusPrimaryRaw, titleTrimmed) &&
    (!line2 || !normEq(statusPrimaryRaw, line2))
      ? statusPrimaryRaw
      : null;

  const tagRaw = item.tagLabel?.trim() ?? '';
  const effectiveTagLabel =
    tagRaw &&
    !normEq(tagRaw, titleTrimmed) &&
    (!effectiveStatusLabel || !normEq(tagRaw, effectiveStatusLabel)) &&
    (!line2 || !normEq(tagRaw, line2))
      ? tagRaw
      : null;
  const score =
    typeof item.matchScore === 'number' && Number.isFinite(item.matchScore) ? item.matchScore : null;

  const shellClass = cn(
    'group flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 transition-[border-color,background-color] duration-150 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5 sm:py-4',
    href && 'cursor-pointer hover:border-white/[0.12] hover:bg-white/[0.055]',
  );

  const body = (
    <>
      <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.1)] sm:h-10 sm:w-10">
          <Icon className="h-[18px] w-[18px] text-[#00C9B1]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold leading-snug text-white">{titleTrimmed}</p>
            {score != null ? (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                  score >= 70 && 'border-[#00C9B1]/35 bg-[#00C9B1]/10 text-[#00C9B1]',
                  score >= 40 && score < 70 && 'border-amber-500/35 bg-amber-500/10 text-amber-200',
                  score < 40 && 'border-rose-500/35 bg-rose-500/10 text-rose-200',
                )}
              >
                {score}%
              </span>
            ) : null}
          </div>
          {line2 ? <p className="mt-1 text-[13px] font-normal leading-snug text-white/50">{line2}</p> : null}
          <PlanStatusTags statusLabel={effectiveStatusLabel} tagLabel={effectiveTagLabel} />
        </div>
      </div>
      <PlanCtaPill label={safeHumanText(canonicalActionLabel ?? null) ?? item.cta.label} />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={shellClass}
        onClick={() => {
          void api.growth.trackEvent({
            eventName: 'suggested_task_started',
            context: {
              route: href,
              title: item.title,
              dedupeKey: todayPlanItemDedupeKey(item),
              relevanceScore: item.matchScore ?? null,
            },
          });
        }}
      >
        {body}
      </Link>
    );
  }

  return <div className={cn(shellClass, 'opacity-90')}>{body}</div>;
}

function UnifiedPriorityCard({
  item,
  defaultCvProfileId,
  emphasized,
  onInvalidNavigate,
  knownApplicationIds,
  knownAnalysisIds,
  jobHistoryByAnalysisId,
  jobHistoryByListingId,
  onInlineExecute,
  tourDataAttr,
  orchestratedRow,
}: {
  item: UnifiedPriorityItem;
  defaultCvProfileId?: string | null;
  emphasized?: boolean;
  onInvalidNavigate?: () => void;
  knownApplicationIds: Set<string>;
  knownAnalysisIds: Set<string>;
  jobHistoryByAnalysisId: Map<string, { title: string; company: string }>;
  jobHistoryByListingId: Map<string, { title: string; company: string }>;
  onInlineExecute?: (item: UnifiedPriorityItem, href: string) => void;
  /** Coach-mark target when dedicated CV Clinic subsection is absent */
  tourDataAttr?: string;
  /** Backend orchestration row — canonical label + route precedence */
  orchestratedRow?: OrchestratedRecommendation | null;
}) {
  const router = useRouter();
  const rawActionLabel =
    orchestratedRow?.canonicalActionLabel?.trim() ||
    item.compactDisplay?.actionLabel?.trim() ||
    item.applyAssist?.primaryActionLabel?.trim() ||
    item.executionContext?.nextImmediateAction?.trim() ||
    item.cta.label;
  /** User-visible CTA — never show leaky orchestration strings when safeHumanText rejects. */
  const displayActionLabel =
    safeHumanText(orchestratedRow?.canonicalActionLabel ?? null) ??
    safeHumanText(item.compactDisplay?.actionLabel ?? null) ??
    safeHumanText(item.applyAssist?.primaryActionLabel ?? null) ??
    safeHumanText(item.executionContext?.nextImmediateAction ?? null) ??
    item.cta.label;
  const trustOrchestration = Boolean(orchestratedRow?.canonicalActionLabel?.trim());
  const actionLooksApplyLike = /apply|review/i.test(rawActionLabel);
  const actionLooksAnalyzeLike = /analysis|analy[sz]e|analyzer|review/i.test(rawActionLabel);
  const actionLooksHubLike = /apply|review|hub|continue/i.test(rawActionLabel);
  const reasonCodesUpper = (item.reasonCodes ?? []).map((x) => String(x).trim().toUpperCase());
  const analyzedNotAppliedReason = reasonCodesUpper.some(
    (c) => c.includes('ANALYZED_NOT_APPLIED') || (c.includes('ANALYZED') && c.includes('NOT') && c.includes('APPLIED')),
  );
  const isCvLike =
    String(item.kind ?? '')
      .toLowerCase()
      .includes('cv') || /cv|resume|clinic|fix/i.test(rawActionLabel);
  const ctaAction =
    item.cta.action !== null && typeof item.cta.action === 'object' && !Array.isArray(item.cta.action)
      ? (item.cta.action as Record<string, unknown>)
      : {};
  const effectiveActionType =
    item.compactDisplay?.actionType?.trim() ||
    item.ctaHint?.trim() ||
    (typeof ctaAction.type === 'string' ? ctaAction.type : '');
  const normalizedActionType = effectiveActionType.trim().toUpperCase();
  const analysisId = (item.ids.jobAnalysisId ?? '').trim();
  const applicationId = (item.ids.applicationId ?? '').trim();
  const bookmarkId = (item.ids.bookmarkId ?? '').trim();
  const listingId = (item.ids.jobListingId ?? '').trim();
  const cvProfileId = (defaultCvProfileId ?? item.ids.cvProfileId ?? '').trim();
  const isAnalyzeActionType = normalizedActionType === 'OPEN_JOB_ANALYZE' || normalizedActionType === 'OPEN_TAILOR';
  const isHubActionType = normalizedActionType === 'OPEN_JOB_HUB';
  const isInterviewActionType = normalizedActionType.includes('INTERVIEW');
  const isInterviewPrepPriority =
    isInterviewActionType || String(item.kind ?? '').toLowerCase().includes('interview_prep');
  const inlineMode = item.executionContext?.executionMode;
  const canInline =
    item.executionContext?.canExecuteInline === true &&
    (inlineMode === 'inline_modal' || inlineMode === 'checklist' || inlineMode === 'generator');
  const interviewPrepContext = item.interviewPrepContext;
  const canonicalInterviewHref = (() => {
    const qp = new URLSearchParams();
    const prepAnalysisId = (interviewPrepContext?.jobAnalysisId ?? analysisId).trim();
    const prepTitle = (interviewPrepContext?.jobTitle ?? '').trim();
    const prepCompany = (interviewPrepContext?.company ?? '').trim();
    const selectedPrepCv = (interviewPrepContext?.selectedCvProfileId ?? '').trim();
    const prepCv = (
      selectedPrepCv ||
      (interviewPrepContext?.cvProfileId ?? '').trim() ||
      cvProfileId
    ).trim();
    const preferredCv = (interviewPrepContext?.preferredCvProfileId ?? '').trim();
    const analyzedCv = (interviewPrepContext?.analyzedCvProfileId ?? '').trim();
    const tailoringCv = (interviewPrepContext?.tailoringCvProfileId ?? '').trim();
    if (prepAnalysisId) qp.set('jobAnalysisId', prepAnalysisId);
    if (prepTitle) qp.set('jobTitle', prepTitle);
    if (prepCompany) qp.set('company', prepCompany);
    if (prepCv) qp.set('cvProfileId', prepCv);
    if (selectedPrepCv) qp.set('selectedCvProfileId', selectedPrepCv);
    if (preferredCv) qp.set('preferredCvProfileId', preferredCv);
    if (analyzedCv) qp.set('analyzedCvProfileId', analyzedCv);
    if (tailoringCv) qp.set('tailoringCvProfileId', tailoringCv);
    if (interviewPrepContext?.hydrationReady === false) qp.set('hydrationReady', '0');
    else if (interviewPrepContext?.hydrationReady === true) qp.set('hydrationReady', '1');
    return `/dashboard/interview${qp.toString() ? `?${qp.toString()}` : ''}`;
  })();
  const canonicalAnalyzeHref = analysisId
    ? `/dashboard/jobs/analyze?jobId=${encodeURIComponent(analysisId)}`
    : listingId
      ? `/dashboard/jobs/analyze?jobListingId=${encodeURIComponent(listingId)}`
      : '/dashboard/jobs/analyze?new=1';
  const canonicalHubHref = applicationId
    ? `/dashboard/jobs?applicationId=${encodeURIComponent(applicationId)}`
    : analysisId
      ? `/dashboard/jobs?jobId=${encodeURIComponent(analysisId)}`
      : bookmarkId
        ? `/dashboard/jobs?bookmarkId=${encodeURIComponent(bookmarkId)}`
        : listingId
          ? `/dashboard/jobs?jobListingId=${encodeURIComponent(listingId)}`
          : '/dashboard/jobs';
  const canonicalCvHref = cvProfileId
    ? `/dashboard/cv?profileId=${encodeURIComponent(cvProfileId)}`
    : '/dashboard/cv';
  const effectiveCta = {
    ...item.cta,
    action: {
      ...ctaAction,
      ...(effectiveActionType ? { type: effectiveActionType } : {}),
      ...(applicationId ? { applicationId } : {}),
      ...(analysisId ? { jobAnalysisId: analysisId } : {}),
      ...(bookmarkId ? { bookmarkId } : {}),
      ...(listingId ? { jobListingId: listingId } : {}),
      ...(cvProfileId ? { cvProfileId } : {}),
      ...(item.executionContext?.applicationId ? { applicationId: item.executionContext.applicationId } : {}),
      ...(item.executionContext?.canonicalJobId ? { canonicalJobId: item.executionContext.canonicalJobId } : {}),
      ...(item.executionContext?.cvProfileId ? { cvProfileId: item.executionContext.cvProfileId } : {}),
      ...(item.executionContext?.recommendationId ? { recommendationId: item.executionContext.recommendationId } : {}),
    },
  };
  const destination = resolveExecutionDestination({
    cta: effectiveCta,
    kind: item.kind,
    reasonCodes: item.reasonCodes,
    actionType: normalizedActionType,
    executionContext: item.executionContext,
    executionPayload: item.executionPayload,
    journeyNextRoute: item.journey?.nextRoute ?? null,
    ids: {
      applicationId,
      jobAnalysisId: analysisId,
      jobListingId: listingId,
      cvProfileId,
    },
    defaultCvProfileId: cvProfileId,
    safeFallback: '/dashboard/jobs',
    orchestrationCanonicalRoute: orchestratedRow?.canonicalRoute ?? null,
    orchestrationFallbackRoute: orchestratedRow?.fallbackRoute ?? null,
  });
  const recommendationState = String(
    item.executionPayload?.recommendationState ?? item.recommendationState ?? 'active',
  )
    .trim()
    .toLowerCase();
  const isInactiveRecommendation =
    recommendationState === 'completed' ||
    recommendationState === 'stale' ||
    recommendationState === 'invalidated' ||
    recommendationState === 'superseded';
  const isDegraded =
    destination.resolutionState !== 'resolved' ||
    DEGRADED_SUPPRESSION_REASONS.has((item.suppressionReason ?? '').trim().toLowerCase());
  const missingInterviewContext =
    (item.suppressionReason ?? '').trim().toLowerCase() === MISSING_INTERVIEW_CONTEXT_REASON;
  const href = (() => {
    if (isInactiveRecommendation) return '';
    let withToken =
      destination.href && item.journey?.contextToken
        ? `${destination.href}${destination.href.includes('?') ? '&' : '?'}contextToken=${encodeURIComponent(item.journey.contextToken)}`
        : destination.href;
    withToken =
      isCvLike && shouldFocusCvImprovementsPriority(item, rawActionLabel)
        ? appendQueryParam(withToken, 'focus', 'improvements')
        : withToken;
    if (!isInterviewPrepPriority || !withToken) return withToken;
    try {
      const u = new URL(withToken, 'https://applymate.invalid');
      if (!u.pathname.startsWith('/dashboard/interview')) return withToken;
      const enrich = new URL(canonicalInterviewHref, 'https://applymate.invalid');
      enrich.searchParams.forEach((value, key) => {
        u.searchParams.set(key, value);
      });
      return `${u.pathname}${u.search}`;
    } catch {
      return withToken;
    }
  })();
  const whyNow = item.explain?.short || item.whyNowShort || item.outcomeCopy || buildWhyNow(item);
  const isAppliedOrLater = isAppliedOrLaterState(item.stateSnapshot?.sourceState);
  const effortBand = inferEffortBand(item);
  const priorityLane = item.priorityState;
  const laneChipLabel = laneLabelForPriorityState(priorityLane);
  const workflowChipLabel = labelForWorkflowState(item.workflowState);
  const laneAccent = shellAccentClassesForPriorityState(priorityLane);
  const laneChipClass = laneChipClassesForPriorityState(priorityLane);
  const effortMeta = (() => {
    const parts: string[] = [];
    if (item.urgencyBucket === 'now') parts.push('Do now');
    else if (item.urgencyBucket === 'soon') parts.push('This week');
    else parts.push('Next up');
    parts.push(labelForEffortBand(effortBand));
    const mins = item.executionContext?.estimatedMinutes ?? item.applyAssist?.estimatedMinutesToApply;
    if (typeof mins === 'number' && Number.isFinite(mins)) {
      parts.push(`~${Math.max(1, Math.round(mins))} min`);
    }
    const ready = labelForReadyState(item.applyAssist?.readyState);
    if (ready) parts.push(ready);
    return parts.join(' · ');
  })();
  const completionLikelihood = item.applyAssist?.completionLikelihood;
  const likelihoodLine =
    typeof completionLikelihood === 'number' && Number.isFinite(completionLikelihood)
      ? completionLikelihood >= 75
        ? 'Likely quick to finish'
        : completionLikelihood >= 45
          ? 'Doable today'
          : 'May take a bit more setup'
      : null;
  const detailsHint = useMemo(() => {
    const candidates: string[] = [];
    if (item.actionReassurance?.trim()) candidates.push(item.actionReassurance.trim());
    if (item.reasonDetailed?.trim()) candidates.push(item.reasonDetailed.trim());
    if (whyNow) candidates.push(whyNow);
    if (item.applyAssist?.suggestedNextStep?.trim()) {
      candidates.push(`Next step: ${item.applyAssist.suggestedNextStep.trim()}`);
    }
    if (likelihoodLine) candidates.push(likelihoodLine);
    candidates.push(effortMeta);

    const limited = candidates
      .filter(Boolean)
      .slice(0, 3)
      .map((line) => (line.length > 120 ? `${line.slice(0, 117).trimEnd()}...` : line));

    return limited.join('\n\n') || null;
  }, [
    effortMeta,
    item.actionReassurance,
    item.applyAssist,
    item.reasonDetailed,
    likelihoodLine,
    whyNow,
  ]);
  const primaryLine = item.compactDisplay?.primaryLine?.trim() || item.subtitle || item.reasonText || '';
  const outcomeHeadline = (item.estimatedOutcome ?? '').trim();
  const subtitle = item.subtitle?.trim() ?? '';
  const contextLine =
    subtitle &&
    subtitle !== primaryLine &&
    !item.title.toLowerCase().includes(subtitle.toLowerCase())
      ? subtitle
      : '';
  const actionLabel =
    trustOrchestration
      ? displayActionLabel
      : isAppliedOrLater && actionLooksApplyLike
        ? 'Continue in Job Hub'
        : displayActionLabel;
  const confShort = formatConfidenceShort(item.confidenceScore);
  const blockersLine = formatBlockersPreview(item.applyAssist?.blockers ?? []);
  const isFastPath =
    item.applyAssist?.fastPathEligible === true && !isAppliedOrLater && effortBand === 'instant';
  const matchedJobContext = (() => {
    const byAnalysis = analysisId ? jobHistoryByAnalysisId.get(analysisId) : undefined;
    if (byAnalysis) return byAnalysis;
    const byListing = listingId ? jobHistoryByListingId.get(listingId) : undefined;
    return byListing ?? null;
  })();
  const roleContextLine =
    item.roleLabel?.trim() ||
    (item.roleTitle?.trim() && item.roleCompany?.trim()
      ? `${item.roleTitle.trim()} · ${item.roleCompany.trim()}`
      : item.roleTitle?.trim() || null) ||
    (matchedJobContext ? `${matchedJobContext.title} · ${matchedJobContext.company}` : null);
  const reassurance = (item.actionReassurance ?? '').trim();
  const primaryRationale = (() => {
    if (item.reasonShort?.trim()) return item.reasonShort.trim();
    if (outcomeHeadline) return outcomeHeadline;
    if (primaryLine && primaryLine !== item.title) return primaryLine;
    if (whyNow) return whyNow;
    return '';
  })();
  const firstSupport = missingInterviewContext
    ? 'Interview prep is not available yet; here is your next valid step.'
    : reassurance || primaryRationale;
  const secondSupport = null;
  const showQuickCue = isFastPath || priorityLane === 'quick_win';
  const recommendedChannel = item.followUpContext?.recommendedChannel
    ? `Channel: ${String(item.followUpContext.recommendedChannel).replace('_', ' ')}`
    : null;
  const followUpConfidence =
    typeof item.followUpContext?.confidence === 'number' && Number.isFinite(item.followUpContext.confidence)
      ? item.followUpContext.confidence >= 0.7
        ? 'High recovery chance'
        : item.followUpContext.confidence >= 0.4
          ? 'Moderate recovery chance'
          : 'Low recovery chance'
      : null;
  const daysSinceFollowUp =
    typeof item.followUpContext?.daysSinceLastActivity === 'number' &&
    Number.isFinite(item.followUpContext.daysSinceLastActivity)
      ? `${Math.max(1, Math.round(item.followUpContext.daysSinceLastActivity))} days inactive`
      : null;
  const estimatedMinutesLabel =
    typeof item.executionContext?.estimatedMinutes === 'number' && Number.isFinite(item.executionContext.estimatedMinutes)
      ? `~${Math.max(1, Math.round(item.executionContext.estimatedMinutes))} min`
      : null;
  const isLowValue =
    !emphasized &&
    (item.urgencyBucket === 'later' || priorityLane === 'waiting' || (priorityLane === 'blocked' && !item.followUpContext?.suggested));
  const hydrateAnalyzePrefill = () => {
    if (isInterviewPrepPriority) return true;
    if (isAppliedOrLater && actionLooksApplyLike) {
      onInvalidNavigate?.();
      return false;
    }
    if (isPriorityInvalidByState(item)) {
      onInvalidNavigate?.();
      return false;
    }
    if (!href) return;
    const actionType = item.compactDisplay?.actionType?.toUpperCase() ?? '';
    const isAnalyzeFlow =
      href.includes('/dashboard/jobs/analyze') ||
      actionType === 'OPEN_JOB_ANALYZE' ||
      actionType === 'OPEN_TAILOR';
    if (!isAnalyzeFlow) return;
    prefillJobAnalyzerInStorage(item.title, item.subtitle ?? '', '', {
      selectedCvId: item.prefill?.selectedCvId ?? item.ids.cvProfileId ?? undefined,
      sourceContext: item.prefill?.sourceContext ?? undefined,
      resumeWorkingStep: item.resumeState?.workingStep ?? undefined,
      hubBookmarkId: item.ids.bookmarkId ?? undefined,
    });
    return true;
  };
  const shellClass = cn(
    'group flex flex-col gap-3 rounded-xl border p-4 transition-[border-color,background-color,box-shadow,opacity] duration-200 motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between',
    priorityLane
      ? laneAccent
      : emphasized
        ? 'border-[#00C9B1]/35 bg-[#00C9B1]/[0.06]'
        : 'border-white/[0.08] bg-white/[0.03]',
    emphasized && 'ring-1 ring-[#00C9B1]/22',
    priorityLane === 'quick_win' && !emphasized && 'p-3',
    isLowValue && 'opacity-80',
    href && 'cursor-pointer hover:border-white/[0.14] hover:bg-white/[0.06]',
  );
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {laneChipLabel ? (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                laneChipClass,
              )}
            >
              {laneChipLabel}
            </span>
          ) : null}
          {workflowChipLabel ? (
            <span className="rounded-full border border-sky-400/28 bg-sky-950/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-sky-100/90">
              {workflowChipLabel}
            </span>
          ) : null}
          {!priorityLane ? (
            <span className="rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/45">
              {labelForEffortBand(effortBand)}
            </span>
          ) : null}
          {item.isNewSinceLastVisit ? (
            <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200">
              New for you
            </span>
          ) : null}
          {detailsHint ? <InfoHint text={detailsHint} buttonClassName="h-5 w-5 text-[#00C9B1]/80" /> : null}
        </div>
        <p className="text-[15px] font-semibold leading-snug text-white">{item.title}</p>
        {roleContextLine ? <p className="mt-1 text-[12px] text-white/58">{roleContextLine}</p> : null}
        {contextLine && !firstSupport ? (
          <p className="mt-1 text-[12px] text-white/50">{contextLine}</p>
        ) : null}
        {firstSupport ? (
          <p className="mt-2 text-[13px] leading-snug text-white/78">{firstSupport}</p>
        ) : null}
        {secondSupport && secondSupport !== firstSupport ? (
          <p className="mt-1.5 text-[12px] leading-snug text-white/50">{secondSupport}</p>
        ) : null}
        {item.kind === 'follow_up' ? (
          <p className="mt-1 text-[11px] text-white/45">
            {[daysSinceFollowUp, followUpConfidence, recommendedChannel].filter(Boolean).slice(0, 2).join(' · ')}
          </p>
        ) : null}
        {isDegraded ? (
          <p className="mt-1 text-[10px] text-white/35">Context refreshed. Continuing with the safest next step.</p>
        ) : null}
        {isInactiveRecommendation ? (
          <p className="mt-1 text-[10px] text-white/35">This recommendation is no longer active. Showing the next best action.</p>
        ) : null}
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end sm:pl-4">
        {estimatedMinutesLabel ? <p className="text-[11px] text-white/45">{estimatedMinutesLabel}</p> : null}
        {showQuickCue ? (
          <FastPathBadge minutes={item.applyAssist?.estimatedMinutesToApply} actionLabel={actionLabel} />
        ) : null}
        <PlanCtaPill label={actionLabel} />
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={shellClass}
        {...(tourDataAttr ? { 'data-tour': tourDataAttr } : {})}
        onClick={(e) => {
          void api.growth.trackEvent({
            eventName: 'suggested_task_started',
            context: {
              route: href,
              title: item.title,
              dedupeKey: unifiedPriorityDedupeKey(item),
              relevanceScore: item.priorityScore,
              confidenceScore: item.confidenceScore ?? null,
              workflowState: item.workflowState ?? null,
              workflowEntityKey: item.workflowEntityKey ?? null,
            },
          });
          if (item.applyAssist?.fastPathEligible) {
            trackProductEvent('fast_path_used', {
              priorityId: item.id,
              kind: item.kind,
              route: href,
              workflowState: item.workflowState ?? null,
              workflowEntityKey: item.workflowEntityKey ?? null,
            });
          }
          trackFunnelEvent('dashboard_cta_clicked', {
            priorityId: item.id,
            kind: item.kind,
            actionLabel,
            fastPathEligible: item.applyAssist?.fastPathEligible === true,
            workflowState: item.workflowState ?? null,
            workflowEntityKey: item.workflowEntityKey ?? null,
          });
          trackProductEvent('recommendation_clicked', {
            ctaSource: 'today_plan_card',
            priorityId: item.id,
            recommendationId: item.recommendationId ?? item.id,
            recommendationFamilyId: item.recommendationFamilyId ?? null,
            priorityState: item.priorityState ?? null,
            workflowState: item.workflowState ?? null,
            workflowEntityKey: item.workflowEntityKey ?? null,
            generationReason: item.generationReason ?? null,
            suppressionReason: item.suppressionReason ?? null,
            canonicalJobId: item.executionContext?.canonicalJobId ?? null,
            applicationId: item.executionContext?.applicationId ?? item.ids.applicationId ?? null,
            cvProfileId: item.executionContext?.cvProfileId ?? item.ids.cvProfileId ?? null,
            completionLatencyMs:
              item.firstSeenAt && !Number.isNaN(Date.parse(item.firstSeenAt))
                ? Math.max(0, Date.now() - Date.parse(item.firstSeenAt))
                : null,
            resolutionState: destination.resolutionState,
          });
          if (destination.resolutionState !== 'resolved') {
            trackProductEvent('degraded_execution_opened', {
              recommendationId: item.recommendationId ?? item.id,
              recommendationFamilyId: item.recommendationFamilyId ?? null,
              resolutionState: destination.resolutionState,
              route: href,
            });
            trackProductEvent('degraded_route_opened', {
              recommendationId: item.recommendationId ?? item.id,
              recommendationFamilyId: item.recommendationFamilyId ?? null,
              resolutionState: destination.resolutionState,
              route: href,
            });
          }
          if (destination.usedFallback) {
            trackProductEvent('fallback_route_used', {
              recommendationId: item.recommendationId ?? item.id,
              recommendationFamilyId: item.recommendationFamilyId ?? null,
              resolutionReason: destination.reason,
              route: href,
            });
          }
          if (destination.missingContext) {
            trackProductEvent('stale_execution_detected', {
              recommendationId: item.recommendationId ?? item.id,
              recommendationFamilyId: item.recommendationFamilyId ?? null,
              route: href,
            });
            trackProductEvent('missing_context_detected', {
              recommendationId: item.recommendationId ?? item.id,
              recommendationFamilyId: item.recommendationFamilyId ?? null,
              route: href,
            });
          }
          if (canInline && href) {
            e.preventDefault();
            onInlineExecute?.(item, href);
            return;
          }
          try {
            window.sessionStorage.setItem('applymate:last-recommendation-clicked-at', String(Date.now()));
            window.sessionStorage.setItem('applymate:last-recommendation-id', item.id);
          } catch {
            /* ignore */
          }
          if (item.kind === 'follow_up') {
            trackProductEvent('followup_started', {
              priorityId: item.id,
              recommendedChannel: item.followUpContext?.recommendedChannel ?? null,
              route: href,
              recommendationId: item.recommendationId ?? item.id,
              recommendationFamilyId: item.recommendationFamilyId ?? null,
              suppressionReason: item.suppressionReason ?? null,
              canonicalJobId: item.executionContext?.canonicalJobId ?? null,
              applicationId: item.executionContext?.applicationId ?? item.ids.applicationId ?? null,
            });
            if (/send\s+follow-?up/i.test(actionLabel)) {
              trackProductEvent('followup_sent', {
                priorityId: item.id,
                route: href,
              });
            }
          }
          const ok = hydrateAnalyzePrefill();
          if (ok === false) e.preventDefault();
          if (typeof window !== 'undefined') {
            console.info('[Dashboard CTA route]', {
              recommendationId: item.recommendationId ?? item.id,
              title: item.title,
              canonicalRoute:
                item.executionPayload?.canonicalRoute ??
                item.executionContext?.canonicalRoute ??
                null,
              deepLink: item.executionContext?.deepLink ?? null,
              finalNavigatedRoute: href,
            });
          }
          if (!isKnownDashboardHref(href)) {
            e.preventDefault();
            trackProductEvent('stale_action_blocked', {
              priorityId: item.id,
              reason: 'invalid_route',
              route: href,
            });
            router.push('/dashboard/jobs');
            return;
          }
          const applicationIdMatch = href.match(/[?&]applicationId=([^&]+)/i);
          const jobIdMatch = href.match(/[?&]jobId=([^&]+)/i);
          const hasMissingApplicationTarget =
            applicationIdMatch && !knownApplicationIds.has(decodeURIComponent(applicationIdMatch[1] ?? '').trim());
          const hasMissingJobTarget =
            jobIdMatch && !knownAnalysisIds.has(decodeURIComponent(jobIdMatch[1] ?? '').trim());
          if ((hasMissingApplicationTarget || hasMissingJobTarget) && destination.reason === 'local_fallback') {
            e.preventDefault();
            const fallback = item.kind === 'follow_up'
              ? '/dashboard/jobs?view=active&recovered=1'
              : isInterviewPrepPriority
              ? '/dashboard/interview'
              : listingId
                ? `/dashboard/jobs/analyze?jobListingId=${encodeURIComponent(listingId)}`
                : '/dashboard/jobs/analyze?new=1';
            const target =
              item.journey?.contextToken && !fallback.includes('contextToken=')
                ? `${fallback}&contextToken=${encodeURIComponent(item.journey.contextToken)}`
                : fallback;
            router.push(target);
          }
        }}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={shellClass} {...(tourDataAttr ? { 'data-tour': tourDataAttr } : {})}>
      {body}
    </div>
  );
}

type PanelProps = {
  data: TodayPlanPayload | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRefresh: () => void;
  defaultCvProfileId?: string | null;
  heroClusterId?: string | null;
  suppressContinuation?: boolean;
};

function InlineExecutionModal({
  item,
  href,
  onClose,
  onComplete,
}: {
  item: UnifiedPriorityItem;
  href: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const follow = item.followUpContext;
  const prep = item.interviewPrepContext;
  const cvFix = item.cvFixContext;
  const checklist = item.executionContext?.preparationChecklist ?? prep?.preparationChecklist ?? [];
  const talkingPoints = item.executionContext?.suggestedTalkingPoints ?? prep?.likelyTopics ?? [];
  const questions = prep?.likelyQuestions ?? [];
  const draft = follow?.draftMessage ?? item.executionContext?.preparedDraft ?? '';
  const [draftMessage, setDraftMessage] = useState(draft);
  const role = item.roleLabel ?? [item.roleTitle, item.roleCompany].filter(Boolean).join(' at ');
  return (
    <div className="fixed inset-0 z-[80] bg-black/55 p-4 backdrop-blur-[1px]">
      <div className="mx-auto max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0B1111] p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-white/45">Assisted execution</p>
            <h3 className="mt-1 text-[17px] font-semibold text-white">{item.title}</h3>
            {role ? <p className="mt-1 text-[12px] text-white/55">{role}</p> : null}
          </div>
          <button type="button" className="text-white/55 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>
        {item.executionContext?.nextImmediateAction ? (
          <p className="text-[13px] text-white/78">{item.executionContext.nextImmediateAction}</p>
        ) : null}
        {item.executionContext?.emotionalBenefit ? (
          <p className="mt-1 text-[12px] text-white/55">{item.executionContext.emotionalBenefit}</p>
        ) : null}
        {follow ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[12px] text-white/70">
              {[follow.daysSinceLastActivity != null ? `${Math.round(follow.daysSinceLastActivity)} days inactive` : null, follow.recommendedSendWindow, follow.rationaleShort]
                .filter(Boolean)
                .slice(0, 2)
                .join(' · ')}
            </p>
            <textarea
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              className="mt-2 min-h-[96px] w-full rounded-lg border border-white/10 bg-[#0C1515] p-2.5 text-[12px] text-white/80 outline-none focus:border-[#00C9B1]/45"
            />
          </div>
        ) : null}
        {cvFix ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px] text-white/75">
            <p>{cvFix.affectedSection ? `Section: ${cvFix.affectedSection}` : 'CV section needs attention'}</p>
            {cvFix.suggestedPatch ? <p className="mt-1">{cvFix.suggestedPatch}</p> : null}
            {cvFix.expectedImpact ? <p className="mt-1 text-[#9CF5EA]">{cvFix.expectedImpact}</p> : null}
          </div>
        ) : null}
        {checklist.length > 0 ? (
          <div className="mt-4">
            <p className="text-[12px] font-semibold text-white/85">Checklist</p>
            <ul className="mt-1 space-y-1 text-[12px] text-white/70">
              {checklist.slice(0, 5).map((x) => (
                <li key={x}>- {x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {talkingPoints.length > 0 ? (
          <div className="mt-3">
            <p className="text-[12px] font-semibold text-white/85">Talking points</p>
            <ul className="mt-1 space-y-1 text-[12px] text-white/70">
              {talkingPoints.slice(0, 4).map((x) => (
                <li key={x}>- {x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {questions.length > 0 ? (
          <div className="mt-3">
            <p className="text-[12px] font-semibold text-white/85">Likely questions</p>
            <ul className="mt-1 space-y-1 text-[12px] text-white/70">
              {questions.slice(0, 3).map((x) => (
                <li key={x}>- {x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80" onClick={onClose}>
            Later
          </button>
          {follow ? (
            <>
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/85"
                onClick={() => {
                  if (draftMessage.trim()) void navigator.clipboard?.writeText(draftMessage.trim());
                }}
              >
                Copy message
              </button>
              <Link
                href={`mailto:?body=${encodeURIComponent(draftMessage.trim())}`}
                onClick={onComplete}
                className="rounded-full border border-white/30 px-4 py-2 text-[12px] font-semibold text-white/90"
              >
                Send follow-up
              </Link>
            </>
          ) : null}
          <Link href={href} onClick={onComplete} className="rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[12px] font-semibold text-[#00C9B1]">
            Continue
          </Link>
        </div>
      </div>
    </div>
  );
}

export function TodayPlanPanel({
  data,
  isLoading,
  isFetching,
  error,
  onRefresh,
  defaultCvProfileId,
  heroClusterId,
  suppressContinuation = false,
}: PanelProps) {
  const toast = useToast();
  const prefetchedPriorityIdsRef = useRef<Set<string>>(new Set());
  const prevActionsCompletedRef = useRef<number | null>(null);
  const prevActionsRemainingRef = useRef<number | null>(null);
  const [showSuccessPulse, setShowSuccessPulse] = useState(false);
  const [inlineExecution, setInlineExecution] = useState<{ item: UnifiedPriorityItem; href: string; openedAt: number } | null>(
    null,
  );
  const applications = useApplications();
  const history = useJobHistory();
  const appliedApplicationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const app of applications.data ?? []) {
      const status = String((app as { status?: unknown }).status ?? '').trim().toLowerCase();
      if (isAppliedOrLaterState(status) && typeof app.id === 'string' && app.id.trim()) {
        ids.add(app.id.trim());
      }
    }
    return ids;
  }, [applications.data]);
  const knownApplicationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const app of applications.data ?? []) {
      if (typeof app.id === 'string' && app.id.trim()) ids.add(app.id.trim());
    }
    return ids;
  }, [applications.data]);
  const appliedAnalysisIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of history.data ?? []) {
      const state = String((row as { state?: unknown }).state ?? '').trim().toLowerCase();
      const pipeline = String((row as { pipelineStatus?: unknown }).pipelineStatus ?? '').trim().toLowerCase();
      const isApplied = (row as { isApplied?: unknown }).isApplied === true;
      if (isAppliedOrLaterState(state, isApplied) || isAppliedOrLaterState(pipeline, isApplied)) {
        if (typeof row.id === 'string' && row.id.trim()) ids.add(row.id.trim());
      }
    }
    return ids;
  }, [history.data]);
  const knownAnalysisIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of history.data ?? []) {
      if (typeof row.id === 'string' && row.id.trim()) ids.add(row.id.trim());
    }
    return ids;
  }, [history.data]);
  const jobHistoryByAnalysisId = useMemo(() => {
    const map = new Map<string, { title: string; company: string }>();
    for (const row of history.data ?? []) {
      const id = (row.id ?? '').trim();
      if (!id) continue;
      const title = (row.jobTitle || row.title || '').trim();
      const company = (row.company ?? '').trim();
      if (!title && !company) continue;
      map.set(id, { title: title || 'Role', company: company || 'Company' });
    }
    return map;
  }, [history.data]);
  const jobHistoryByListingId = useMemo(() => {
    const map = new Map<string, { title: string; company: string }>();
    for (const row of history.data ?? []) {
      const listingId = (row.jobListingId ?? '').trim();
      if (!listingId) continue;
      const title = (row.jobTitle || row.title || '').trim();
      const company = (row.company ?? '').trim();
      if (!title && !company) continue;
      map.set(listingId, { title: title || 'Role', company: company || 'Company' });
    }
    return map;
  }, [history.data]);
  const invalidByLiveState = useMemo(
    () => (item: UnifiedPriorityItem) => {
      const appId = item.ids.applicationId?.trim() ?? '';
      if (appId && appliedApplicationIds.has(appId)) return true;
      const analysisId = (item.ids.jobAnalysisId ?? '').trim();
      if (analysisId && appliedAnalysisIds.has(analysisId)) return true;
      const listingId = (item.ids.jobListingId ?? '').trim();
      if (listingId) {
        for (const row of history.data ?? []) {
          if ((row.jobListingId ?? '').trim() !== listingId) continue;
          const state = String((row as { state?: unknown }).state ?? '').trim().toLowerCase();
          const pipeline = String((row as { pipelineStatus?: unknown }).pipelineStatus ?? '').trim().toLowerCase();
          const isApplied = (row as { isApplied?: unknown }).isApplied === true;
          if (isAppliedOrLaterState(state, isApplied) || isAppliedOrLaterState(pipeline, isApplied)) return true;
        }
      }
      return false;
    },
    [appliedApplicationIds, appliedAnalysisIds, history.data],
  );
  const dashboardVm = useMemo(
    () => (data ? buildDashboardViewModel(data, { defaultCvProfileId }) : null),
    [data, defaultCvProfileId],
  );
  const continuationsFiltered = useMemo(() => {
    const raw = data?.recentAnalysesContinuations ?? [];
    const orch = data && isOrchestrationV1(data);
    const heroId = data ? effectiveHeroRecommendationId(data) : null;
    const contId = data ? effectiveContinuationRecommendationId(data) : null;
    let list = raw.filter((it) => (it.matchScore ?? 0) > 0);
    if (orch && heroId) {
      list = list.filter((it) => it.id !== heroId);
    }
    if (orch && contId) {
      list = list.filter((it) => it.id !== contId);
    }
    return list.slice(0, 3);
  }, [data?.recentAnalysesContinuations, data]);
  const sortedPriorities = useMemo(() => {
    const items = data?.unifiedPriorities.items ?? [];
    const orchActive = data ? isOrchestrationV1(data) : false;

    let pipeline = orchestratePriorities(items)
      .filter((x) => !isPriorityInvalidByState(x))
      .filter((x) => !x.suppressedBy)
      .filter((x) => (heroClusterId ? (x.recommendationClusterId ?? '').trim() !== heroClusterId : true));

    if (dashboardVm?.usesExperienceLayer && data && dashboardVm.priorityOrderHint.length > 0) {
      const byId = orchestratedRowByRecommendationId(data);
      const heroId = effectiveHeroRecommendationId(data);
      const contId = effectiveContinuationRecommendationId(data);
      const hint = dashboardVm.priorityOrderHint;
      const hintIndex = new Map(hint.map((id, idx) => [id, idx]));
      pipeline = pipeline.filter((x) => {
        const row = byId.get(x.id);
        if (!row) return false;
        const surf = String(row.assignedSurface ?? '')
          .trim()
          .toLowerCase();
        if (surf === 'hidden') return false;
        if (heroId && x.id === heroId) return false;
        if (contId && x.id === contId) return false;
        if (dashboardVm.suppressedIds.has(x.id)) return false;
        if (shouldSuppressPriorityForContinuationDup(data, x.id)) return false;
        if (!hintIndex.has(x.id)) return false;
        return isPrimaryPrioritySurface(row.assignedSurface);
      });
      pipeline.sort((a, b) => {
        const ia = hintIndex.get(a.id) ?? 9999;
        const ib = hintIndex.get(b.id) ?? 9999;
        if (ia !== ib) return ia - ib;
        const ra = byId.get(a.id)?.surfaceRank ?? 9999;
        const rb = byId.get(b.id)?.surfaceRank ?? 9999;
        return ra - rb;
      });
      return pipeline;
    }

    if (orchActive && data) {
      const byId = orchestratedRowByRecommendationId(data);
      const heroId = effectiveHeroRecommendationId(data);
      const contId = effectiveContinuationRecommendationId(data);
      pipeline = pipeline.filter((x) => {
        const row = byId.get(x.id);
        if (!row) return false;
        const surf = String(row.assignedSurface ?? '')
          .trim()
          .toLowerCase();
        if (surf === 'hidden') return false;
        if (heroId && x.id === heroId) return false;
        if (contId && x.id === contId) return false;
        if (dashboardVm?.usesExperienceLayer && dashboardVm.suppressedIds.has(x.id)) return false;
        if (dashboardVm?.usesExperienceLayer && shouldSuppressPriorityForContinuationDup(data, x.id))
          return false;
        return isPrimaryPrioritySurface(row.assignedSurface);
      });
      pipeline.sort((a, b) => {
        const ra = byId.get(a.id)?.surfaceRank ?? 9999;
        const rb = byId.get(b.id)?.surfaceRank ?? 9999;
        if (ra !== rb) return ra - rb;
        const aOrder =
          typeof a.displayPriority === 'number' && Number.isFinite(a.displayPriority)
            ? a.displayPriority
            : Number.POSITIVE_INFINITY;
        const bOrder =
          typeof b.displayPriority === 'number' && Number.isFinite(b.displayPriority)
            ? b.displayPriority
            : Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        return a.id.localeCompare(b.id);
      });
      return pipeline;
    }

    pipeline = pipeline.filter((x) => !invalidByLiveState(x));

    const sorted = pipeline
      .sort((a, b) => {
        const aOrder =
          typeof a.displayPriority === 'number' && Number.isFinite(a.displayPriority)
            ? a.displayPriority
            : Number.POSITIVE_INFINITY;
        const bOrder =
          typeof b.displayPriority === 'number' && Number.isFinite(b.displayPriority)
            ? b.displayPriority
            : Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        return a.id.localeCompare(b.id);
      });
    const seen = new Set<string>();
    const seenFamily = new Set<string>();
    const deduped: UnifiedPriorityItem[] = [];
    for (const x of sorted) {
      const fam = x.recommendationFamilyId?.trim();
      if (fam && seenFamily.has(fam)) continue;
      const key = x.dedupeGroupKey?.trim() || unifiedPriorityDedupeKey(x);
      if (seen.has(key)) continue;
      const canon = discoveryJobBoardCanonicalDedupeKey(x);
      if (canon && seen.has(canon)) continue;
      if (canon) seen.add(canon);
      seen.add(key);
      if (fam) seenFamily.add(fam);
      deduped.push(x);
    }
    return deduped;
  }, [data, invalidByLiveState, heroClusterId, dashboardVm]);

  const canonicalByRecId = useMemo(
    () => (data ? canonicalRowByRecommendationId(data) : new Map()),
    [data],
  );

  const orchPlanCanon = (itemId: string) => {
    const row = canonicalByRecId.get(itemId);
    return {
      canonicalActionLabel: row?.canonicalActionLabel ?? null,
      orchestrationCanonicalRoute: row?.canonicalRoute ?? null,
      orchestrationFallbackRoute: row?.fallbackRoute ?? null,
    };
  };

  const coveredUnifiedDestinationKeys = useMemo(
    () => new Set(sortedPriorities.map((x) => unifiedPriorityDedupeKey(x))),
    [sortedPriorities],
  );

  const nextStepEffective = useMemo(() => {
    const ns = data?.nextStep;
    if (!ns) return null;
    if (data && isOrchestrationV1(data)) return null;
    if (dashboardVm?.suppressLegacyNextStep) return null;
    const k = todayPlanItemDedupeKey(ns);
    if (coveredUnifiedDestinationKeys.has(k)) return null;
    return ns;
  }, [data, coveredUnifiedDestinationKeys, dashboardVm?.suppressLegacyNextStep]);

  const suppressedKeys = useMemo(() => {
    const s = new Set(coveredUnifiedDestinationKeys);
    if (nextStepEffective) s.add(todayPlanItemDedupeKey(nextStepEffective));
    return s;
  }, [coveredUnifiedDestinationKeys, nextStepEffective]);

  const todaysFocusFiltered = useMemo(() => {
    const items = data?.todaysFocus ?? [];
    const seen = new Set<string>();
    const out: TodayPlanItem[] = [];
    for (const it of items) {
      const k = todayPlanItemDedupeKey(it);
      if (suppressedKeys.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, [data?.todaysFocus, suppressedKeys]);

  const suppressedAfterFocus = useMemo(() => {
    const s = new Set(suppressedKeys);
    for (const it of todaysFocusFiltered) s.add(todayPlanItemDedupeKey(it));
    return s;
  }, [suppressedKeys, todaysFocusFiltered]);

  const needsAttentionFiltered = useMemo(() => {
    const items = data?.needsAttention ?? [];
    const seen = new Set<string>();
    const out: TodayPlanItem[] = [];
    for (const it of items) {
      const k = todayPlanItemDedupeKey(it);
      if (suppressedAfterFocus.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, [data?.needsAttention, suppressedAfterFocus]);

  const suppressedAfterNeeds = useMemo(() => {
    const s = new Set(suppressedAfterFocus);
    for (const it of needsAttentionFiltered) s.add(todayPlanItemDedupeKey(it));
    return s;
  }, [suppressedAfterFocus, needsAttentionFiltered]);

  const cvClinicEffective = useMemo(() => {
    const nudge = data?.cvClinicNudge;
    if (!nudge) return null;
    const k = todayPlanItemDedupeKey(nudge);
    if (suppressedAfterNeeds.has(k)) return null;
    return nudge;
  }, [data?.cvClinicNudge, suppressedAfterNeeds]);

  const firstCvFixPriorityId = useMemo(
    () =>
      sortedPriorities.find((x) => String(x.kind ?? '').toLowerCase() === 'cv_fix')?.id ??
      sortedPriorities.find((x) => String(x.kind ?? '').toLowerCase().includes('cv'))?.id ??
      null,
    [sortedPriorities],
  );

  const topPriorityIds = useMemo(() => sortedPriorities.slice(0, 3).map((x) => x.id), [sortedPriorities]);
  const unseenTopPriorityIds = useMemo(
    () => topPriorityIds.filter((id) => !prefetchedPriorityIdsRef.current.has(id)),
    [topPriorityIds],
  );
  useEffect(() => {
    if (unseenTopPriorityIds.length === 0) return;
    void api.dashboard
      .prefetchNextActions({ priorityIds: unseenTopPriorityIds })
      .then((bundle) => {
        cacheNextActionPrefetchBundle(bundle);
      })
      .finally(() => {
        for (const id of unseenTopPriorityIds) prefetchedPriorityIdsRef.current.add(id);
      });
  }, [unseenTopPriorityIds]);

  useEffect(() => {
    if (!data) return;
    const current = data.progress.actionsCompletedToday;
    const remaining = data.dailyMission.actionsRemainingToday;
    if (prevActionsCompletedRef.current === null) {
      prevActionsCompletedRef.current = current;
      prevActionsRemainingRef.current = remaining;
      return;
    }
    const completedIncreased = current > prevActionsCompletedRef.current;
    const becameDailyComplete =
      prevActionsRemainingRef.current !== null && prevActionsRemainingRef.current > 0 && remaining === 0;
    if (completedIncreased || becameDailyComplete) {
      setShowSuccessPulse(true);
      trackProductEvent('mission_completed', {
        actionsCompletedToday: current,
        becameDailyComplete,
      });
      try {
        const clickedAt = Number(window.sessionStorage.getItem('applymate:last-recommendation-clicked-at') ?? 0);
        const clickedId = window.sessionStorage.getItem('applymate:last-recommendation-id') ?? '';
        trackProductEvent('recommendation_completed', {
          priorityId: clickedId || null,
          completionLatencyMs:
            Number.isFinite(clickedAt) && clickedAt > 0 ? Math.max(0, Date.now() - clickedAt) : null,
        });
      } catch {
        trackProductEvent('recommendation_completed', {
          priorityId: null,
          completionLatencyMs: null,
        });
      }
      const id = window.setTimeout(() => setShowSuccessPulse(false), 1800);
      prevActionsCompletedRef.current = current;
      prevActionsRemainingRef.current = remaining;
      return () => window.clearTimeout(id);
    }
    prevActionsCompletedRef.current = current;
    prevActionsRemainingRef.current = remaining;
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[rgba(0,201,177,0.25)] bg-[rgba(0,201,177,0.04)] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#00C9B1]" />
          <Skeleton height={22} width={160} borderRadius={6} />
        </div>
        <Skeleton height={100} borderRadius={12} className="mb-3" />
        <Skeleton height={88} borderRadius={12} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-6">
        <p className="text-[13px] font-medium text-rose-100/90">
          Could not load Today&apos;s Plan. Your other dashboard data is unchanged.
        </p>
        <button
          type="button"
          onClick={() => onRefresh()}
          className="mt-4 text-[13px] font-medium text-[#00C9B1] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const hasAny =
    sortedPriorities.length > 0 ||
    Boolean(nextStepEffective) ||
    todaysFocusFiltered.length > 0 ||
    needsAttentionFiltered.length > 0 ||
    Boolean(cvClinicEffective) ||
    continuationsFiltered.length > 0 ||
    (dashboardVm && !dashboardVm.usesExperienceLayer ? dashboardVm.informationalSurfaces.length : 0) > 0;

  if (!hasAny) {
    return (
      <div
        data-tour="todays-plan"
        className="rounded-2xl border border-[rgba(0,201,177,0.25)] bg-[rgba(0,201,177,0.04)] p-6 sm:p-8"
      >
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-[#00C9B1]" aria-hidden />
          <h2 className="text-[16px] font-semibold text-white">Today&apos;s Plan</h2>
        </div>
        <p className="text-[13px] leading-relaxed text-white/60">
          Nothing queued here yet. When you analyze a role or save a job, we will line up the best next move for
          you.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/jobs/analyze?new=1"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/50 bg-[#00C9B1]/10 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1]/20"
          >
            Analyze a job
          </Link>
          <Link
            href="/dashboard/job-board"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white"
          >
            Open job board
          </Link>
        </div>
      </div>
    );
  }

  const refreshed =
    data.generatedAt && !Number.isNaN(Date.parse(data.generatedAt))
      ? new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : null;
  const derivedCurrent = sortedPriorities.length;
  const derivedNew = sortedPriorities.filter((x) => x.isNewSinceLastVisit).length;
  const currentCount = derivedCurrent;
  const newCount = derivedNew;
  const localCount = data.unifiedPriorities.summary.localRecommendationsCount;
  const remoteFallbackCount = data.unifiedPriorities.summary.remoteFallbackRecommendationsCount;
  const validPriorityIds = new Set(sortedPriorities.map((x) => x.id));
  const recommendedIds = new Set(data.dailyMission.recommendedPriorityIds.filter((id) => validPriorityIds.has(id)));
  const primaryPriorityId = data.dailyMission.primaryPriorityId;
  const continuationId = data.continuationState.suggestedPriorityId;
  const promotedPrimaryId =
    (primaryPriorityId && validPriorityIds.has(primaryPriorityId) ? primaryPriorityId : null) ??
    (continuationId && validPriorityIds.has(continuationId) ? continuationId : null) ??
    sortedPriorities[0]?.id ??
    null;
  const effectivePrimaryId = promotedPrimaryId;
  const continuationPriority =
    (() => {
      if (data && isOrchestrationV1(data)) {
        const cid = effectiveContinuationRecommendationId(data);
        if (cid) {
          const hit = data.unifiedPriorities.items.find((x) => x.id === cid);
          if (hit) return hit;
        }
      }
      const byId =
        data.continuationState.suggestedPriorityId != null
          ? sortedPriorities.find((x) => x.id === data.continuationState.suggestedPriorityId) ?? null
          : null;
      if (byId) return byId;
      const rr = (data.continuationState.resolvedRoute ?? '').trim();
      if (!rr) return null;
      return (
        sortedPriorities.find((x) => {
          const href = resolveExecutionDestination({
            cta: x.cta,
            kind: x.kind,
            reasonCodes: x.reasonCodes,
            actionType: x.ctaHint,
            executionContext: x.executionContext,
            executionPayload: x.executionPayload,
            journeyNextRoute: x.journey?.nextRoute ?? null,
            ids: x.ids,
            defaultCvProfileId,
            safeFallback: '/dashboard/jobs',
          }).href;
          return href.trim() === rr;
        }) ?? null
      );
    })();
  const hasTopPriorityCards = sortedPriorities.length > 0;
  const displayedTopPriorities = (() => {
    const max = dashboardVm?.maxPriorityCards ?? 4;
    if (data && isOrchestrationV1(data)) {
      return sortedPriorities.slice(0, max);
    }
    const top = sortedPriorities.slice(0, max);
    if (!continuationPriority) return top;
    if (top.some((x) => x.id === continuationPriority.id)) return top;
    if (top.length < max) return [...top, continuationPriority];
    return [...top.slice(0, max - 1), continuationPriority];
  })();
  const continuationFallbackPriority =
    continuationPriority ??
    (data.continuationState.suggestedPriorityId
      ? sortedPriorities.find((x) => x.id === data.continuationState.suggestedPriorityId) ?? null
      : null) ??
    displayedTopPriorities[0] ??
    null;
  const continuationFallbackHref = continuationFallbackPriority
    ? resolveExecutionDestination({
        cta: continuationFallbackPriority.cta,
        kind: continuationFallbackPriority.kind,
        reasonCodes: continuationFallbackPriority.reasonCodes,
        actionType: continuationFallbackPriority.ctaHint,
        executionContext: continuationFallbackPriority.executionContext,
      executionPayload: continuationFallbackPriority.executionPayload,
        journeyNextRoute: continuationFallbackPriority.journey?.nextRoute ?? null,
        ids: continuationFallbackPriority.ids,
        defaultCvProfileId,
        safeFallback: '/dashboard/jobs',
        orchestrationCanonicalRoute:
          data && isOrchestrationV1(data) && continuationFallbackPriority
            ? getOrchestratedRowForItem(data, continuationFallbackPriority)?.canonicalRoute ?? null
            : null,
        orchestrationFallbackRoute:
          data && isOrchestrationV1(data) && continuationFallbackPriority
            ? getOrchestratedRowForItem(data, continuationFallbackPriority)?.fallbackRoute ?? null
            : null,
      }).href
    : null;
  const continuationResolvedRouteRaw =
    data && isOrchestrationV1(data) && data.continuationHint?.canonicalRoute?.trim()
      ? data.continuationHint.canonicalRoute.trim()
      : (data.continuationState.resolvedRoute ?? '').trim() || null;
  const continuationResolvedRoute = continuationResolvedRouteRaw
    ? resolveExecutionDestination({
        actionType: 'OPEN_JOB_HUB',
        kind: continuationPriority?.kind ?? null,
        executionContext: {
          canonicalRoute: continuationResolvedRouteRaw,
          deepLink: continuationResolvedRouteRaw,
          fallbackRoute: continuationFallbackHref ?? '/dashboard/jobs',
          resolutionState: 'resolved',
          applicationId: continuationPriority?.ids.applicationId ?? null,
          canonicalJobId: continuationPriority?.ids.jobAnalysisId ?? null,
          cvProfileId: continuationPriority?.ids.cvProfileId ?? null,
        },
        ids: continuationPriority?.ids ?? null,
        reasonCodes: continuationPriority?.reasonCodes ?? [],
        safeFallback: '/dashboard/jobs',
      }).href
    : null;
  const continuationCanDeepLink = Boolean(continuationResolvedRoute);
  const continuationHref = continuationCanDeepLink
    ? continuationResolvedRoute
    : continuationFallbackHref || '/dashboard/jobs';
  const continuationRawLabel = (
    safeHumanText(data.continuationState.taskDisplayTitle) ??
    safeHumanText(data.continuationState.specificTaskLabel) ??
    ''
  ).trim();
  const continuationLabelLooksGeneric =
    /^open\b/i.test(continuationRawLabel) || /^continue\b/i.test(continuationRawLabel);
  const continuationTaskLabel =
    continuationRawLabel && !continuationLabelLooksGeneric
      ? continuationRawLabel
      : continuationPriority?.title || continuationRawLabel || 'Continue your next task';
  const missionTarget = data.dailyMission.targetActionsToday || (currentCount > 0 ? 1 : 0);
  const todayActionsLeft = Math.max(
    0,
    data.dailyMission.actionsRemainingToday || Math.max(0, missionTarget - data.progress.actionsCompletedToday),
  );
  const isDailyGoalComplete = todayActionsLeft <= 0 && data.progress.actionsCompletedToday > 0;
  const showCompletionTag = isDailyGoalComplete || showSuccessPulse;
  const showMission = data.dailyMission.isMeaningful && effectivePrimaryId;
  const missionProgressContextSafe = sanitizeHeroPlanCopy(data.dailyMission.progressContext);
  const continuationMessageSafe = sanitizeHeroPlanCopy(data.continuationState.message);
  const missionImpactLabelSafe = sanitizeHeroPlanCopy(data.dailyMission.impactLabel);
  const completionRewardCopySafe = sanitizeHeroPlanCopy(data.dailyMission.completionRewardCopy);
  const missionLead = showMission
    ? missionProgressContextSafe ||
      `Choose one action from the highlighted priority to complete today (${todayActionsLeft} left).`
    : continuationMessageSafe || 'Keep momentum with one relevant action from your priorities below.';
  const moreSignalsSummaryParts = [
    `${data.sinceLastVisit.newJobsCount} new jobs`,
    `${data.progress.actionsCompletedWeek} actions this week`,
    `${data.unifiedPriorities.summary.highPriorityCount} high priority`,
    `${data.unifiedPriorities.summary.followUpDueCount} follow-ups due`,
    `${data.progress.pipelineAdvancedWeek} moved forward this week`,
  ];
  if (localCount > 0 || remoteFallbackCount > 0) {
    moreSignalsSummaryParts.push(
      `${localCount} local matches${remoteFallbackCount > 0 ? `, ${remoteFallbackCount} remote fallback` : ''}`,
    );
  }
  if (data.unifiedPriorities.summary.recommendationQuality) {
    moreSignalsSummaryParts.push(
      `quality threshold ${Math.round(data.unifiedPriorities.summary.recommendationQuality.thresholdUsed)}`,
    );
  }
  const moreSignalsText = moreSignalsSummaryParts.join('. ');

  const resume = data.continuationState;
  const resumeHeadline =
    resume.lastMeaningfulAction?.title?.trim() || continuationTaskLabel || 'Pick up where you left off';
  const resumeContextParts = [
    formatInterruptionAge(resume.interruptionAgeHours),
    resume.remainingSteps != null && resume.remainingSteps > 0
      ? resume.remainingSteps === 1
        ? 'One step left'
        : `About ${resume.remainingSteps} steps left`
      : null,
    resume.estimatedMinutesLeft != null
      ? `About ${Math.max(1, Math.round(resume.estimatedMinutesLeft))} min left`
      : null,
    typeof resume.resumeConfidence === 'number' && resume.resumeConfidence >= 72
      ? 'Strong signal this is the right place to continue'
      : null,
  ].filter(Boolean);
  const resumeContextText = resumeContextParts.join('. ');
  const showResumeBanner =
    Boolean(continuationHref) &&
    (resume.lastMeaningfulAction != null ||
      resume.remainingSteps != null ||
      resume.interruptionAgeHours != null ||
      resume.estimatedMinutesLeft != null);
  const handleInlineExecute = (item: UnifiedPriorityItem, href: string) => {
    setInlineExecution({ item, href, openedAt: Date.now() });
    trackProductEvent('modal_opened', {
      recommendationId: item.recommendationId ?? item.id,
      recommendationFamilyId: item.recommendationFamilyId ?? null,
      executionMode: item.executionContext?.executionMode ?? null,
      priorityState: item.priorityState ?? null,
    });
    trackProductEvent('execution_started', {
      recommendationId: item.recommendationId ?? item.id,
      recommendationFamilyId: item.recommendationFamilyId ?? null,
      executionMode: item.executionContext?.executionMode ?? null,
      priorityState: item.priorityState ?? null,
      ctaSource: 'today_plan_card',
    });
  };
  const closeInlineExecution = (completed: boolean) => {
    if (!inlineExecution) return;
    const latencyMs = Math.max(0, Date.now() - inlineExecution.openedAt);
    trackProductEvent('modal_closed', {
      recommendationId: inlineExecution.item.recommendationId ?? inlineExecution.item.id,
      recommendationFamilyId: inlineExecution.item.recommendationFamilyId ?? null,
      executionMode: inlineExecution.item.executionContext?.executionMode ?? null,
      priorityState: inlineExecution.item.priorityState ?? null,
      latencyMs,
      outcome: completed ? 'completed' : 'dismissed',
    });
    trackProductEvent(completed ? 'execution_completed' : 'execution_abandoned', {
      recommendationId: inlineExecution.item.recommendationId ?? inlineExecution.item.id,
      recommendationFamilyId: inlineExecution.item.recommendationFamilyId ?? null,
      executionMode: inlineExecution.item.executionContext?.executionMode ?? null,
      priorityState: inlineExecution.item.priorityState ?? null,
      latencyMs,
    });
    if (completed) {
      if (inlineExecution.item.kind === 'follow_up') {
        trackProductEvent('followup_sent', {
          recommendationId: inlineExecution.item.recommendationId ?? inlineExecution.item.id,
          recommendationFamilyId: inlineExecution.item.recommendationFamilyId ?? null,
          channel: inlineExecution.item.followUpContext?.recommendedChannel ?? null,
        });
      }
      trackProductEvent('recommendation_completed', {
        ctaSource: 'inline_execution_modal',
        recommendationId: inlineExecution.item.recommendationId ?? inlineExecution.item.id,
        recommendationFamilyId: inlineExecution.item.recommendationFamilyId ?? null,
        priorityState: inlineExecution.item.priorityState ?? null,
        completionLatencyMs: latencyMs,
      });
    } else if (inlineExecution.item.kind === 'follow_up') {
      trackProductEvent('followup_ignored', {
        recommendationId: inlineExecution.item.recommendationId ?? inlineExecution.item.id,
        recommendationFamilyId: inlineExecution.item.recommendationFamilyId ?? null,
      });
    }
    setInlineExecution(null);
  };

  return (
    <div
      data-tour="todays-plan"
      className="rounded-2xl border border-[rgba(0,201,177,0.25)] bg-[rgba(0,201,177,0.04)] p-6 sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles className="h-5 w-5 shrink-0 text-[#00C9B1]" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-white">Today&apos;s Plan</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-white/35">
              {refreshed ? <span>Updated {refreshed}</span> : null}
              {isFetching ? (
                <span className="inline-flex items-center gap-1 text-[#00C9B1]/80">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Updating
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRefresh()}
          disabled={isFetching}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 text-[13px] font-medium text-[#00C9B1] transition-opacity hover:underline disabled:opacity-60 sm:min-h-0"
        >
          <RotateCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden />
          Refresh plan
        </button>
      </div>

      {showResumeBanner && !suppressContinuation ? (
        <div className="mb-6 rounded-xl border border-[#00C9B1]/20 bg-[#00C9B1]/[0.06] p-4 sm:p-5">
          <p className="text-[12px] font-medium text-[#9CF5EA]/80">Pick up where you left off</p>
          <p className="mt-2 text-[15px] font-semibold leading-snug text-white">{resumeHeadline}</p>
          {resumeContextText ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">{resumeContextText}</p>
          ) : null}
          {resume.taskRationaleShort?.trim() ? (
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">{resume.taskRationaleShort.trim()}</p>
          ) : null}
          {continuationHref ? (
            <Link
              href={continuationHref}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/50 bg-[#00C9B1]/15 px-5 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1]/25"
              onClick={() => {
                if (!continuationCanDeepLink) {
                  trackProductEvent('stale_action_blocked', {
                    routeValidationReason: data.continuationState.routeValidationReason ?? null,
                    suggestedPriorityId: data.continuationState.suggestedPriorityId ?? null,
                    fallbackRoute: continuationHref,
                  });
                }
                trackProductEvent('continuation_resumed', {
                  route: continuationHref,
                  priorityId: resume.suggestedPriorityId ?? resume.lastMeaningfulAction?.priorityId ?? null,
                  resumeConfidence: resume.resumeConfidence ?? null,
                  routeValidated: resume.routeValidated ?? null,
                  routeValidationReason: resume.routeValidationReason ?? null,
                });
              }}
            >
              Continue
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      {dashboardVm && !dashboardVm.usesExperienceLayer && dashboardVm.informationalSurfaces.length > 0 ? (
        <section className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Dashboard insights">
          {dashboardVm.informationalSurfaces.map((surf, i) => (
            <div
              key={`${surf.category}-${i}`}
              className={cn(
                'rounded-xl border p-4 sm:p-5',
                surf.visualWeight === 'quiet'
                  ? 'border-white/[0.06] bg-white/[0.02]'
                  : 'border-white/[0.08] bg-white/[0.04]',
              )}
            >
              {surf.headline ? (
                <p className="text-[14px] font-semibold leading-snug text-white/88">
                  {safeHumanText(surf.headline) ?? stripTechnicalTokens(surf.headline)}
                </p>
              ) : null}
              {surf.body ? (
                <p
                  className={cn(
                    'text-[13px] leading-relaxed text-white/58',
                    surf.headline ? 'mt-1.5' : '',
                  )}
                >
                  {safeHumanText(surf.body) ?? stripTechnicalTokens(surf.body)}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="mb-7">
        {showCompletionTag ? (
          <p
            className={cn(
              'mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200',
              showSuccessPulse && 'animate-pulse',
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Action completed.
          </p>
        ) : null}
        <p className="mb-2 text-[12px] font-medium text-white/55">
          {todayActionsLeft > 0
            ? missionLead
            : currentCount > 0
              ? `Daily goal complete. ${currentCount} ${currentCount === 1 ? 'priority remains' : 'priorities remain'}. Your next focus is highlighted below.`
              : completionRewardCopySafe
                ? completionRewardCopySafe
                : data.progress.actionsCompletedToday > 0
                  ? `You completed ${data.progress.actionsCompletedToday} action${data.progress.actionsCompletedToday === 1 ? '' : 's'} today.`
                  : data.dailyMission.hiddenReasonIfNone === 'all_done'
                    ? 'All meaningful actions are complete for now.'
                    : 'No priority actions pending right now.'}
        </p>
        {missionImpactLabelSafe ? (
          <p className="mb-2 text-[11px] font-medium text-white/40">{missionImpactLabelSafe}</p>
        ) : null}
        {!dashboardVm?.usesExperienceLayer &&
        !showMission &&
        !hasTopPriorityCards &&
        data.continuationState.taskRationaleShort &&
        !showResumeBanner ? (
          <p
            className={cn(
              'mb-2 text-[11px]',
              data.continuationState.taskLabelQuality === 'heuristic' ? 'text-amber-100/70' : 'text-amber-100/85',
            )}
          >
            {data.continuationState.taskRationaleShort}
          </p>
        ) : null}
        {(() => {
          const showFresh = newCount > 0;
          const showProgress = currentCount > 0;
          const bothZero = !showFresh && !showProgress;
          const quietLine = safeHumanText(data.unifiedPriorities.summary.quietDashboardHint ?? null);
          const neutralQuiet =
            "You're caught up on counts for now — we'll surface what's new when it matters.";
          if (bothZero) {
            return (
              <p className="mb-2 text-[12px] leading-relaxed text-white/42">{quietLine ?? neutralQuiet}</p>
            );
          }
          const snapshotHint = (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-[#00C9B1]" aria-hidden />
              Activity snapshot
              <InfoHint
                text={`${moreSignalsText}${
                  data.reentrySummary.newStrongMatchesCount > 0 || data.reentrySummary.nearCompletionCount > 0
                    ? `. Since your last visit: ${data.reentrySummary.newStrongMatchesCount} strong match${
                        data.reentrySummary.newStrongMatchesCount === 1 ? '' : 'es'
                      } and ${data.reentrySummary.nearCompletionCount} almost-finished task${
                        data.reentrySummary.nearCompletionCount === 1 ? '' : 's'
                      }.`
                    : ''
                }`}
                buttonClassName="text-fuchsia-300/90 hover:text-fuchsia-200 focus:ring-fuchsia-400/45 drop-shadow-[0_0_8px_rgba(232,121,249,0.35)]"
              />
            </span>
          );
          return (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-white/48">
              {showFresh ? (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5 text-[#00C9B1]" aria-hidden />
                  {newCount} new since last visit
                </span>
              ) : null}
              {showFresh && showProgress ? (
                <span className="text-white/15" aria-hidden>
                  ·
                </span>
              ) : null}
              {showProgress ? (
                <span className="inline-flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5 text-[#00C9B1]" aria-hidden />
                  {currentCount} in motion
                </span>
              ) : null}
              {showFresh || showProgress ? (
                <span className="text-white/15" aria-hidden>
                  ·
                </span>
              ) : null}
              {snapshotHint}
            </div>
          );
        })()}
      </section>

      {sortedPriorities.length > 0 ? (
        <section className="mb-8">
          <p className="mb-3 text-[13px] font-medium text-white/55">What to do next</p>
          <div className="space-y-3">
            {displayedTopPriorities.map((it, idx) => (
              <div
                key={it.id}
                className="transition-[opacity,transform] duration-200 motion-reduce:transition-none"
                {...(idx === 0 ? { 'data-tour': 'todays-plan-primary' } : {})}
              >
                <UnifiedPriorityCard
                  item={it}
                  defaultCvProfileId={defaultCvProfileId}
                  emphasized={effectivePrimaryId ? it.id === effectivePrimaryId : recommendedIds.has(it.id)}
                  orchestratedRow={getOrchestratedRowForItem(data, it)}
                  knownApplicationIds={knownApplicationIds}
                  knownAnalysisIds={knownAnalysisIds}
                  jobHistoryByAnalysisId={jobHistoryByAnalysisId}
                  jobHistoryByListingId={jobHistoryByListingId}
                  tourDataAttr={
                    !cvClinicEffective && firstCvFixPriorityId === it.id ? 'cv-clinic-section' : undefined
                  }
                  onInvalidNavigate={() => {
                    trackProductEvent('stale_action_blocked', {
                      priorityId: it.id,
                      kind: it.kind,
                    });
                    trackProductEvent('recommendation_dismissed', {
                      ctaSource: 'today_plan_card',
                      priorityId: it.id,
                      recommendationId: it.recommendationId ?? it.id,
                      recommendationFamilyId: it.recommendationFamilyId ?? null,
                      priorityState: it.priorityState ?? null,
                      generationReason: it.generationReason ?? null,
                    });
                    toast.info('This item was already resolved. We refreshed your next actions.');
                    onRefresh();
                  }}
                  onInlineExecute={handleInlineExecute}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {inlineExecution ? (
        <InlineExecutionModal
          item={inlineExecution.item}
          href={inlineExecution.href}
          onClose={() => closeInlineExecution(false)}
          onComplete={() => closeInlineExecution(true)}
        />
      ) : null}

      {nextStepEffective ? (
        <section className="mb-8">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">Next up</p>
          <PlanInnerCard
            item={nextStepEffective}
            icon={Rocket}
            defaultCvProfileId={defaultCvProfileId}
            {...orchPlanCanon(nextStepEffective.id)}
          />
        </section>
      ) : null}

      {data.unifiedPriorities.items.length === 0 && todaysFocusFiltered.length > 0 ? (
        <section className="mb-8">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">
            Today&apos;s focus
          </p>
          <div className="space-y-3">
            {todaysFocusFiltered.map((it) => (
              <PlanInnerCard
                key={it.id}
                item={it}
                icon={ClipboardList}
                defaultCvProfileId={defaultCvProfileId}
                {...orchPlanCanon(it.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.unifiedPriorities.items.length === 0 && needsAttentionFiltered.length > 0 ? (
        <section className="mb-8">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-amber-200/55">
            Needs attention
          </p>
          <div className="space-y-3">
            {needsAttentionFiltered.map((it) => (
              <PlanInnerCard
                key={it.id}
                item={it}
                icon={AlertTriangle}
                defaultCvProfileId={defaultCvProfileId}
                {...orchPlanCanon(it.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {cvClinicEffective ? (
        <section className="mb-8">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">CV Clinic</p>
          <div data-tour="cv-clinic-section">
            <PlanInnerCard
              item={cvClinicEffective}
              icon={Stethoscope}
              defaultCvProfileId={defaultCvProfileId}
              {...orchPlanCanon(cvClinicEffective.id)}
            />
          </div>
        </section>
      ) : null}

      {shouldRenderSection('history', data) && continuationsFiltered.length > 0 && !suppressContinuation ? (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">
              Pick up where you left off
            </p>
            {data.recentAnalysesContinuations.length > 3 ? (
              <Link href="/dashboard/jobs" className="text-[13px] font-medium text-[#00C9B1] hover:underline">
                View all →
              </Link>
            ) : null}
          </div>
          <div className="space-y-3">
            {continuationsFiltered.map((it) => (
              <PlanInnerCard
                key={it.id}
                item={it}
                icon={ClipboardList}
                defaultCvProfileId={defaultCvProfileId}
                {...orchPlanCanon(it.id)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
