import type { QueryClient } from '@tanstack/react-query';

import {
  isSemanticOutlookBand,
  isTimelineOutlookBand,
  type SemanticOutlookPayload,
  type SemanticOutlookBand,
  type TimelineOutlookBand,
} from '@/lib/dashboardSemanticOutlook';
import { pickCompanyLogoUrl } from '@/lib/companyLogo';
import { normalizeDashboardRoute } from '@/lib/dashboardCanonicalRoutes';
import { queryKeys } from '@/lib/queryKeys';

/** Root segment for React Query keys — use with `invalidateTodayPlanQueries`. */
export const TODAY_PLAN_QUERY_ROOT = queryKeys.todayPlan.root()[0];

/** GET /dashboard/focus — ranked focus feed (invalidate with today-plan when priorities change). */
export const DASHBOARD_FOCUS_QUERY_ROOT = queryKeys.dashboardFocus.root()[0];

export function todayPlanQueryKey(params: {
  cvProfileId?: string | null;
  timezone: string;
  /** QA: matches `?includeHiddenDashboardCards=true` on GET /dashboard/today-plan */
  includeHiddenDashboardCards?: boolean;
  /** Optional cap for focus feed length (1–100). */
  focusFeedMaxItems?: number;
}) {
  const cv = (params.cvProfileId ?? '').trim() || 'default';
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  const includeHidden = params.includeHiddenDashboardCards === true;
  const ffm =
    typeof params.focusFeedMaxItems === 'number' &&
    Number.isFinite(params.focusFeedMaxItems) &&
    params.focusFeedMaxItems >= 1 &&
    params.focusFeedMaxItems <= 100
      ? Math.round(params.focusFeedMaxItems)
      : null;
  return queryKeys.todayPlan.key(cv, tz, includeHidden, ffm ?? 'default');
}

export function dashboardFocusQueryKey(params: { cvProfileId?: string | null; timezone: string }) {
  const cv = (params.cvProfileId ?? '').trim() || 'default';
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  return queryKeys.dashboardFocus.key(cv, tz);
}

export function dashboardInterviewPrepQueryKey(params: {
  cvProfileId?: string | null;
  timezone: string;
  focusFeedMaxItems?: number;
}) {
  const cv = (params.cvProfileId ?? '').trim() || 'default';
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  const ffm =
    typeof params.focusFeedMaxItems === 'number' &&
    Number.isFinite(params.focusFeedMaxItems) &&
    params.focusFeedMaxItems >= 1 &&
    params.focusFeedMaxItems <= 100
      ? Math.round(params.focusFeedMaxItems)
      : 'default';
  return queryKeys.dashboardInterviewPrep.key(cv, tz, ffm);
}

export function dashboardFollowUpJobsQueryKey(params: {
  cvProfileId?: string | null;
  timezone: string;
  focusFeedMaxItems?: number;
}) {
  const cv = (params.cvProfileId ?? '').trim() || 'default';
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  const ffm =
    typeof params.focusFeedMaxItems === 'number' &&
    Number.isFinite(params.focusFeedMaxItems) &&
    params.focusFeedMaxItems >= 1 &&
    params.focusFeedMaxItems <= 100
      ? Math.round(params.focusFeedMaxItems)
      : 'default';
  return queryKeys.dashboardFollowUpJobs.key(cv, tz, ffm);
}

export function dashboardQuietApplicationsQueryKey(params: {
  cvProfileId?: string | null;
  timezone: string;
  focusFeedMaxItems?: number;
}) {
  const cv = (params.cvProfileId ?? '').trim() || 'default';
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  const ffm =
    typeof params.focusFeedMaxItems === 'number' &&
    Number.isFinite(params.focusFeedMaxItems) &&
    params.focusFeedMaxItems >= 1 &&
    params.focusFeedMaxItems <= 100
      ? Math.round(params.focusFeedMaxItems)
      : 'default';
  return queryKeys.dashboardQuietApplications.key(cv, tz, ffm);
}

export function invalidateTodayPlanQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.todayPlan.root() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardFocus.root() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardQuietApplications.root() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardInterviewPrep.root() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardFollowUpJobs.root() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyStallSummary.root() });
}

/** CTA from `GET /dashboard/today-plan` (backend-driven). */
export type TodayPlanCta = {
  label: string;
  /** When set, client navigates here directly. */
  href?: string;
  /** Structured action payload; `type` discriminates routing when `href` is absent. */
  action: Record<string, unknown>;
};

export type TodayPlanItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  rationale?: string | null;
  reasonCodes: string[];
  /**
   * Phase 6A: Clean, user-facing labels for CV clinic / nudges.
   * When present, prefer these over `reasonCodes` for display.
   */
  statusLabel?: string | null;
  tagLabel?: string | null;
  priority?: number;
  confidence?: number | null;
  cta: TodayPlanCta;
  /** Top matches only — see backend catalog. */
  source?: string | null;
  matchScore?: number | null;
  company?: string | null;
  companyLogoUrl?: string | null;
  jobTitle?: string | null;
  locationStrategy?: 'local' | 'remote_fallback' | null;
  locationLabel?: string | null;
  postedAgeHours?: number | null;
  recommendationSource?: 'local' | 'remote_fallback' | null;
  recommendationLocation?: string | null;
  fallbackReason?: string | null;
  state?: string | null;
  isApplied?: boolean;
  /** Present on some legacy rows / top matches when backend sends structured routing hints */
  ctaHint?: string | null;
  journey?: { nextRoute?: string | null } | null;
};

export type UnifiedPriorityUrgencyBucket = 'now' | 'soon' | 'later';

export type UnifiedPriorityKind =
  | 'follow_up'
  | 'apply'
  | 'cv_fix'
  | 'analyze'
  | 'bookmark_review'
  | string;

export type UnifiedPriorityIds = {
  applicationId?: string | null;
  jobAnalysisId?: string | null;
  bookmarkId?: string | null;
  jobListingId?: string | null;
  hubReminderId?: string | null;
  jobId?: string | null;
  cvProfileId?: string | null;
};

/** Backend Phase 2A: calm momentum line + template family (styling only). */
export type MomentumType = 'progress' | 'continuation' | 'quick_win' | 'recovery' | 'confidence';

export type DashboardHeaderPayload = {
  momentumMessage: string | null;
  momentumType: MomentumType | null;
  dashboardMode: DashboardMode | null;
  recommendedSections: DashboardSectionKey[];
  actionContext: {
    type:
      | 'stalled_application'
      | 'unfinished_application'
      | 'interview_followup'
      | 'cv_issue'
      | 'tailoring_needed'
      | 'interview_prep';
    companyName: string | null;
    roleTitle: string | null;
    daysSinceActivity: number | null;
    expectedOutcome: string | null;
    suggestedAction: string | null;
    estimatedMinutes: number | null;
    deepLink: string | null;
    canonicalJobId: string | null;
    applicationId: string | null;
    cvProfileId: string | null;
    recommendationId: string | null;
    executionMode: 'inline_modal' | 'direct_editor' | 'checklist' | 'generator' | 'continue_flow' | null;
    canonicalRoute: string | null;
    fallbackRoute: string | null;
    resolutionState: 'resolved' | 'degraded' | 'missing_context' | null;
    surfaceOwnership: DashboardSurfaceOwnership | null;
    displayPriority: number | null;
    recommendationClusterId: string | null;
    suppressedBy: DashboardSurfaceOwnership | null;
    suppressionReason: string | null;
    executionPayload: {
      canonicalRoute: string | null;
      fallbackRoute: string | null;
      resolutionState: 'resolved' | 'degraded' | 'missing_context' | null;
      applicationId: string | null;
      canonicalJobId: string | null;
      cvProfileId: string | null;
    } | null;
  } | null;
};

/** Server-owned visual lane for a priority row (mutually exclusive when set). */
export type PriorityState =
  | 'quick_win'
  | 'ready_now'
  | 'continuation'
  | 'blocked'
  | 'high_impact'
  | 'waiting'
  | 'follow_up';

/** Phase 4.1 — canonical lifecycle for a recommendation row (server-owned). */
export type WorkflowState =
  | 'onboarding'
  | 'discovery'
  | 'analyzed'
  | 'applying'
  | 'applied'
  | 'followup'
  | 'interviewing'
  | 'offer'
  | 'archived'
  | 'stale'
  | string;

/** Dashboard orchestration v1 — backend-owned surfaces and canonical execution copy. */
export type ActionSemantics =
  | 'apply'
  | 'analyze'
  | 'follow_up'
  | 'interview_prep'
  | 'discovery'
  | 'cv_fix'
  | 'explore'
  | string;

export type AssignedSurface =
  | 'hero'
  | 'continuation'
  | 'top_priority'
  | 'secondary_priority'
  | 'momentum_nudge'
  | 'revisit'
  | 'hidden'
  | string;

/** Collapsed graph: one row per workflow entity (matches `unifiedPriorities.items[].id` via `recommendationId`). */
export type CanonicalRecommendation = {
  recommendationId: string | null;
  workflowEntityId: string | null;
  workflowEntityType: string | null;
  workflowState: WorkflowState | null;
  workflowStage: string | null;
  recommendationFamily: string | null;
  recommendationIntent: string | null;
  canonicalActionLabel: string | null;
  canonicalRoute: string | null;
  fallbackRoute: string | null;
  actionSemantics: ActionSemantics | null;
  priorityScore: number | null;
  urgency: string | null;
  surfaceEligibility: Record<string, unknown> | null;
};

export type OrchestratedRecommendation = CanonicalRecommendation & {
  assignedSurface: AssignedSurface | null;
  surfaceRank: number | null;
};

export type ContinuationHintPayload = {
  workflowEntityId: string | null;
  recommendationId: string | null;
  canonicalRoute: string | null;
  narrativeRole: string | null;
};

/** Single surface from `dashboardExperience.surfaces` (actionable vs passive intelligence). */
export type ExperienceSurfaceHierarchy = {
  visualImportance: string | null;
  urgency: string | null;
  emotionalTone: string | null;
  actionIntensity: string | null;
};

export type DashboardExperienceActionSurface = {
  kind: 'action';
  /** Stable surface id from orchestration when provided. */
  id: string | null;
  category: string;
  /** Backend-owned calm hierarchy token. */
  visualPriority: 'hero' | 'primary' | 'secondary' | 'quiet' | 'background' | string | null;
  recommendationId: string | null;
  /** Backend-provided explicit navigation route for this action surface. */
  actionRoute: string | null;
  narrativeTitle: string | null;
  narrativeSubtitle: string | null;
  hierarchy: ExperienceSurfaceHierarchy | null;
  orchestratorSurface: string | null;
  continuationContext: ContinuationContextPayload | null;
  freshnessConfidence: number | null;
  continuityConfidence: number | null;
  stabilityConfidence: number | null;
  confidence: SurfaceConfidencePayload | null;
};

export type DashboardExperienceInformationalSurface = {
  kind: 'informational';
  /** Stable surface id from orchestration (e.g. `exp-pipeline-snapshot`). */
  id: string | null;
  category: string;
  visualPriority: 'hero' | 'primary' | 'secondary' | 'quiet' | 'background' | string | null;
  insightCategory: string | null;
  headline: string | null;
  body: string | null;
  supportingMetric: unknown | null;
  freshnessConfidence: number | null;
  continuityConfidence: number | null;
  stabilityConfidence: number | null;
  confidence: SurfaceConfidencePayload | null;
};

export type DashboardExperienceSurface =
  | DashboardExperienceActionSurface
  | DashboardExperienceInformationalSurface;

export type DashboardExperienceNarrativeBlock = {
  /** Strategic mode drives pacing/section visibility (backend-owned). */
  mode: string | null;
  tone: string | null;
  hero: HeroNarrativePayload | null;
  heroStory: string | null;
  heroSubtitle: string | null;
  momentumCopy: string | null;
  narrativeTone: string | null;
  fatigueAdjusted: boolean | null;
};

export type HeroNarrativePayload = {
  primaryStatement: string | null;
  supportingReason: string | null;
  emotionalTone: string | null;
  expectedOutcome: string | null;
};

export type SurfaceConfidencePayload = {
  recommendationConfidence: number | null;
  routingConfidence: number | null;
  workflowConfidence: number | null;
  continuityConfidence: number | null;
};

export type ContinuationContextPayload = {
  taskLabel: string | null;
  detailedSummary: string | null;
  exactStepLabel: string | null;
  exactStepIndex: number | null;
  totalSteps: number | null;
  completionPercent: number | null;
  /** Job context when resuming interview prep (optional; backend-owned). */
  roleTitle: string | null;
  companyName: string | null;
};

/** Pipeline counts patched on response (e.g. new matches since visit). */
export type ExperiencePipelineSnapshot = {
  /** Allow backend to add new metrics without breaking parsing. */
  [key: string]: number | null;
  interviewing: number | null;
  waiting: number | null;
  followUpNeeded: number | null;
  newMatchesSinceVisit: number | null;
};

/** Backend dashboard intelligence layer (orchestration v2+). */
export type DashboardExperiencePayload = {
  version: number;
  narrative: DashboardExperienceNarrativeBlock;
  surfaces: DashboardExperienceSurface[];
  /** Ids in display order — use for priority list ordering. */
  visibleRecommendationIds: string[];
  /** Full orchestrator rows for visible recommendations (preferred when present). */
  visibleRecommendations: OrchestratedRecommendation[];
  suppressedRecommendationIds: string[];
  pipelineSnapshot: ExperiencePipelineSnapshot | null;
  fatigue: Record<string, unknown> | null;
};

export type DashboardNarrativePayload = {
  heroRecommendationId: string | null;
  continuationRecommendationId: string | null;
  arcLabel: string | null;
  /** Intelligence layer — primary hero copy (aligns with `dashboardExperience.narrative`). */
  heroStory: string | null;
  heroSubtitle: string | null;
  momentumCopy: string | null;
  narrativeTone: string | null;
  /** Legacy-compatible pointer for strategic mode (duplicate of experience narrative when present). */
  strategicMode: string | null;
};

/** Feed row from `unifiedPriorities.summary.workflowOrchestration` (debug / analytics). */
export type WorkflowOrchestrationFeedRow = {
  entityType: string | null;
  entityId: string | null;
  recommendationClusterId: string | null;
  primaryWorkflowState: WorkflowState | null;
  owningRecommendationId: string | null;
  /** e.g. hero | continuation | priority_queue | nudge | revisit | onboarding */
  primarySurfaceOwner: string | null;
};

/** Backend effort readiness band for apply paths (additive). */
export type ApplyAssistReadyState =
  | 'ready'
  | 'needs_cv_tailoring'
  | 'needs_contact_details'
  | 'needs_portfolio_link'
  | 'needs_analysis_review'
  | 'blocked'
  | string;

export type UnifiedPriorityItem = {
  id: string;
  priorityScore: number;
  urgencyBucket: UnifiedPriorityUrgencyBucket;
  kind: UnifiedPriorityKind;
  title: string;
  subtitle: string | null;
  reasonCodes: string[];
  reasonText: string | null;
  whyNowShort: string | null;
  compactDisplay: {
    primaryLine: string;
    actionLabel: string;
    actionType: string;
  } | null;
  explain: {
    short: string;
    factors: string[];
    confidence: number | null;
  } | null;
  applyAssist: {
    suggestedNextStep: string;
    /** Prefer backend `estimatedSteps` when present; mirrors steps remaining when omitted. */
    estimatedSteps: number;
    estimatedStepsRemaining: number;
    estimatedMinutesToApply: number | null;
    blockerSeverity: 'none' | 'low' | 'high' | null;
    fastPathEligible: boolean;
    fastPathRoute: string | null;
    noEditsNeeded: boolean;
    primaryActionLabel: string | null;
    /** Higher = more friction (0–100). */
    frictionScore: number | null;
    /** How likely the user can finish soon (0–100). */
    completionLikelihood: number | null;
    blockers: string[];
    readyState: ApplyAssistReadyState | null;
  } | null;
  prefill: {
    selectedCvId: string | null;
    tailoredCvDraftId: string | null;
    coverLetterDraftId: string | null;
    sourceContext: string | null;
  } | null;
  resumeState: {
    entityIds: string[];
    workingStep: string | null;
    filtersContext: string | null;
    lastUpdatedAt: string | null;
    ttlMinutes: number;
  } | null;
  stateSnapshot: {
    sourceState: string | null;
    sourceUpdatedAt: string | null;
    computedAt: string | null;
    staleRisk: boolean;
  } | null;
  microcopy: string | null;
  outcomeCopy: string | null;
  nextActionPreview: {
    kind: string | null;
    route: string | null;
    estimatedReadyMs: number | null;
  } | null;
  outcomeFraming: {
    primaryBenefit: string | null;
    secondaryBenefit: string | null;
  } | null;
  journey: {
    nextRoute: string;
    returnRoute: string | null;
    contextToken: string | null;
  } | null;
  ctaHint: string | null;
  isNewSinceLastVisit: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  locationStrategy: 'local' | 'remote_fallback' | null;
  locationLabel: string | null;
  postedAgeHours: number | null;
  recommendationSource: 'local' | 'remote_fallback' | null;
  recommendationLocation: string | null;
  fallbackReason: string | null;
  dedupeGroupKey: string | null;
  /** Stable grouping key from backend (dedupe / suppression). */
  recommendationFamilyId: string | null;
  /** Backend Phase 1: trust signal (0–100). */
  confidenceScore: number | null;
  confidenceReason: string | null;
  estimatedOutcome: string | null;
  expectedImpactLevel: 'low' | 'medium' | 'high' | null;
  /** Diagnostics when backend rewrites row (optional badge, not primary marketing copy). */
  suppressionReason: string | null;
  surfaceOwnership: DashboardSurfaceOwnership | null;
  displayPriority: number | null;
  recommendationClusterId: string | null;
  suppressedBy: DashboardSurfaceOwnership | null;
  /** Phase 4.1 — prefer for badges and tone when set (do not infer lifecycle only from kind). */
  workflowState: WorkflowState | null;
  /** Stable key e.g. `application:<uuid>` for analytics / dedupe alignment. */
  workflowEntityKey: string | null;
  /** Orchestration v1 — same id as `recommendationGraph[].workflowEntityId` when provided. */
  workflowEntityId: string | null;
  roleTitle: string | null;
  roleCompany: string | null;
  roleLabel: string | null;
  interviewPrepContext: {
    jobAnalysisId: string | null;
    jobTitle: string | null;
    company: string | null;
    cvProfileId: string | null;
    preferredCvProfileId: string | null;
    analyzedCvProfileId: string | null;
    tailoringCvProfileId: string | null;
    likelyTopics: string[];
    likelyQuestions: string[];
    preparationChecklist: string[];
    missingSignals: string[];
    suggestedStories: string[];
    estimatedPrepMinutes: number | null;
    /** Backend: prep can hydrate without client guessing CV/session context. */
    hydrationReady: boolean | null;
    /** Resolved CV for this prep flow (prefer over defaults when present). */
    selectedCvProfileId: string | null;
  } | null;
  executionContext: {
    nextImmediateAction: string | null;
    estimatedMinutes: number | null;
    emotionalBenefit: string | null;
    executionMode: 'inline_modal' | 'direct_editor' | 'checklist' | 'generator' | 'continue_flow' | null;
    deepLink: string | null;
    canExecuteInline: boolean;
    preparedDraft: string | null;
    suggestedTone: 'confident' | 'professional' | 'warm' | 'concise' | null;
    estimatedSuccessLikelihood: number | null;
    preparationChecklist: string[];
    suggestedTalkingPoints: string[];
    quickActions: string[];
    fallbackAction: string | null;
    canonicalJobId: string | null;
    applicationId: string | null;
    cvProfileId: string | null;
    recommendationId: string | null;
    executionType: string | null;
    canonicalRoute: string | null;
    fallbackRoute: string | null;
    resolutionState: 'resolved' | 'degraded' | 'missing_context' | null;
  } | null;
  executionPayload?: {
    executionId: string | null;
    executionType: string | null;
    canonicalRoute: string | null;
    fallbackRoute: string | null;
    entityType: string | null;
    entityId: string | null;
    applicationId: string | null;
    jobId: string | null;
    jobAnalysisId: string | null;
    cvProfileId: string | null;
    preferredCvProfileId: string | null;
    tailoringCvProfileId: string | null;
    analyzedCvProfileId: string | null;
    recommendationState: string | null;
    resolutionState: 'resolved' | 'degraded' | 'missing_context' | null;
  } | null;
  recommendationState?: string | null;
  followUpContext: {
    suggested: boolean;
    daysSinceLastActivity: number | null;
    confidence: number | null;
    recommendedChannel: 'email' | 'in_app' | 'manual_note' | null;
    draftMessage: string | null;
    suggestedTone: 'confident' | 'professional' | 'warm' | 'concise' | null;
    recoveryLikelihood: number | null;
    recommendedSendWindow: string | null;
    rationaleShort: string | null;
  } | null;
  cvFixContext: {
    affectedSection: string | null;
    suggestedPatch: string | null;
    expectedImpact: string | null;
    confidenceReason: string | null;
  } | null;
  qualitySignals: {
    urgency: 'low' | 'medium' | 'high' | null;
    reversibility: 'easy' | 'moderate' | 'hard' | null;
    momentumImpact: 'low' | 'medium' | 'high' | null;
    estimatedUserEffort: 'low' | 'medium' | 'high' | null;
    confidenceTier: 'low' | 'medium' | 'high' | null;
  } | null;
  reasonShort: string | null;
  reasonDetailed: string | null;
  recommendationId: string | null;
  generationReason: string | null;
  priorityState: PriorityState | null;
  actionReassurance: string | null;
  ids: UnifiedPriorityIds;
  cta: TodayPlanCta;
};

export type UnifiedPrioritiesSummary = {
  highPriorityCount: number;
  followUpDueCount: number;
  newOpportunitiesCount: number;
  currentRecommendationsCount: number;
  newRecommendationsCount: number;
  carryOverRecommendationsCount: number;
  localRecommendationsCount: number;
  remoteFallbackRecommendationsCount: number;
  dedupeDroppedCount: number;
  /** Distinct recommendation families after dedupe (diagnostics / QA). */
  suppressionFamilyCount: number;
  recommendationQuality: {
    localQualifiedCount: number;
    localRejectedLowQualityCount: number;
    remotePromotedCount: number;
    thresholdUsed: number;
  } | null;
  /** Phase 4.1 — optional orchestration feed for debugging / funnel diagnostics. */
  workflowOrchestration: WorkflowOrchestrationFeedRow[];
  /**
   * When the dashboard would feel empty (all zeros / nothing new), backend-provided calm copy.
   * Prefer over flashing “0” metrics in the UI.
   */
  quietDashboardHint: string | null;
};

export type UnifiedPrioritiesPayload = {
  items: UnifiedPriorityItem[];
  summary: UnifiedPrioritiesSummary;
};

export type SinceLastVisitPayload = {
  lastSeenAt: string | null;
  newJobsCount: number;
  newHighMatchCount: number;
  newStalledCount: number;
  statusChangedCount: number;
  newRecommendationsCount: number;
};

export type ProgressPayload = {
  actionsCompletedToday: number;
  actionsCompletedWeek: number;
  applicationsSubmittedWeek: number;
  followUpsSentWeek: number;
  pipelineAdvancedWeek: number;
};

export type DailyMissionPayload = {
  targetActionsToday: number;
  actionsRemainingToday: number;
  recommendedPriorityIds: string[];
  primaryPriorityId: string | null;
  isMeaningful: boolean;
  estimatedMinutes: number | null;
  hiddenReasonIfNone: 'no_meaningful_action' | 'all_done' | 'insufficient_data' | null;
  impactLabel: string | null;
  completionRewardCopy: string | null;
  progressContext: string | null;
};

export type ContinuationStatePayload = {
  hasNew: boolean;
  message: string | null;
  suggestedPriorityId: string | null;
  specificTaskLabel: string | null;
  taskDisplayTitle: string | null;
  resolvedRoute: string | null;
  routeValidated: boolean | null;
  routeValidationReason: 'ok' | 'missing_job' | 'missing_application' | 'inaccessible' | null;
  taskLabelQuality: 'specific' | 'heuristic' | null;
  taskRationaleShort: string | null;
  remainingSteps: number | null;
  interruptionAgeHours: number | null;
  resumeConfidence: number | null;
  lastMeaningfulAction: {
    priorityId: string;
    kind: string | null;
    title: string | null;
    ctaHint: string | null;
  } | null;
  consistency: {
    source: 'unified_priority' | 'none' | null;
    selectedPriorityId: string | null;
    selectedRoute: string | null;
    idFoundInUnified: boolean;
    routeMatchedUnified: boolean;
    mismatchReason: 'no_unified_items' | 'id_missing' | 'route_mismatch' | null;
  } | null;
  estimatedMinutesLeft: number | null;
  urgencyLabel: string | null;
};

export type ReentrySummaryPayload = {
  newStrongMatchesCount: number;
  nearCompletionCount: number;
  stalledButRecoverableCount: number;
  topReasonsToReturn: string[];
};

/** Keys lowercased at parse time (e.g. `search_at_a_glance` → `"Search at a Glance"`). */
export type NormalizedSectionTitlesPayload = Readonly<Record<string, string>>;

/** Phase 15 — top command line from GET /dashboard/today-plan (backend-resolved CTA). */
export type DashboardCommandBarSource =
  | 'priority_intelligence'
  | 'follow_up_intelligence'
  | 'cv_clinic'
  | 'opportunity_detection'
  | 'continuation';

export type DashboardCommandBarPayload = {
  message: string;
  ctaLabel: string;
  ctaHref: string;
  /** 0–100 */
  confidence: number;
  source: DashboardCommandBarSource;
};

/** Phase 17A — one unfinished execution session in the continuation queue. */
export type DashboardContinuationItemPayload = {
  id: string;
  type: 'cv' | 'analysis' | 'application' | 'interview' | 'cover_letter' | 'follow_up';
  title: string;
  subtitle?: string | null;
  description: string;
  lastActiveLabel?: string | null;
  /** ISO timestamp for sorting (optional). */
  lastActiveAt?: string | null;
  /** 0–100 */
  confidence?: number | null;
  estimatedMinutes?: number | null;
  ctaLabel: string;
  ctaHref: string;
  /** Execution continuity step (e.g. `evaluation_processing`, `results_ready`). */
  stepKey?: string | null;
  /** Interview eval continuity from backend `resumeState`. */
  interviewResumeState?: {
    evaluationStatus: string | null;
    resultsPath: string | null;
  } | null;
};

/** Alias for backend handoff naming. */
export type ContinuationItem = DashboardContinuationItemPayload;

/** Phase 17A — per-job interview prep row from today-plan. */
export type InterviewPreparationCardPayload = {
  headline: string;
  supporting: string;
  ctaLabel: string;
  ctaHref: string;
  applicationId?: string | null;
  jobAnalysisId?: string | null;
  company?: string | null;
  companyLogoUrl?: string | null;
  roleTitle?: string | null;
};

/**
 * GET …/today-plan `upcomingInterviews[]` item — backend emits `jobAnalysisId` (plus optional `applicationId`, `id`).
 * {@link pickUpcomingInterviewCard} accepts analysis id from `jobAnalysisId` or legacy `id`-only rows.
 */
export type UpcomingInterviewItem = {
  /** `jobAnalysisId` when present (matches emitted rows); fallback for legacy reads. */
  id: string;
  headline: string;
  supporting: string;
  company: string | null;
  companyLogoUrl?: string | null;
  jobTitle: string | null;
  jobAnalysisId: string;
  /** e.g. `applied_prep`, `technical_interview`, `phone_screen` */
  stage: string | null;
  interviewDate: string | null;
  daysUntilInterview: number | null;
  confidence: number | null;
  ctaLabel: string;
  ctaHref: string;
  lastUpdatedAt: string | null;
  lastUpdatedLabel?: string | null;
};

/** @deprecated Use {@link UpcomingInterviewItem}; kept for existing imports. */
export type UpcomingInterviewCardPayload = UpcomingInterviewItem;

/** Phase 15 — career momentum tile (`dashboardVitals.careerMomentum`). */
export type DashboardCareerMomentumVitalPayload = {
  /** 0–100 */
  score: number;
  /** Supporting copy (may be narrative); not the tile title. */
  label: string;
  /** Tier / band label from backend (e.g. Steady). */
  status?: string | null;
  /** Verbatim score explanation for tooltips (optional). */
  explanation?: string | null;
  /** Reserved; optional trend delta when backend populates it. */
  trend?: number | null;
};

/** Phase 15 — interview outlook tile (`dashboardVitals.interviewOutlook`). */
export type DashboardInterviewOutlookVitalPayload = {
  value: SemanticOutlookBand;
  label: string;
  outlookBasis?: string | null;
  disclaimer?: string | null;
  explanation?: string | null;
};

/** Phase 15 — best role fit tile (`dashboardVitals.bestMatch`). */
export type DashboardBestMatchVitalPayload = {
  /** 0–100 */
  score: number;
  label: string;
  company?: string | null;
  explanation?: string | null;
};

/** Phase 15 — active applications tile (`dashboardVitals.activeApplications`). */
export type DashboardActiveApplicationsVitalPayload = {
  /** ≥ 0 */
  count: number;
  label: string;
  explanation?: string | null;
};

/** Phase 15 — streak tile (`dashboardVitals.streak`). */
export type DashboardStreakVitalPayload = {
  /** ≥ 0 */
  days: number;
  label: string;
  explanation?: string | null;
};

/** Phase 15 — five headline vitals; each slot optional; camelCase on the wire. */
export type DashboardVitalsPayload = {
  careerMomentum?: DashboardCareerMomentumVitalPayload | null;
  interviewOutlook?: DashboardInterviewOutlookVitalPayload | null;
  bestMatch?: DashboardBestMatchVitalPayload | null;
  activeApplications?: DashboardActiveApplicationsVitalPayload | null;
  streak?: DashboardStreakVitalPayload | null;
};

export type FocusItemTypePhase15 =
  | 'interview'
  | 'follow_up'
  | 'cv'
  | 'opportunity'
  | 'continuation'
  | 'revisit'
  | 'goal_alignment';

export type DashboardFocusItemPayload = {
  id: string;
  type: FocusItemTypePhase15;
  /** Lower = higher priority (authoritative sort). */
  priority: number;
  /** Accent / dot color only; priority field defines order. */
  urgency: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  /** When the CTA path omits a query, backend may still send the analysis id here. */
  jobAnalysisId?: string | null;
  confidence?: number;
  estimatedMinutes?: number;
  dueInDays?: number;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
};

/** Quiet application row — 21+ days without employer reply (server-owned queue). */
export type DashboardStaleApplicationItemPayload = {
  id: string;
  applicationId: string;
  jobAnalysisId?: string | null;
  jobTitle: string;
  company: string;
  companyLogoUrl?: string | null;
  lastActivityAt: string;
  lastActivityLabel: string;
  daysSinceActivity: number;
  headline: string;
  supporting: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
  priority: number;
  /** ISO apply anchor used for quiet eligibility (debug / transparency). */
  quietEligibilityAnchorAt?: string | null;
  quietEligibilityReason?: string | null;
};

export type StaleApplicationNoticePayload = {
  show: boolean;
  daysSinceActivity: number;
  headline: string;
  supporting: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
};

export type DashboardEmptyStatePayload = {
  message: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

/** Keys are lower_snake_case section ids (e.g. `career_momentum`, `predictive_outlook`). */
export type DashboardEmptyStatesPayload = Readonly<Record<string, DashboardEmptyStatePayload>>;

export type TodayPlanPayload = {
  generatedAt: string;
  digestVersion: string;
  /** Stable execution experience session id (backend-owned). */
  experienceSessionId: string | null;
  /** Stable revision counter for session snapshot (backend-owned). */
  experienceRevision: number | null;
  /** True when a real execution session is active (backend-owned). */
  activeExecutionSession: boolean;
  /** Current workflow progress snapshot for execution workspace (backend-owned). */
  workflowProgress: WorkflowProgressPayload | null;
  /** Copilot state: deterministic, backend-owned (render; don't infer). */
  assistantState: AssistantStatePayload | null;
  /** Deterministic, short memory line for the dashboard header. */
  memorySummary: string | null;
  /** Phase 3: stable slug for styling (e.g. calm_progress, gentle_nudge). Not raw orchestration. */
  assistantTone: string | null;
  /** Phase 3: primary assistant-authored hero messaging. */
  assistantNarrative: AssistantNarrativePayload | null;
  /** Phase 5A: Opportunity Detection recommendation (backend-authored; optional). */
  opportunityDetection: OpportunityDetectionPayload | null;
  /** Phase 5B: Follow-up intelligence coaching card (backend-authored; optional). */
  followUpIntelligence: FollowUpIntelligencePayload | null;
  /** Follow-up queue (capped, e.g. 50 rows); optional companion to {@link followUpIntelligence}. */
  followUpJobs: FollowUpJobRowPayload[];
  /** Total queue size before cap; for “View all (N)” / truncation copy. */
  followUpJobsTotalCount: number | null;
  /**
   * Deep link for “View all” follow-up queue (e.g. `/dashboard/follow-up-jobs`).
   * Present when the backend wants the hub list UX for queued follow-ups.
   */
  followUpJobsViewAllHref: string | null;
  /** Phase 8: Single prioritized adaptive coaching CTA (backend-authored; optional). */
  adaptiveCoaching: AdaptiveCoachingPayload | null;
  /** Phase 10: Cross-cutting strategic “best move” recommendation (backend-authored; optional). */
  strategicRecommendation: StrategicRecommendationPayload | null;
  /** Phase 21: Primary “recommended move” card (backend-authored; optional). */
  recommendedMove: RecommendedMovePayload | null;
  /** Phase 11: Merged career goal snapshot (backend-authored; optional). */
  careerGoalProfile: CareerGoalProfilePayload | null;
  /** Phase 11: Pipeline vs goal alignment (backend-authored; optional). */
  goalAlignment: GoalAlignmentPayload | null;
  /** Phase 12: Goal-grounded strategic coaching card (backend-authored; optional). Distinct from {@link strategicCoaching}. */
  goalStrategicCoaching: GoalStrategicCoachingPayload | null;
  /** Phase 9: Streak + consistency meter (backend-authored; optional). */
  habitProgress: HabitProgressPayload | null;
  /**
   * Phase 9: Earned badges when habit bundle succeeds (`null` = bundle omitted).
   * Empty array means no badges yet.
   */
  achievements: TodayPlanAchievementPayload[] | null;
  /** Phase 21: Gamified career achievements (optional; falls back to {@link achievements}). */
  careerAchievements: CareerAchievementsPayload | null;
  /** Phase 9: Same-day milestone celebration (backend-authored; optional). */
  milestoneCelebration: MilestoneCelebrationPayload | null;
  /** Phase 5C: Strategic coaching recommendation (backend-authored; optional). */
  strategicCoaching: StrategicCoachingPayload | null;
  /** Phase 5D: Career momentum score + narrative (backend-authored; optional). */
  careerMomentum: CareerMomentumPayload | null;
  /** Phase 5E: Weekly strategic briefing (backend-authored; optional). */
  weeklyBriefing: WeeklyBriefingPayload | null;
  /** Phase 6A: Predictive outlook indexes + funnel health (backend-authored; optional). */
  predictiveOutlook: PredictiveOutlookPayload | null;
  /** Phase 6D: Strategic weekly behavioral coaching (backend-authored; optional). */
  strategicWeeklyCoaching: StrategicWeeklyCoachingPayload | null;
  emotionalSummary: EmotionalSummaryPayload | null;
  /** One-line daily framing (often mirrored into memorySummary). */
  dailyNarrativeSummary: string | null;
  narrativeProgression: string | null;
  assistantReasoning: AssistantReasoningPayload | null;
  assistantGuidance: AssistantGuidancePayload | null;
  humanizedLabels: HumanizedLabelsPayload | null;
  /** Coaching personalization — leverage + copy overrides for hero (backend-generated). */
  personalizationContext: PersonalizationContextPayload | null;
  personalizedHeadline: string | null;
  personalizedSupporting: string | null;
  personalizedWhyItMatters: string | null;
  personalizedNextBestAction: string | null;
  /** 14d deterministic signal counts (render only). */
  behaviorSignals: Record<string, number> | null;
  /** Deterministic explanation of adaptive behavior. */
  adaptiveReasoning: AdaptiveReasoningPayload[];
  /** Hero pinning window (backend-owned). */
  heroStability: HeroStabilityPayload | null;
  /** Experience stability/commit state (backend-owned). */
  experienceState: ExperienceStatePayload | null;
  /** Reserved for later; never required to render. */
  dashboardNarrativeInput: Record<string, unknown> | null;
  /** Optional; use for hero subtext + tone, never for routing logic. */
  dashboardHeader: DashboardHeaderPayload | null;
  cvProfileId?: string | null;
  nextStep: TodayPlanItem | null;
  todaysFocus: TodayPlanItem[];
  topMatches: TodayPlanItem[];
  needsAttention: TodayPlanItem[];
  cvClinicNudge: TodayPlanItem | null;
  recentAnalysesContinuations: TodayPlanItem[];
  freshness: Record<string, unknown> | null;
  unifiedPriorities: UnifiedPrioritiesPayload;
  sinceLastVisit: SinceLastVisitPayload;
  progress: ProgressPayload;
  dailyMission: DailyMissionPayload;
  continuationState: ContinuationStatePayload;
  reentrySummary: ReentrySummaryPayload;
  dashboardMode: DashboardMode | null;
  recommendedSections: DashboardSectionKey[];
  /** Phase 5: backend-provided section metadata (titles + empty states). */
  sectionPayloads: SectionPayloadsPayload | null;
  /**
   * Canonical section headings keyed by snake_case section id (e.g. `search_at_a_glance`, `landscape`, `momentum`).
   * Prefer over duplicated client strings for visible chrome.
   */
  normalizedSectionTitles: NormalizedSectionTitlesPayload | null;
  /** `1` when backend orchestration ran; use `orchestratedRecommendations` + `dashboardNarrative` for surfaces. */
  orchestrationVersion: number;
  recommendationGraph: CanonicalRecommendation[];
  orchestratedRecommendations: OrchestratedRecommendation[];
  continuationHint: ContinuationHintPayload | null;
  dashboardNarrative: DashboardNarrativePayload | null;
  /**
   * Intelligence layer (orchestration v2+): ordered surfaces, narrative, pipeline snapshot, fatigue.
   * Prefer this + `dashboardNarrative` for hero/momentum/informational zones over raw legacy arrays.
   */
  dashboardExperience: DashboardExperiencePayload | null;
  /** “Resume exactly where the user stopped” (backend-owned). */
  resumeTarget: ResumeTargetPayload | null;
  /** Backend guarantees for stability/hydration to prevent flip-flopping UI. */
  experienceStability: ExperienceStabilityPayload | null;
  /** Phase 14: Dashboard IA — card ordering, visibility, collapsible groups (backend-authored; optional). */
  dashboardLayoutConfig: DashboardLayoutConfigPayload | null;
  /** Optional meta for priority-zone urgency / promotion (backend-authored; optional). */
  priorityIntelligence: PriorityIntelligenceMetaPayload | null;
  /** Phase 15: Primary command directive + CTA (optional; prefer over client-derived command bar). */
  commandBar: DashboardCommandBarPayload | null;
  /** Phase 15: Five headline metrics for the stats row (optional). */
  dashboardVitals: DashboardVitalsPayload | null;
  /** Phase 17A: Unfinished sessions queue (max 5 on dashboard snapshot; total in {@link continuationCount}). */
  continuationItems: DashboardContinuationItemPayload[] | null;
  /** Total unfinished sessions (may exceed length of `continuationItems`). */
  continuationCount: number | null;
  /** Phase 17A: Job-specific interview prep CTAs (optional). */
  interviewPreparationCards: InterviewPreparationCardPayload[] | null;
  interviewPreparationCardsTotalCount: number | null;
  /** Phase 18B: Next interviews snapshot (optional server field → normalized array, possibly empty). */
  upcomingInterviews: UpcomingInterviewItem[];
  upcomingInterviewCount: number | null;
  /**
   * Phase 15: Ranked focus feed, priority ascending in array order (optional; up to 10 from server).
   * `null`/`undefined` after normalize → client merges legacy sources; `[]` → server supplied an empty feed.
   */
  focusItems: DashboardFocusItemPayload[] | null;
  /** Full ranked focus count before home snapshot cap. */
  focusItemsTotalCount: number | null;
  /** Quiet applications — 21+ days without reply (max 2 on home snapshot). */
  staleApplicationItems: DashboardStaleApplicationItemPayload[] | null;
  staleApplicationItemsTotalCount: number | null;
  staleApplicationItemsViewAllHref: string | null;
  /** Phase 15: Deterministic empty copy + CTA per section key (optional). */
  dashboardEmptyStates: DashboardEmptyStatesPayload | null;
};

export type ResumeTargetPayload = {
  /** Continuation card title (backend-owned; prefer over inferred narrative labels). */
  title: string | null;
  /** When `execution_session`, continuation UI is backed by real execution memory (backend-owned). */
  continuationSource: string | null;
  workflowEntityId: string | null;
  workflowEntityType: string | null;
  executionType: string | null;
  resumeTarget: string | null;
  resumeComponent: string | null;
  resumeState: Record<string, unknown> | null;
  resumeIntent: string | null;
  resumeConfidence: number | null;
  estimatedRemainingMinutes: number | null;
  percentComplete: number | null;
  hydrationConsistencyKey: string | null;
  continuationContext: ContinuationContextPayload | null;
};

export type ExperienceStabilityPayload = {
  /** Explicit stability flag (preferred). When `false`, frontend must not commit hero copy. */
  stable: boolean | null;
  experienceReady: boolean;
  stableHeroCandidateId: string | null;
  hydrationConsistencyKey: string | null;
};

export type WorkflowProgressPayload = {
  sessionId: string | null;
  workflowEntityId: string | null;
  workflowEntityType: string | null;
  executionType: string | null;
  stepKey: string | null;
  percentComplete: number | null;
  estimatedRemainingMinutes: number | null;
  lastActiveAt: string | null;
  lastMeaningfulAction: unknown | null;
};

export type AssistantStatePayload = {
  narrativeArc: string | null;
  daysInArc: number | null;
  confidenceTrend: string | null;
  momentumState: string | null;
  fatigueLevel: string | null;
};

export type AdaptiveReasoningPayload = {
  signal: string;
  effect: string;
};

/** Phase 3 AssistantLanguageService — deterministic human copy (no client inference). */
export type AssistantNarrativePayload = {
  headline: string | null;
  supporting: string | null;
  /** Compressed hero CTA label (backend-authored). */
  ctaLabel: string | null;
  /** Phase 6A hero CTA destination (backend-resolved). */
  ctaHref: string | null;
  /** Phase 6A hero CTA validation (backend). */
  ctaValidated: boolean | null;
  /** Phase 6A hero CTA provenance (backend). */
  ctaSource: string | null;
  /** Optional muted line under CTA (backend-authored). */
  microcopy: string | null;
  /** Narrative tone slug from language layer (not necessarily same as `assistantTone`). */
  tone: string | null;
  /** When true, omit the dashboard Guidance (insights) grid. */
  suppressGuidanceCard: boolean | null;
};

/** Phase 5A: Opportunity Detection recommendation (backend-authored). */
export type OpportunityDetectionReason =
  | 'high_match_not_applied'
  | 'draft_ready'
  | 'saved_high_fit'
  | 'deadline_soon'
  | 'most_advanced';

export type OpportunityDetectionPayload = {
  headline: string | null;
  supporting: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** Confidence score (store only; no special styling yet). */
  confidence: number | null;
  reason: OpportunityDetectionReason | null;
};

export type FollowUpIntelligenceReason =
  | 'ideal_followup_window'
  | 'overdue_followup'
  | 'high_match_waiting'
  | 'interview_followup';

export type FollowUpJobSource = 'application' | 'bookmark' | 'analysis';

/** One row in the capped follow-up queue (`followUpJobs`, max 50). */
export type FollowUpJobRowPayload = {
  id: string;
  source: FollowUpJobSource | null;
  coachingStage: string | null;
  headline: string | null;
  supporting: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  confidence: number | null;
  daysSinceApplication: number | null;
  reason: string | null;
  applicationId: string | null;
  jobAnalysisId: string | null;
  jobListingId: string | null;
  bookmarkId: string | null;
  companyName: string | null;
  companyLogoUrl?: string | null;
  jobTitle: string | null;
};

/** Phase 5B: Follow-up intelligence coaching card payload (backend-authored). */
export type FollowUpIntelligencePayload = {
  headline: string | null;
  supporting: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** 0–100; stored for future UI. */
  confidence: number | null;
  /** Stored for future UI. */
  daysSinceApplication: number | null;
  reason: FollowUpIntelligenceReason | null;
  /** Employer / company when the API sends it explicitly (optional). */
  companyName: string | null;
  /** Role title when the API sends it explicitly (optional). */
  jobTitle: string | null;
  /** When `submitted`, UI may say “applied”; otherwise use neutral pipeline copy. */
  coachingStage: string | null;
};

export type AdaptiveCoachingCategory =
  | 'interview_momentum'
  | 'application_acceleration'
  | 'follow_up_opportunity'
  | 'cv_strengthening'
  | 'pipeline_recovery'
  | 'confidence_boost';

/** Phase 8: Highest-priority coaching recommendation for this load (backend-authored). */
export type AdaptiveCoachingPayload = {
  headline: string | null;
  supporting: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** Rule tier (e.g. 100–60), not model confidence. */
  priority: number | null;
  category: AdaptiveCoachingCategory | null;
  /** Stable engine code for instrumentation (render-only / sr-only in UI). */
  reason: string | null;
};

/** Phase 9: Consistency / streak snapshot (backend-authored; optional). */
export type HabitStreakStatusBand = 'starting' | 'building' | 'strong' | 'elite';

export type HabitProgressPayload = {
  currentStreakDays: number | null;
  longestStreakDays: number | null;
  activeDaysThisWeek: number | null;
  activeDaysThisMonth: number | null;
  /** 0–100 composite consistency score (not ML confidence). */
  consistencyScore: number | null;
  streakStatus: HabitStreakStatusBand | null;
  encouragement: string | null;
};

export type TodayPlanAchievementCategory =
  | 'analysis'
  | 'cv'
  | 'application'
  | 'interview'
  | 'streak'
  | 'milestone';

export type TodayPlanAchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Phase 9: Earned badge row from today-plan (backend-authored). */
export type TodayPlanAchievementPayload = {
  key: string | null;
  title: string | null;
  description: string | null;
  earnedAt: string | null;
  category: TodayPlanAchievementCategory | null;
  rarity: TodayPlanAchievementRarity | null;
};

/** Phase 9: One-shot milestone banner payload (backend-authored). */
export type MilestoneCelebrationPayload = {
  title: string | null;
  message: string | null;
  icon: string | null;
};

export type StrategicRecommendationImpact = 'low' | 'medium' | 'high' | 'very_high';

export type StrategicRecommendationCategory =
  | 'apply'
  | 'interview'
  | 'follow_up'
  | 'cv_improvement'
  | 'job_analysis';

export type StrategicRecommendationRationalePayload = {
  matchScore: number | null;
  daysUntilInterview: number | null;
  daysSinceLastActivity: number | null;
  cvScore: number | null;
  applicationsInProgress: number | null;
};

/** Phase 14: Optional dashboard layout overrides from today-plan (camelCase + snake_case parsed separately). */
export type DashboardLayoutConfigPayload = {
  priorityCards: string[];
  secondaryCards: string[];
  hiddenCards: string[];
  collapsibleCards: string[];
  mergeLandscapeIntoPipeline: boolean | null;
  suppressInsightGuidance: boolean | null;
};

/** Optional urgency hints for priority intelligence placement (backend-authored; forward-compatible). */
export type PriorityIntelligenceMetaPayload = {
  urgencyLevel: string | null;
  promoteToTop: boolean | null;
};

/** Phase 10: Deterministic ranked recommendation across domains (backend-authored). */
export type StrategicRecommendationPayload = {
  headline: string | null;
  supporting: string | null;
  reasoning: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** 0–100 vs alternatives, not statistical probability. */
  confidence: number | null;
  expectedImpact: StrategicRecommendationImpact | null;
  category: StrategicRecommendationCategory | null;
  rationale: StrategicRecommendationRationalePayload | null;
};

/** Phase 21: Single prioritized “recommended move” (backend-authored; optional). */
export type RecommendedMovePayload = {
  /** Which digest row won server-side selection (`strategicRecommendation` | `adaptiveCoaching` | `nextStep`). */
  source: string | null;
  headline: string | null;
  supporting: string | null;
  /** 0–100 action signal (strategic confidence or equivalent). */
  confidence: number | null;
  /** 0–100 engine priority for adaptive; mirrors confidence for strategic when omitted. */
  priority: number | null;
  category: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  relevantActivityAt?: string | null;
  relevantActivityLabel?: string | null;
};

export type CareerAchievementsLevelPayload = {
  number: number | null;
  title: string | null;
};

export type CareerAchievementsSummaryPayload = {
  totalUnlocked: number | null;
  rareCount: number | null;
  epicCount: number | null;
  legendaryCount: number | null;
};

export type CareerAchievementAlmostPayload = {
  key: string | null;
  title: string | null;
  description: string | null;
  progressCurrent: number;
  progressTarget: number;
  remaining: number | null;
  rarity: TodayPlanAchievementRarity | null;
};

export type CareerAchievementsExperiencePointsPayload = {
  current: number | null;
  nextLevelAt: number | null;
};

/** Phase 21: Gamified career achievements bundle (backend-authored; optional). */
export type CareerAchievementsPayload = {
  level: CareerAchievementsLevelPayload | null;
  summary: CareerAchievementsSummaryPayload | null;
  /** Recent subset; same row shape as {@link TodayPlanPayload.achievements}. */
  recentWins: TodayPlanAchievementPayload[];
  almostUnlocked: CareerAchievementAlmostPayload[];
  experiencePoints: CareerAchievementsExperiencePointsPayload | null;
  /** When omitted, UI defaults to `/dashboard/achievements`. */
  viewAllHref: string | null;
  /** Older wire-only summary line (`badgeSummary`, etc.). */
  legacyBadgeSummaryLine: string | null;
};

export type CareerGoalRemotePreference = 'remote' | 'hybrid' | 'onsite' | 'flexible';

export type CareerGoalSeniority = 'mid' | 'senior' | 'staff' | 'principal' | 'executive';

/** Phase 11: Normalized career targets from profile + onboarding + prefs (backend-authored). */
export type CareerGoalProfilePayload = {
  targetRoles: string[];
  preferredCompanies: string[];
  preferredIndustries: string[];
  targetLocations: string[];
  remotePreference: CareerGoalRemotePreference | null;
  technologies: string[];
  salaryMin: number | null;
  salaryTarget: number | null;
  seniorityGoal: CareerGoalSeniority | null;
  timelineGoal: string | null;
};

export type GoalAlignmentPayload = {
  score: number | null;
  headline: string | null;
  supporting: string | null;
  strongestSignals: string[];
  gapSignals: string[];
  /** Optional CTA when backend supplies goal actions verbatim. */
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

export type GoalStrategicCoachingTimeHorizon = 'today' | 'this_week' | 'this_month' | 'quarter';

/** Phase 12: Goal-based coaching primary card (backend-authored). */
export type GoalStrategicCoachingPayload = {
  headline: string | null;
  supporting: string | null;
  recommendation: string | null;
  reasoning: string | null;
  confidence: number | null;
  timeHorizon: GoalStrategicCoachingTimeHorizon | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

export type StrategicCoachingReason =
  | 'interview_focus'
  | 'cv_leverage'
  | 'follow_through'
  | 'pipeline_stalled'
  | 'opportunity_rich'
  | 'consistency_needed';

/** Phase 5C: Strategic coaching card payload (backend-authored). */
export type StrategicCoachingPayload = {
  headline: string | null;
  supporting: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  confidence: number | null;
  reason: StrategicCoachingReason | null;
};

export type CareerMomentumTier = 'building' | 'steady' | 'strong' | 'surging';

/**
 * Deterministic composite index (0–100) + metadata (OpenAPI `DeterministicIndexScoreDto`).
 * Prefer `value`; legacy numeric fields may duplicate the same number during rollout.
 */
export type DeterministicIndexScorePayload = {
  value: number | null;
  label: string | null;
  type: string | null;
  confidenceBand: string | null;
  description: string | null;
  interpretation: string | null;
  disclaimer: string | null;
};

/** Phase 5D: Career momentum composite score (backend-authored). */
export type CareerMomentumPayload = {
  score: number | null;
  /** Preferred: structured index + copy; `score` kept for backward compatibility. */
  momentumIndex: DeterministicIndexScorePayload | null;
  tier: CareerMomentumTier | null;
  headline: string | null;
  supporting: string | null;
  strengths: string[];
  opportunity: string | null;
  confidence: number | null;
};

export type WeeklyBriefingTone = 'encouraging' | 'focused' | 'urgent' | 'celebratory';

/** Phase 5E: Rolling weekly executive briefing (backend-authored). */
export type WeeklyBriefingPayload = {
  headline: string | null;
  summary: string | null;
  wins: string[];
  needsAttention: string[];
  recommendedFocus: string | null;
  confidence: number | null;
  tone: WeeklyBriefingTone | null;
};

export type PredictivePipelineHealth = 'fragile' | 'building' | 'healthy' | 'strong';

/** Phase 6A: Semantic outlook bands from deterministic backend rules (not LLM probabilities). */
export type PredictiveOutlookPayload = {
  interviewOutlook: SemanticOutlookPayload | null;
  offerOutlook: SemanticOutlookPayload | null;
  timelineOutlook: TimelineOutlookBand | null;
  timelineOutlookLabel: string | null;
  pipelineHealth: PredictivePipelineHealth | null;
  headline: string | null;
  supporting: string | null;
  confidence: number | null;
};

export type StrategicWeeklyCoachingReason =
  | 'analysis_paralysis'
  | 'low_application_volume'
  | 'interview_focus'
  | 'low_fit_targeting'
  | 'stalled_pipeline'
  | 'strong_momentum'
  | 'recovery_mode';

/** Same tone slugs as weekly briefing / predictive surfaces. */
export type StrategicWeeklyCoachingTone = WeeklyBriefingTone;

/** Phase 6D: One strategic behavioral insight for the week (backend-authored). */
export type StrategicWeeklyCoachingPayload = {
  reason: StrategicWeeklyCoachingReason | null;
  headline: string | null;
  supporting: string | null;
  recommendedAction: string | null;
  confidence: number | null;
  tone: StrategicWeeklyCoachingTone | null;
};

/**
 * Prefer structured index `value`; fall back to legacy flat score during API rollout.
 */
export function effectiveDeterministicIndexValue(
  meta: DeterministicIndexScorePayload | null | undefined,
  legacy: number | null,
): number | null {
  const v = meta?.value;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.min(100, Math.max(0, Math.round(v)));
  }
  return legacy;
}

export type EmotionalSummaryPayload = {
  tone: string | null;
  message: string | null;
};

export type AssistantReasoningPayload = {
  primaryFocusReason: string | null;
  continuityReason: string | null;
  pacingReason: string | null;
};

export type AssistantGuidancePayload = {
  /** @deprecated: legacy label; do not render in compressed hero. */
  headline: string | null;
  /** Single “why it matters” line (server-authored). */
  explanation: string | null;
  /** Preferred CTA destination for compressed hero. */
  href: string | null;
};

export type HumanizedLabelsPayload = {
  narrativeArc: string | null;
  strategicMode: string | null;
  momentum: string | null;
  fatigue: string | null;
  confidence: string | null;
};

/** Nested coaching copy — mirrors flat `personalized*` fields on today-plan. */
export type PersonalInsightsPayload = {
  headline: string | null;
  supporting: string | null;
  whyItMatters: string | null;
  nextBestAction: string | null;
};

/** Tone/story lines aligned with top-level assistant fields; server-authored only. */
export type AssistantVoicePayload = {
  emotionalSummary: string | null;
  narrativeProgression: string | null;
};

/** Phase 4 personalization envelope — deterministic backend signals + mirrored copy. */
export type PersonalizationContextPayload = {
  /** When true, assistant narrative/guidance fields already carry merged metric-backed copy — prefer them over stale generic experience strings. */
  primaryInsightActive: boolean | null;
  /** e.g. cv_improvement | job_matching | applications | interview_preparation */
  strongestLeverage: string | null;
  quantifiedOpportunities: unknown | null;
  personalInsights: PersonalInsightsPayload | null;
  assistantVoice: AssistantVoicePayload | null;
};

export type HeroStabilityPayload = {
  stable: boolean | null;
  heroCommitId: string | null;
  heroStableUntilIso: string | null;
  heroReason: string | null;
};

export type ExperienceStatePayload = {
  stable: boolean | null;
  committedAt: string | null;
  /** @deprecated for display — prefer `narrativeFocusLabel` / `humanizedLabels.narrativeArc`. */
  narrativeArc: string | null;
  /** Human-readable arc label (Phase 3). */
  narrativeFocusLabel: string | null;
};

export type DashboardSurfaceOwnership =
  | 'hero'
  | 'continuation'
  | 'priority_queue'
  | 'nudge'
  | 'revisit'
  | 'onboarding';

export type DashboardMode = 'onboarding' | 'active_search' | 'execution_focus' | 'recovery' | 'low_activity';

export type DashboardSectionKey =
  | 'hero'
  | 'today_plan'
  /** Alias used by orchestrated today-plan for momentum/progress-style zones — gate together with `progress` on client. */
  | 'momentum'
  /** Phase 5: Search-at-a-glance / landscape overview block. */
  | 'landscape'
  | 'progress'
  | 'onboarding'
  /** Phase 5: summary metrics strip/cards. */
  | 'summary_metrics'
  /** Optional extras (backend may include). */
  | 'recovery_guidance'
  | 'execution_workspace'
  | 'nudges'
  | 'achievements'
  | 'revisit'
  | 'cv'
  | 'analyze'
  | 'tools'
  | 'history';

export type DashboardSectionPayload = {
  title: string | null;
  body: string | null;
  emptyStateCopy: string | null;
  /** Small label row above the main title (backend-authored section name). */
  sectionLabel: string | null;
};

export type SectionPayloadsPayload = Partial<Record<DashboardSectionKey, DashboardSectionPayload>> & Record<string, unknown>;

function unwrapEnvelope(raw: unknown): Record<string, unknown> {
  let cur: unknown = raw;
  for (let depth = 0; depth < 4; depth++) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) break;
    const o = cur as Record<string, unknown>;
    if (
      o.success === true &&
      o.data !== null &&
      typeof o.data === 'object' &&
      !Array.isArray(o.data)
    ) {
      cur = o.data;
      continue;
    }
    break;
  }
  if (cur !== null && typeof cur === 'object' && !Array.isArray(cur)) {
    return cur as Record<string, unknown>;
  }
  return {};
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Wire JSON sometimes sends numeric ids; coerce to a stable non-empty string. */
function pickWireStringLike(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function pickCta(raw: unknown): TodayPlanCta {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { label: 'Open', action: {} };
  }
  const o = raw as Record<string, unknown>;
  const label = String(pickStr(o, 'label') ?? 'Open');
  const href = pickStr(o, 'href', 'path');
  let action: Record<string, unknown> = {};
  if (o.action !== null && typeof o.action === 'object' && !Array.isArray(o.action)) {
    action = o.action as Record<string, unknown>;
  } else {
    const skip = new Set(['label', 'href', 'path']);
    for (const [k, v] of Object.entries(o)) {
      if (!skip.has(k)) action[k] = v;
    }
  }
  return { label, ...(href ? { href } : {}), action };
}

function pickItem(raw: unknown): TodayPlanItem | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, 'id') ?? '';
  if (!id) return null;
  const title = String(pickStr(o, 'title', 'headline') ?? 'Next step');
  const cta = pickCta(o.cta);
  const recommendationSourceRaw = String(
    pickStr(o, 'recommendationSource', 'recommendation_source') ?? '',
  ).toLowerCase();
  const locationStrategyRaw = String(pickStr(o, 'locationStrategy', 'location_strategy') ?? '').toLowerCase();
  const normalizedLocationStrategy: 'local' | 'remote_fallback' | null =
    locationStrategyRaw === 'local' || locationStrategyRaw === 'remote_fallback' ? locationStrategyRaw : null;
  const recommendationSource: 'local' | 'remote_fallback' | null =
    normalizedLocationStrategy ??
    (recommendationSourceRaw === 'local' || recommendationSourceRaw === 'remote_fallback'
      ? recommendationSourceRaw
      : null);
  return {
    id,
    title,
    subtitle: pickStr(o, 'subtitle', 'sub_title') ?? null,
    rationale: pickStr(o, 'rationale', 'body', 'description') ?? null,
    reasonCodes: pickStrArray(o.reasonCodes ?? o.reason_codes),
    statusLabel: pickStrOrNull(o, 'statusLabel', 'status_label'),
    tagLabel: pickStrOrNull(o, 'tagLabel', 'tag_label'),
    priority: typeof o.priority === 'number' && Number.isFinite(o.priority) ? o.priority : undefined,
    confidence:
      typeof o.confidence === 'number' && Number.isFinite(o.confidence)
        ? o.confidence
        : o.confidence === null
          ? null
          : undefined,
    cta,
    source: pickStr(o, 'source', 'matchSource') ?? null,
    matchScore:
      typeof o.matchScore === 'number' && Number.isFinite(o.matchScore)
        ? o.matchScore
        : typeof o.match_score === 'number' && Number.isFinite(o.match_score)
          ? o.match_score
          : null,
    company: pickStr(o, 'company', 'jobCompany') ?? null,
    companyLogoUrl: pickCompanyLogoUrl(o),
    jobTitle: pickStr(o, 'jobTitle', 'job_title', 'roleTitle') ?? null,
    locationStrategy: recommendationSource,
    locationLabel: pickStr(o, 'locationLabel', 'location_label') ?? null,
    postedAgeHours:
      typeof o.postedAgeHours === 'number' && Number.isFinite(o.postedAgeHours)
        ? o.postedAgeHours
        : typeof o.posted_age_hours === 'number' && Number.isFinite(o.posted_age_hours)
          ? o.posted_age_hours
          : null,
    recommendationSource,
    recommendationLocation:
      pickStr(o, 'recommendationLocation', 'recommendation_location') ??
      pickStr(o, 'locationLabel', 'location_label') ??
      null,
    fallbackReason: pickStr(o, 'fallbackReason', 'fallback_reason') ?? null,
    state: pickStr(o, 'state', 'pipelineState', 'pipeline_state') ?? null,
    isApplied: o.isApplied === true || o.is_applied === true,
  };
}

function pickItemArray(v: unknown): TodayPlanItem[] {
  if (!Array.isArray(v)) return [];
  const out: TodayPlanItem[] = [];
  for (const el of v) {
    const it = pickItem(el);
    if (it) out.push(it);
  }
  return out;
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

function pickNumOrNull(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function pickNonNegIntOrNull(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Math.max(0, Math.round(Number(v)));
  }
  return null;
}

function pickBoolOrNull(o: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const k of keys) {
    const v = o[k];
    if (v === true) return true;
    if (v === false) return false;
  }
  return null;
}

function pickOptionalScore(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return Math.max(0, Math.min(100, Math.round(v)));
    }
  }
  return null;
}

function pickImpactLevel(
  o: Record<string, unknown>,
): 'low' | 'medium' | 'high' | null {
  const s = String(pickStr(o, 'expectedImpactLevel', 'expected_impact_level') ?? '')
    .trim()
    .toLowerCase();
  return s === 'low' || s === 'medium' || s === 'high' ? s : null;
}

function pickStrOrNull(o: Record<string, unknown>, ...keys: string[]): string | null {
  return pickStr(o, ...keys) ?? null;
}

const VALID_PRIORITY_STATES = new Set<string>([
  'quick_win',
  'ready_now',
  'continuation',
  'blocked',
  'high_impact',
  'waiting',
  'follow_up',
]);

function pickPriorityState(o: Record<string, unknown>): PriorityState | null {
  const s = String(pickStr(o, 'priorityState', 'priority_state') ?? '')
    .trim()
    .toLowerCase();
  return VALID_PRIORITY_STATES.has(s) ? (s as PriorityState) : null;
}

const VALID_MOMENTUM_TYPES = new Set<string>(['progress', 'continuation', 'quick_win', 'recovery', 'confidence']);
const VALID_DASHBOARD_MODES = new Set<string>([
  'onboarding',
  'active_search',
  'execution_focus',
  'recovery',
  'low_activity',
]);
const VALID_SURFACE_OWNERSHIP = new Set<string>(['hero', 'continuation', 'priority_queue', 'nudge', 'revisit', 'onboarding']);
const VALID_RECOMMENDED_SECTIONS = new Set<string>([
  'hero',
  'today_plan',
  'momentum',
  'landscape',
  'progress',
  'onboarding',
  'summary_metrics',
  'recovery_guidance',
  'execution_workspace',
  'nudges',
  'achievements',
  'revisit',
  'cv',
  'analyze',
  'tools',
  'history',
]);

function pickMomentumType(v: unknown): MomentumType | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return VALID_MOMENTUM_TYPES.has(s) ? (s as MomentumType) : null;
}

function pickDashboardMode(v: unknown): DashboardMode | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return VALID_DASHBOARD_MODES.has(s) ? (s as DashboardMode) : null;
}

function pickSurfaceOwnership(v: unknown): DashboardSurfaceOwnership | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return VALID_SURFACE_OWNERSHIP.has(s) ? (s as DashboardSurfaceOwnership) : null;
}

function pickRecommendedSections(v: unknown): DashboardSectionKey[] {
  if (!Array.isArray(v)) return [];
  const out: DashboardSectionKey[] = [];
  for (const el of v) {
    const s = String(el ?? '')
      .trim()
      .toLowerCase();
    if (!VALID_RECOMMENDED_SECTIONS.has(s)) continue;
    out.push(s as DashboardSectionKey);
  }
  return out;
}

const COMMAND_BAR_SOURCES = new Set<string>([
  'priority_intelligence',
  'follow_up_intelligence',
  'cv_clinic',
  'opportunity_detection',
  'continuation',
]);

const FOCUS_ITEM_TYPES = new Set<string>([
  'interview',
  'follow_up',
  'cv',
  'opportunity',
  'continuation',
  'revisit',
  'goal_alignment',
]);

function pickCommandBarSource(raw: unknown): DashboardCommandBarSource | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return COMMAND_BAR_SOURCES.has(s) ? (s as DashboardCommandBarSource) : null;
}

function pickConfidencePct(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.min(100, Math.max(0, Math.round(raw)));
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) {
    return Math.min(100, Math.max(0, Math.round(Number(raw))));
  }
  return null;
}

function clampScore0to100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function pickScore0to100(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return clampScore0to100(raw);
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return clampScore0to100(Number(raw));
  return null;
}

/** Parses `score` from mixed legacy shapes when only `value` / percent fields exist. */
function inferScore0to100(o: Record<string, unknown>): number | null {
  const direct = pickScore0to100(o.score);
  if (direct != null) return direct;
  const pct =
    pickScore0to100(o.percent ?? o.percentage ?? o.probability ?? o.scoreValue ?? o.score_value) ?? null;
  if (pct != null) return pct;
  const valueStr = pickStr(o, 'value', 'displayValue', 'display_value', 'primaryValue', 'primary_value') ?? '';
  const m = valueStr.trim().match(/^(\d+)\s*\/\s*100$/i);
  if (m) return clampScore0to100(Number(m[1]));
  const p = valueStr.trim().match(/^(\d+)\s*%$/);
  if (p) return clampScore0to100(Number(p[1]));
  const plain = valueStr.trim().match(/^(\d+)$/);
  if (plain) return clampScore0to100(Number(plain[1]));
  return null;
}

function pickNonNegativeInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) {
    return Math.max(0, Math.round(Number(raw)));
  }
  return null;
}

function pickCareerMomentumVital(raw: unknown): DashboardCareerMomentumVitalPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const score = inferScore0to100(o);
  if (score === null) return null;
  const label = String(pickStr(o, 'label') ?? '').trim();
  const explanation = pickStrOrNull(o, 'explanation');
  const statusTier = pickStrOrNull(o, 'status', 'tier', 'band');
  const out: DashboardCareerMomentumVitalPayload = { score, label };
  if (explanation?.trim()) out.explanation = explanation.trim();
  if (statusTier?.trim()) out.status = statusTier.trim();
  const trendRaw = o.trend;
  if (trendRaw !== undefined && trendRaw !== null) {
    if (typeof trendRaw === 'number' && Number.isFinite(trendRaw)) out.trend = trendRaw;
  }
  return out;
}

function pickInterviewOutlookVital(raw: unknown): DashboardInterviewOutlookVitalPayload | null {
  const outlook = pickSemanticOutlook(raw);
  if (!outlook) return null;
  const label = outlook.label?.trim() || 'Interview outlook';
  const explanation = pickStrOrNull(
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {},
    'explanation',
  );
  return {
    value: outlook.value,
    label,
    outlookBasis: outlook.outlookBasis,
    disclaimer: outlook.disclaimer,
    ...(explanation?.trim() ? { explanation: explanation.trim() } : {}),
  };
}

function pickBestMatchVital(raw: unknown): DashboardBestMatchVitalPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const score = inferScore0to100(o);
  if (score === null) return null;
  const label = String(pickStr(o, 'label') ?? '').trim();
  const company = pickStr(o, 'company', 'companyName', 'company_name') ?? null;
  const explanation = pickStrOrNull(o, 'explanation');
  return {
    score,
    label,
    company,
    ...(explanation?.trim() ? { explanation: explanation.trim() } : {}),
  };
}

function pickActiveApplicationsVital(raw: unknown): DashboardActiveApplicationsVitalPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  let count = pickNonNegativeInt(o.count ?? o.numericValue ?? o.numeric_value ?? o.applicationsInProgress);
  if (count === null) {
    const vs = pickStr(o, 'value', 'displayValue', 'display_value') ?? '';
    const m = vs.trim().match(/^(\d+)$/);
    if (m) count = pickNonNegativeInt(Number(m[1]));
  }
  if (count === null) return null;
  const label = String(pickStr(o, 'label') ?? '').trim();
  const explanation = pickStrOrNull(o, 'explanation');
  return {
    count,
    label,
    ...(explanation?.trim() ? { explanation: explanation.trim() } : {}),
  };
}

function pickStreakVital(raw: unknown): DashboardStreakVitalPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const daysRaw = o.days ?? o.currentStreakDays ?? o.current_streak_days;
  const days = pickNonNegativeInt(daysRaw);
  if (days === null) return null;
  const label = String(pickStr(o, 'label') ?? '').trim();
  const explanation = pickStrOrNull(o, 'explanation');
  return {
    days,
    label,
    ...(explanation?.trim() ? { explanation: explanation.trim() } : {}),
  };
}

function pickDashboardVitals(raw: unknown): DashboardVitalsPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const careerMomentum = pickCareerMomentumVital(o.careerMomentum ?? o.career_momentum);
  const interviewOutlook = pickInterviewOutlookVital(o.interviewOutlook ?? o.interview_outlook);
  const bestMatch = pickBestMatchVital(o.bestMatch ?? o.best_match);
  const activeApplications = pickActiveApplicationsVital(o.activeApplications ?? o.active_applications);
  const streak = pickStreakVital(o.streak);
  if (!careerMomentum && !interviewOutlook && !bestMatch && !activeApplications && !streak) return null;
  const out: DashboardVitalsPayload = {};
  if (careerMomentum) out.careerMomentum = careerMomentum;
  if (interviewOutlook) out.interviewOutlook = interviewOutlook;
  if (bestMatch) out.bestMatch = bestMatch;
  if (activeApplications) out.activeApplications = activeApplications;
  if (streak) out.streak = streak;
  return out;
}

function pickFocusItemType(raw: unknown): FocusItemTypePhase15 | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return FOCUS_ITEM_TYPES.has(s) ? (s as FocusItemTypePhase15) : null;
}

function pickFocusUrgency(raw: unknown): 'high' | 'medium' | 'low' | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === 'high' || s === 'medium' || s === 'low' ? s : null;
}

function pickDashboardFocusItem(el: unknown): DashboardFocusItemPayload | null {
  if (el === null || typeof el !== 'object' || Array.isArray(el)) return null;
  const o = el as Record<string, unknown>;
  const id = String(pickStr(o, 'id') ?? '').trim();
  const type = pickFocusItemType(o.type);
  const urgency = pickFocusUrgency(o.urgency);
  const title = String(pickStr(o, 'title') ?? '').trim();
  const description = String(pickStr(o, 'description') ?? '').trim();
  const ctaLabel = String(pickStr(o, 'ctaLabel', 'cta_label') ?? '').trim();
  const ctaHref = String(pickStr(o, 'ctaHref', 'cta_href') ?? '').trim();
  const priorityRaw = o.priority ?? o.priority_rank;
  const priority =
    typeof priorityRaw === 'number' && Number.isFinite(priorityRaw)
      ? priorityRaw
      : typeof priorityRaw === 'string' && priorityRaw.trim() && Number.isFinite(Number(priorityRaw))
        ? Number(priorityRaw)
        : NaN;
  if (!id || !type || !urgency || !title || !ctaLabel || !ctaHref || !Number.isFinite(priority)) return null;
  const estimatedMinutesRaw = o.estimatedMinutes ?? o.estimated_minutes;
  const estimatedMinutes =
    typeof estimatedMinutesRaw === 'number' && Number.isFinite(estimatedMinutesRaw)
      ? Math.max(0, Math.round(estimatedMinutesRaw))
      : typeof estimatedMinutesRaw === 'string' &&
          estimatedMinutesRaw.trim() &&
          Number.isFinite(Number(estimatedMinutesRaw))
        ? Math.max(0, Math.round(Number(estimatedMinutesRaw)))
        : undefined;
  const dueRaw = o.dueInDays ?? o.due_in_days;
  const dueInDays =
    typeof dueRaw === 'number' && Number.isFinite(dueRaw)
      ? Math.round(dueRaw)
      : typeof dueRaw === 'string' && dueRaw.trim() && Number.isFinite(Number(dueRaw))
        ? Math.round(Number(dueRaw))
        : undefined;

  const jobAnalysisIdFocus = pickStrOrNull(o, 'jobAnalysisId', 'job_analysis_id');
  const row: DashboardFocusItemPayload = {
    id,
    type,
    priority,
    urgency,
    title,
    description,
    ctaLabel,
    ctaHref,
    ...(jobAnalysisIdFocus ? { jobAnalysisId: jobAnalysisIdFocus } : {}),
  };
  if (o.confidence !== undefined && o.confidence !== null) {
    const c = pickConfidencePct(o.confidence);
    if (c !== null) row.confidence = c;
  }
  if (estimatedMinutes !== undefined) row.estimatedMinutes = estimatedMinutes;
  if (dueInDays !== undefined) row.dueInDays = dueInDays;
  const lastActivityAt = pickStrOrNull(o, 'lastActivityAt', 'last_activity_at');
  const lastActivityLabel = pickStrOrNull(o, 'lastActivityLabel', 'last_activity_label');
  if (lastActivityAt) row.lastActivityAt = lastActivityAt;
  if (lastActivityLabel) row.lastActivityLabel = lastActivityLabel;
  const hrefNorm = normalizeTodayPlanRoute(row.ctaHref);
  if (hrefNorm) row.ctaHref = hrefNorm;
  return row;
}

function pickStaleApplicationItem(el: unknown): DashboardStaleApplicationItemPayload | null {
  if (el === null || typeof el !== 'object' || Array.isArray(el)) return null;
  const o = el as Record<string, unknown>;
  const id = String(pickStr(o, 'id') ?? '').trim();
  const applicationId = String(pickStr(o, 'applicationId', 'application_id') ?? '').trim();
  const jobTitle = String(pickStr(o, 'jobTitle', 'job_title') ?? '').trim();
  const company = String(pickStr(o, 'company', 'companyName', 'company_name') ?? '').trim();
  const lastActivityAt = String(
    pickStr(o, 'lastActivityAt', 'last_activity_at') ?? '',
  ).trim();
  const lastActivityLabel = String(
    pickStr(o, 'lastActivityLabel', 'last_activity_label') ?? '',
  ).trim();
  const headline = String(pickStr(o, 'headline', 'title') ?? '').trim();
  const supporting = String(pickStr(o, 'supporting', 'description', 'body') ?? '').trim();
  const ctaLabel = String(pickStr(o, 'ctaLabel', 'cta_label') ?? '').trim();
  const ctaHrefRaw = String(pickStr(o, 'ctaHref', 'cta_href') ?? '').trim();
  const priorityRaw = o.priority;
  const priority =
    typeof priorityRaw === 'number' && Number.isFinite(priorityRaw)
      ? priorityRaw
      : typeof priorityRaw === 'string' && priorityRaw.trim() && Number.isFinite(Number(priorityRaw))
        ? Number(priorityRaw)
        : NaN;
  const daysRaw = o.daysSinceActivity ?? o.days_since_activity;
  const daysSinceActivity =
    typeof daysRaw === 'number' && Number.isFinite(daysRaw)
      ? Math.max(0, Math.round(daysRaw))
      : typeof daysRaw === 'string' && daysRaw.trim() && Number.isFinite(Number(daysRaw))
        ? Math.max(0, Math.round(Number(daysRaw)))
        : NaN;
  if (
    !id ||
    !applicationId ||
    !jobTitle ||
    !company ||
    !lastActivityAt ||
    !lastActivityLabel ||
    !headline ||
    !supporting ||
    !ctaLabel ||
    !ctaHrefRaw ||
    !Number.isFinite(priority) ||
    !Number.isFinite(daysSinceActivity)
  ) {
    return null;
  }
  const ctaHref = normalizeTodayPlanRoute(ctaHrefRaw) ?? ctaHrefRaw;
  const secondaryCtaLabel = pickStrOrNull(o, 'secondaryCtaLabel', 'secondary_cta_label');
  const secondaryCtaHrefRaw = pickStrOrNull(o, 'secondaryCtaHref', 'secondary_cta_href');
  const secondaryCtaHref = secondaryCtaHrefRaw
    ? (normalizeTodayPlanRoute(secondaryCtaHrefRaw) ?? secondaryCtaHrefRaw)
    : null;
  const jobAnalysisId = pickStrOrNull(o, 'jobAnalysisId', 'job_analysis_id');
  const quietEligibilityAnchorAt = pickStrOrNull(
    o,
    'quietEligibilityAnchorAt',
    'quiet_eligibility_anchor_at',
  );
  const quietEligibilityReason = pickStrOrNull(
    o,
    'quietEligibilityReason',
    'quiet_eligibility_reason',
  );
  return {
    id,
    applicationId,
    jobTitle,
    company,
    companyLogoUrl: pickCompanyLogoUrl(o),
    lastActivityAt,
    lastActivityLabel,
    daysSinceActivity,
    headline,
    supporting,
    ctaLabel,
    ctaHref,
    priority,
    ...(jobAnalysisId ? { jobAnalysisId } : {}),
    ...(secondaryCtaLabel ? { secondaryCtaLabel } : {}),
    ...(secondaryCtaHref ? { secondaryCtaHref } : {}),
    ...(quietEligibilityAnchorAt ? { quietEligibilityAnchorAt } : {}),
    ...(quietEligibilityReason ? { quietEligibilityReason } : {}),
  };
}

function pickStaleApplicationItems(raw: unknown): DashboardStaleApplicationItemPayload[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DashboardStaleApplicationItemPayload[] = [];
  for (const el of raw) {
    const row = pickStaleApplicationItem(el);
    if (row) out.push(row);
  }
  return out;
}

export function pickStaleApplicationNotice(
  raw: unknown,
): StaleApplicationNoticePayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.show !== true) return null;
  const daysRaw = o.daysSinceActivity ?? o.days_since_activity;
  const daysSinceActivity =
    typeof daysRaw === 'number' && Number.isFinite(daysRaw)
      ? Math.max(0, Math.round(daysRaw))
      : typeof daysRaw === 'string' && daysRaw.trim() && Number.isFinite(Number(daysRaw))
        ? Math.max(0, Math.round(Number(daysRaw)))
        : NaN;
  const headline = String(pickStr(o, 'headline') ?? '').trim();
  const supporting = String(pickStr(o, 'supporting', 'body', 'message') ?? '').trim();
  const primaryCtaLabel = String(
    pickStr(o, 'primaryCtaLabel', 'primary_cta_label', 'ctaLabel', 'cta_label') ?? '',
  ).trim();
  const primaryCtaHrefRaw = String(
    pickStr(o, 'primaryCtaHref', 'primary_cta_href', 'ctaHref', 'cta_href') ?? '',
  ).trim();
  if (
    !Number.isFinite(daysSinceActivity) ||
    !headline ||
    !supporting ||
    !primaryCtaLabel ||
    !primaryCtaHrefRaw
  ) {
    return null;
  }
  const primaryCtaHref = normalizeTodayPlanRoute(primaryCtaHrefRaw) ?? primaryCtaHrefRaw;
  const secondaryCtaLabel = pickStrOrNull(o, 'secondaryCtaLabel', 'secondary_cta_label');
  const secondaryCtaHrefRaw = pickStrOrNull(o, 'secondaryCtaHref', 'secondary_cta_href');
  const secondaryCtaHref = secondaryCtaHrefRaw
    ? (normalizeTodayPlanRoute(secondaryCtaHrefRaw) ?? secondaryCtaHrefRaw)
    : null;
  return {
    show: true,
    daysSinceActivity,
    headline,
    supporting,
    primaryCtaLabel,
    primaryCtaHref,
    ...(secondaryCtaLabel ? { secondaryCtaLabel } : {}),
    ...(secondaryCtaHref ? { secondaryCtaHref } : {}),
  };
}

function pickDashboardFocusItems(raw: unknown): DashboardFocusItemPayload[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DashboardFocusItemPayload[] = [];
  for (const el of raw) {
    const row = pickDashboardFocusItem(el);
    if (row) out.push(row);
  }
  return out;
}

function pickDashboardEmptyStates(raw: unknown): DashboardEmptyStatesPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, DashboardEmptyStatePayload> = {};
  for (const [k0, v] of Object.entries(o)) {
    const k = String(k0).trim().toLowerCase();
    if (!k || v === null || typeof v !== 'object' || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const message = String(pickStr(row, 'message') ?? '').trim();
    if (!message) continue;
    out[k] = {
      message,
      ctaLabel: pickStr(row, 'ctaLabel', 'cta_label') ?? null,
      ctaHref: pickStr(row, 'ctaHref', 'cta_href') ?? null,
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function pickCommandBar(raw: unknown): DashboardCommandBarPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const message = String(pickStr(o, 'message') ?? '').trim();
  const ctaLabel = String(pickStr(o, 'ctaLabel', 'cta_label') ?? '').trim();
  const ctaHref = String(pickStr(o, 'ctaHref', 'cta_href') ?? '').trim();
  const confidence = pickConfidencePct(o.confidence);
  const source = pickCommandBarSource(o.source);
  if (!message || !ctaLabel || !ctaHref || confidence === null || source === null) return null;
  return { message, ctaLabel, ctaHref, confidence, source };
}

function pickContinuationItem(raw: unknown): DashboardContinuationItemPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const id = String(pickStr(o, 'id') ?? 'continuation').trim() || 'continuation';
  const typeRaw = String(pickStr(o, 'type') ?? '').trim().toLowerCase();
  const type =
    typeRaw === 'cv' ||
    typeRaw === 'analysis' ||
    typeRaw === 'application' ||
    typeRaw === 'interview' ||
    typeRaw === 'cover_letter' ||
    typeRaw === 'follow_up'
      ? (typeRaw as DashboardContinuationItemPayload['type'])
      : null;
  const title = String(pickStr(o, 'title', 'headline') ?? '').trim();
  const subtitle = pickStr(o, 'subtitle', 'sub_title') ?? null;
  const description = String(pickStr(o, 'description', 'rationale', 'body') ?? '').trim();

  const ctaRaw =
    (o.cta !== null && typeof o.cta === 'object' && !Array.isArray(o.cta) ? (o.cta as Record<string, unknown>) : null) ??
    null;
  const ctaLabel = String(pickStr(o, 'ctaLabel', 'cta_label') ?? (ctaRaw ? pickStr(ctaRaw, 'label') : null) ?? '').trim();
  const ctaHref = String(pickStr(o, 'ctaHref', 'cta_href') ?? (ctaRaw ? pickStr(ctaRaw, 'href', 'path') : null) ?? '').trim();

  if (!type || !title || !description || !ctaLabel || !ctaHref) return null;

  const confidence = pickConfidencePct(o.confidence);
  const estimatedMinutes = (() => {
    const v = o.estimatedMinutes ?? o.estimated_minutes ?? (ctaRaw ? (ctaRaw.estimatedMinutes ?? ctaRaw.estimated_minutes) : undefined);
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Math.max(0, Math.round(Number(v)));
    return null;
  })();

  const resumeStateRaw = o.resumeState ?? o.resume_state;
  const interviewResumeState = (() => {
    if (type !== 'interview') return null;
    if (resumeStateRaw === null || typeof resumeStateRaw !== 'object' || Array.isArray(resumeStateRaw)) {
      return null;
    }
    const rs = resumeStateRaw as Record<string, unknown>;
    const snapRaw = rs.snapshot ?? rs.state_snapshot;
    const snap =
      snapRaw !== null && typeof snapRaw === 'object' && !Array.isArray(snapRaw)
        ? (snapRaw as Record<string, unknown>)
        : null;
    const evaluationStatus =
      pickStrOrNull(rs, 'evaluationStatus', 'evaluation_status') ??
      (snap ? pickStrOrNull(snap, 'evaluationStatus', 'evaluation_status') : null);
    const resultsPath =
      pickStrOrNull(rs, 'resultsPath', 'results_path', 'resultsRoute', 'results_route') ??
      (snap ? pickStrOrNull(snap, 'resultsPath', 'results_path') : null);
    if (!evaluationStatus && !resultsPath) return null;
    return { evaluationStatus, resultsPath };
  })();

  return {
    id,
    type,
    title,
    subtitle,
    description,
    lastActiveLabel: pickStrOrNull(o, 'lastActiveLabel', 'last_active_label'),
    lastActiveAt: pickStrOrNull(o, 'lastActiveAt', 'last_active_at'),
    confidence,
    estimatedMinutes,
    ctaLabel,
    ctaHref,
    stepKey: pickStrOrNull(o, 'stepKey', 'step_key'),
    interviewResumeState,
  };
}

function pickContinuationItemsArray(raw: unknown): DashboardContinuationItemPayload[] {
  if (!Array.isArray(raw)) return [];
  const out: DashboardContinuationItemPayload[] = [];
  for (const el of raw) {
    const it = pickContinuationItem(el);
    if (it) out.push(it);
  }
  return out;
}

function pickContinuationBundle(body: Record<string, unknown>): {
  continuationItems: DashboardContinuationItemPayload[] | null;
  continuationCount: number | null;
} {
  const fromArray = pickContinuationItemsArray(body.continuationItems ?? body.continuation_items);
  const single = pickContinuationItem(body.continuationItem ?? body.continuation_item);
  const merged = fromArray.length > 0 ? fromArray : single ? [single] : null;

  const countRaw = body.continuationCount ?? body.continuation_count;
  const continuationCount =
    typeof countRaw === 'number' && Number.isFinite(countRaw)
      ? Math.max(0, Math.round(countRaw))
      : merged?.length ?? null;

  return {
    continuationItems: merged,
    continuationCount,
  };
}

function pickInterviewPreparationCard(raw: unknown): InterviewPreparationCardPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const headline = String(pickStr(o, 'headline', 'title') ?? '').trim();
  const supporting = String(pickStr(o, 'supporting', 'subtitle', 'description', 'body') ?? '').trim();
  const ctaLabel = String(pickStr(o, 'ctaLabel', 'cta_label') ?? '').trim();
  const ctaHref = String(pickStr(o, 'ctaHref', 'cta_href') ?? '').trim();
  if (!headline || !ctaLabel || !ctaHref) return null;
  return {
    headline,
    supporting,
    ctaLabel,
    ctaHref,
    applicationId: pickStrOrNull(o, 'applicationId', 'application_id'),
    jobAnalysisId: pickStrOrNull(o, 'jobAnalysisId', 'job_analysis_id'),
    company: pickStrOrNull(o, 'company', 'companyName', 'company_name'),
    companyLogoUrl: pickCompanyLogoUrl(o),
    roleTitle: pickStrOrNull(o, 'roleTitle', 'role_title', 'jobTitle', 'job_title'),
  };
}

function pickInterviewPreparationCards(raw: unknown): InterviewPreparationCardPayload[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out: InterviewPreparationCardPayload[] = [];
  for (const el of raw) {
    const row = pickInterviewPreparationCard(el);
    if (row) out.push(row);
  }
  return out;
}

function pickDaysUntilInterview(o: Record<string, unknown>): number | null {
  const keys = ['daysUntilInterview', 'days_until_interview', 'daysToInterview', 'days_to_interview'];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Math.max(0, Math.round(Number(v)));
  }
  return null;
}

function pickUpcomingInterviewCard(raw: unknown): UpcomingInterviewItem | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  let jobAnalysisId = String(pickWireStringLike(o, 'jobAnalysisId', 'job_analysis_id') ?? '').trim();
  /**
   * Some payloads placed the analysis UUID only on `id`. Backend now duplicates it on `jobAnalysisId`;
   * keep this fallback so cached / transitional responses still normalize.
   */
  if (!jobAnalysisId) {
    jobAnalysisId = String(pickWireStringLike(o, 'id') ?? '').trim();
  }
  if (!jobAnalysisId) {
    jobAnalysisId = String(
      pickWireStringLike(o, 'analysisId', 'analysis_id', 'canonicalJobId', 'canonical_job_id') ?? '',
    ).trim();
  }
  /** Only rows with analysis are listed on the wire; keep guard for partial caches. */
  if (!jobAnalysisId) return null;

  const company =
    pickStrOrNull(o, 'company') ?? pickStrOrNull(o, 'companyName', 'company_name');
  const jobTitle =
    pickStrOrNull(o, 'jobTitle', 'job_title') ?? pickStrOrNull(o, 'roleTitle', 'role_title');

  let headline = String(pickStr(o, 'headline', 'title') ?? '').trim();
  let supporting = String(pickStr(o, 'supporting', 'subtitle', 'description') ?? '').trim();

  let ctaLabel = String(pickWireStringLike(o, 'ctaLabel', 'cta_label') ?? '').trim();
  let ctaHref = String(pickStr(o, 'ctaHref', 'cta_href', 'href', 'url', 'link') ?? '').trim();

  const nestedCta = o.cta ?? o.ctaDetails ?? o.cta_details;
  if (nestedCta !== null && typeof nestedCta === 'object' && !Array.isArray(nestedCta)) {
    const c = nestedCta as Record<string, unknown>;
    if (!ctaLabel) {
      ctaLabel = String(pickWireStringLike(c, 'ctaLabel', 'cta_label', 'label') ?? '').trim();
    }
    if (!ctaHref) {
      ctaHref = String(pickStr(c, 'ctaHref', 'cta_href', 'href', 'url', 'link') ?? '').trim();
    }
  }

  /** Align with backend defaults when the row is analysis-linked but CTAs were omitted on the wire. */
  if (jobAnalysisId) {
    if (!ctaHref) {
      ctaHref = `/dashboard/interview?jobAnalysisId=${encodeURIComponent(jobAnalysisId)}`;
    }
    if (!ctaLabel) {
      ctaLabel = 'Start interview practice';
    }
  }

  if (!ctaLabel || !ctaHref) return null;

  const stageRaw = pickStrOrNull(o, 'stage', 'interviewStage', 'interview_stage');
  const stageNorm = String(stageRaw ?? '')
    .trim()
    .toLowerCase();
  const isAppliedPrep = stageNorm === 'applied_prep';

  if (!headline) {
    if (isAppliedPrep && company) headline = `Get interview-ready · ${company}`;
    else if (jobTitle && company) headline = `${jobTitle} at ${company}`;
    else if (jobTitle) headline = jobTitle;
    else if (company) headline = `Interview — ${company}`;
    else headline = 'Interview Preparation';
  }
  if (!supporting) {
    if (isAppliedPrep && jobTitle && company) {
      supporting = `You applied for ${jobTitle} at ${company}. Practice now while you wait to hear back.`;
    } else if (jobTitle && company) supporting = `Prepare for your ${jobTitle} interview at ${company}.`;
    else if (jobTitle) supporting = `Prepare for your ${jobTitle} interview.`;
    else if (company) supporting = `Prepare for your interview at ${company}.`;
    else supporting = 'Prepare for your upcoming interview.';
  }

  const interviewDate =
    pickStrOrNull(o, 'interviewDate', 'interview_date') ??
    pickStrOrNull(o, 'scheduledInterviewAt', 'scheduled_interview_at', 'scheduledAt', 'scheduled_at');

  const lastUpdatedAt =
    pickStrOrNull(o, 'lastUpdatedAt', 'last_updated_at', 'updatedAt', 'updated_at') ?? null;
  const lastUpdatedLabel = pickStrOrNull(o, 'lastUpdatedLabel', 'last_updated_label');

  const id = String(pickWireStringLike(o, 'id') ?? '').trim() || jobAnalysisId;

  const confidence = pickConfidencePct(o.confidence);
  const daysUntilInterview = pickDaysUntilInterview(o);

  return {
    id,
    headline,
    supporting,
    company,
    companyLogoUrl: pickCompanyLogoUrl(o),
    jobTitle,
    jobAnalysisId,
    stage: stageRaw,
    interviewDate,
    daysUntilInterview,
    confidence,
    ctaLabel,
    ctaHref,
    lastUpdatedAt,
    ...(lastUpdatedLabel ? { lastUpdatedLabel } : {}),
  };
}

/** Normalize list shapes: plain array, or `{ items }`, `{ rows }`, `{ data }`. */
function coerceWireInterviewList(raw: unknown): unknown[] | null {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.rows)) return obj.rows;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return null;
}

function resolveWireUpcomingInterviews(body: Record<string, unknown>): unknown {
  const tryCoerce = (v: unknown): unknown[] | undefined => {
    const coerced = coerceWireInterviewList(v);
    return coerced !== null ? coerced : undefined;
  };

  const payload =
    body.payload !== null && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : null;
  const result =
    body.result !== null && typeof body.result === 'object' && !Array.isArray(body.result)
      ? (body.result as Record<string, unknown>)
      : null;

  const ordered: unknown[] = [
    body.upcomingInterviews ?? body.upcoming_interviews,
    payload?.upcomingInterviews ?? payload?.upcoming_interviews,
    result?.upcomingInterviews ?? result?.upcoming_interviews,
  ];

  for (const v of ordered) {
    if (v === undefined) continue;
    const list = tryCoerce(v);
    if (list !== undefined) return list;
  }

  const dash = body.dashboard ?? body.dashboardSnapshot ?? body.dashboard_snapshot;
  if (dash !== null && typeof dash === 'object' && !Array.isArray(dash)) {
    const d = dash as Record<string, unknown>;
    const nested = d.upcomingInterviews ?? d.upcoming_interviews;
    if (nested !== undefined) {
      const list = tryCoerce(nested);
      if (list !== undefined) return list;
    }
  }
  return undefined;
}

function pickUpcomingInterviews(raw: unknown): UpcomingInterviewItem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [];
  const out: UpcomingInterviewItem[] = [];
  for (const el of raw) {
    const row = pickUpcomingInterviewCard(el);
    if (row) out.push(row);
  }
  return out;
}

const UPCOMING_INTERVIEWS_SECTION_MAX = 3;

function extractJobAnalysisIdFromCtaHref(href: string): string | null {
  const t = href.trim();
  if (!t) return null;
  try {
    const u = new URL(t, 'https://applymate.invalid');
    const id =
      u.searchParams.get('jobAnalysisId') ??
      u.searchParams.get('job_analysis_id') ??
      u.searchParams.get('analysisId') ??
      u.searchParams.get('analysis_id') ??
      u.searchParams.get('jobId');
    const s = id?.trim();
    return s || null;
  } catch {
    const m =
      t.match(/[?&]jobAnalysisId=([^&]+)/i) ??
      t.match(/[?&]analysisId=([^&]+)/i) ??
      t.match(/[?&]jobId=([^&]+)/i);
    if (!m?.[1]) return null;
    try {
      return decodeURIComponent(m[1]).trim() || null;
    } catch {
      return m[1].trim() || null;
    }
  }
}

/**
 * Backend sometimes omits `upcomingInterviews` while still sending Phase 15 `focusItems`
 * with `type: "interview"` (per-role prep). Build dashboard cards from those rows.
 */
function deriveUpcomingInterviewsFromFocusItems(
  rows: DashboardFocusItemPayload[] | null | undefined,
): UpcomingInterviewItem[] {
  if (!rows?.length) return [];
  const interviewRows = rows.filter((r) => r.type === 'interview');
  const seenJa = new Set<string>();
  const out: UpcomingInterviewItem[] = [];
  for (const r of interviewRows) {
    if (out.length >= UPCOMING_INTERVIEWS_SECTION_MAX) break;
    const fromField = String(r.jobAnalysisId ?? '')
      .trim()
      .replace(/['"]+/g, '');
    const fromHref = extractJobAnalysisIdFromCtaHref(r.ctaHref);
    const ja = fromField || fromHref;
    if (!ja || seenJa.has(ja)) continue;
    seenJa.add(ja);
    const confidence =
      typeof r.confidence === 'number' && Number.isFinite(r.confidence)
        ? Math.round(Math.max(0, Math.min(100, r.confidence)))
        : null;
    const daysUntilInterview =
      typeof r.dueInDays === 'number' && Number.isFinite(r.dueInDays)
        ? Math.max(0, Math.round(r.dueInDays))
        : null;
    const title = r.title.trim();
    const description = r.description.trim();
    const ctaHrefRaw = r.ctaHref.trim();
    const ctaHref =
      ja && !extractJobAnalysisIdFromCtaHref(ctaHrefRaw)
        ? `/dashboard/interview?jobAnalysisId=${encodeURIComponent(ja)}`
        : ctaHrefRaw;
    out.push({
      id: ja,
      jobAnalysisId: ja,
      headline: title || 'Interview preparation',
      supporting: description || 'Prepare for your upcoming interview.',
      company: null,
      jobTitle: null,
      stage: 'interview',
      interviewDate: null,
      daysUntilInterview,
      confidence,
      ctaLabel: r.ctaLabel.trim(),
      ctaHref,
      lastUpdatedAt: null,
    });
  }
  return out;
}

function deriveUpcomingInterviewsFromUnifiedItems(items: UnifiedPriorityItem[]): UpcomingInterviewItem[] {
  const seenJa = new Set<string>();
  const out: UpcomingInterviewItem[] = [];
  for (const it of items) {
    if (out.length >= UPCOMING_INTERVIEWS_SECTION_MAX) break;
    const ja =
      String(it.ids?.jobAnalysisId ?? '').trim() ||
      String(it.interviewPrepContext?.jobAnalysisId ?? '').trim() ||
      String(it.executionPayload?.jobAnalysisId ?? '').trim() ||
      String(it.executionPayload?.jobId ?? '').trim() ||
      String(it.executionContext?.canonicalJobId ?? '').trim();
    if (!ja || seenJa.has(ja)) continue;

    const ws = String(it.workflowState ?? '').trim().toLowerCase();
    const kindLower = String(it.kind ?? '').trim().toLowerCase();
    const hasPrepCtx = Boolean(it.interviewPrepContext?.jobAnalysisId?.trim());
    const interviewLane =
      hasPrepCtx ||
      ws === 'interviewing' ||
      ws === 'applied' ||
      ws === 'applied_prep' ||
      ws.includes('interview') ||
      kindLower.includes('interview');
    if (!interviewLane) continue;

    seenJa.add(ja);

    const company = it.roleCompany ?? it.interviewPrepContext?.company ?? null;
    const jobTitle = it.roleTitle ?? it.interviewPrepContext?.jobTitle ?? null;
    const isAppliedPrep = ws === 'applied' || ws === 'applied_prep';
    let headline = it.title.trim();
    if (!headline && isAppliedPrep && company) headline = `Get interview-ready · ${company}`;
    else if (!headline && jobTitle && company) headline = `${jobTitle} at ${company}`;
    else if (!headline) headline = 'Interview preparation';
    const supporting =
      (it.subtitle && it.subtitle.trim()) ||
      (isAppliedPrep && jobTitle && company
        ? `You applied for ${jobTitle} at ${company}. Practice now while you wait to hear back.`
        : jobTitle && company
          ? `Prepare for your ${jobTitle} interview at ${company}.`
          : 'Prepare for your upcoming interview.');

    const confidence =
      typeof it.confidenceScore === 'number' && Number.isFinite(it.confidenceScore)
        ? Math.round(Math.max(0, Math.min(100, it.confidenceScore)))
        : typeof it.explain?.confidence === 'number' && Number.isFinite(it.explain.confidence)
          ? Math.round(Math.max(0, Math.min(100, it.explain.confidence)))
          : null;

    const ctaHref = `/dashboard/interview?jobAnalysisId=${encodeURIComponent(ja)}`;
    const ctaLabel = 'Start interview practice';

    out.push({
      id: ja,
      jobAnalysisId: ja,
      headline,
      supporting,
      company,
      jobTitle,
      stage: isAppliedPrep ? 'applied_prep' : (it.workflowState ?? 'interviewing'),
      interviewDate: null,
      daysUntilInterview: null,
      confidence,
      ctaLabel,
      ctaHref,
      lastUpdatedAt: null,
    });
  }
  return out;
}

function mergeUpcomingInterviewsFromWireAndFocus(
  wire: unknown,
  focusItems: DashboardFocusItemPayload[] | null,
  unifiedItems: UnifiedPriorityItem[],
): UpcomingInterviewItem[] {
  const fromWire = pickUpcomingInterviews(wire);
  if (fromWire.length > 0) return fromWire.slice(0, UPCOMING_INTERVIEWS_SECTION_MAX);
  const fromFocus = deriveUpcomingInterviewsFromFocusItems(focusItems);
  if (fromFocus.length > 0) return fromFocus;
  return deriveUpcomingInterviewsFromUnifiedItems(unifiedItems);
}

/** Resolved Phase 15 empty copy for a section key, or undefined. */
export function dashboardEmptyStateFor(
  plan: TodayPlanPayload | null | undefined,
  sectionKey: string,
): DashboardEmptyStatePayload | undefined {
  const m = plan?.dashboardEmptyStates;
  if (!m) return undefined;
  const row = m[sectionKey.trim().toLowerCase()];
  return row && typeof row.message === 'string' && row.message.trim() ? row : undefined;
}

function pickNormalizedSectionTitles(raw: unknown): NormalizedSectionTitlesPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k0, v] of Object.entries(o)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const k = String(k0).trim().toLowerCase();
    if (k) out[k] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Resolve a visible section heading from `normalizedSectionTitles` (keys are lower_snake_case). */
export function normalizedSectionTitle(
  plan: TodayPlanPayload | null | undefined,
  key: string,
  fallback: string,
): string {
  const m = plan?.normalizedSectionTitles;
  if (!m) return fallback;
  const v = m[key.trim().toLowerCase()];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

/** Continuation queue for UI (API order; snapshot may cap length vs {@link TodayPlanPayload.continuationCount}). */
export function listContinuationItems(plan: TodayPlanPayload | null | undefined): DashboardContinuationItemPayload[] {
  return plan?.continuationItems?.length ? plan.continuationItems : [];
}

/** Newest first when `lastActiveAt` ISO timestamps exist; otherwise preserves API order. */
export function sortContinuationItemsNewestFirst(
  items: DashboardContinuationItemPayload[],
): DashboardContinuationItemPayload[] {
  return [...items].sort((a, b) => {
    const ta = a.lastActiveAt?.trim() ? Date.parse(a.lastActiveAt) : NaN;
    const tb = b.lastActiveAt?.trim() ? Date.parse(b.lastActiveAt) : NaN;
    if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
    if (Number.isFinite(tb)) return 1;
    if (Number.isFinite(ta)) return -1;
    return 0;
  });
}

function pickSectionPayloads(raw: unknown): SectionPayloadsPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, DashboardSectionPayload> = {};
  for (const [k0, v] of Object.entries(o)) {
    const k = String(k0 ?? '').trim().toLowerCase();
    if (!k) continue;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const title = pickStr(row, 'title') ?? null;
    const body = pickStr(row, 'body') ?? null;
    const emptyStateCopy = pickStr(row, 'emptyStateCopy', 'empty_state_copy') ?? null;
    const sectionLabel = pickStr(row, 'sectionLabel', 'section_label', 'label') ?? null;
    if (!title && !body && !emptyStateCopy && !sectionLabel) continue;
    out[k] = { title, body, emptyStateCopy, sectionLabel };
  }
  return Object.keys(out).length > 0 ? (out as SectionPayloadsPayload) : null;
}

function pickWorkflowState(o: Record<string, unknown>): WorkflowState | null {
  const s = String(pickStr(o, 'workflowState', 'workflow_state') ?? '').trim();
  return s ? (s.toLowerCase() as WorkflowState) : null;
}

function pickWorkflowOrchestrationFeed(raw: unknown): WorkflowOrchestrationFeedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowOrchestrationFeedRow[] = [];
  for (const el of raw) {
    if (el === null || typeof el !== 'object' || Array.isArray(el)) continue;
    const row = el as Record<string, unknown>;
    const cluster =
      pickStrOrNull(row, 'recommendationClusterId', 'recommendation_cluster_id') ??
      pickStrOrNull(row, 'recommendedClusterId', 'recommended_cluster_id');
    const primaryWs = (() => {
      const a = String(pickStr(row, 'primaryWorkflowState', 'primary_workflow_state') ?? '').trim();
      if (a) return a.toLowerCase() as WorkflowState;
      return pickWorkflowState(row);
    })();
    out.push({
      entityType: pickStrOrNull(row, 'entityType', 'entity_type'),
      entityId: pickStrOrNull(row, 'entityId', 'entity_id'),
      recommendationClusterId: cluster,
      primaryWorkflowState: primaryWs,
      owningRecommendationId: pickStrOrNull(row, 'owningRecommendationId', 'owning_recommendation_id'),
      primarySurfaceOwner: pickStrOrNull(row, 'primarySurfaceOwner', 'primary_surface_owner'),
    });
  }
  return out;
}

function pickSurfaceEligibility(raw: Record<string, unknown>): Record<string, unknown> | null {
  const v = raw.surfaceEligibility ?? raw.surface_eligibility;
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function pickCanonicalRecommendationRow(
  el: unknown,
  withSurface: true,
): OrchestratedRecommendation | null;
function pickCanonicalRecommendationRow(el: unknown, withSurface: false): CanonicalRecommendation | null;
function pickCanonicalRecommendationRow(
  el: unknown,
  withSurface: boolean,
): CanonicalRecommendation | OrchestratedRecommendation | null {
  if (el === null || typeof el !== 'object' || Array.isArray(el)) return null;
  const row = el as Record<string, unknown>;
  const base: CanonicalRecommendation = {
    recommendationId: pickStrOrNull(row, 'recommendationId', 'recommendation_id'),
    workflowEntityId: pickStrOrNull(row, 'workflowEntityId', 'workflow_entity_id'),
    workflowEntityType: pickStrOrNull(row, 'workflowEntityType', 'workflow_entity_type'),
    workflowState: pickWorkflowState(row),
    workflowStage: pickStrOrNull(row, 'workflowStage', 'workflow_stage'),
    recommendationFamily: pickStrOrNull(row, 'recommendationFamily', 'recommendation_family'),
    recommendationIntent: pickStrOrNull(row, 'recommendationIntent', 'recommendation_intent'),
    canonicalActionLabel: pickStrOrNull(row, 'canonicalActionLabel', 'canonical_action_label'),
    canonicalRoute: pickStrOrNull(row, 'canonicalRoute', 'canonical_route'),
    fallbackRoute: pickStrOrNull(row, 'fallbackRoute', 'fallback_route'),
    actionSemantics: pickStrOrNull(row, 'actionSemantics', 'action_semantics') as ActionSemantics | null,
    priorityScore:
      typeof row.priorityScore === 'number' && Number.isFinite(row.priorityScore)
        ? row.priorityScore
        : typeof row.priority_score === 'number' && Number.isFinite(row.priority_score)
          ? row.priority_score
          : null,
    urgency: pickStrOrNull(row, 'urgency'),
    surfaceEligibility: pickSurfaceEligibility(row),
  };
  if (!withSurface) return base;
  const assignedRaw = String(pickStr(row, 'assignedSurface', 'assigned_surface') ?? '')
    .trim()
    .toLowerCase();
  const assignedSurface: AssignedSurface | null = assignedRaw ? (assignedRaw as AssignedSurface) : null;
  const surfaceRank =
    typeof row.surfaceRank === 'number' && Number.isFinite(row.surfaceRank)
      ? row.surfaceRank
      : typeof row.surface_rank === 'number' && Number.isFinite(row.surface_rank)
        ? row.surface_rank
        : null;
  const out: OrchestratedRecommendation = {
    ...base,
    assignedSurface,
    surfaceRank,
  };
  return out;
}

function pickRecommendationGraph(raw: unknown): CanonicalRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const out: CanonicalRecommendation[] = [];
  for (const el of raw) {
    const row = pickCanonicalRecommendationRow(el, false);
    if (row) out.push(row);
  }
  return out;
}

function pickOrchestratedRecommendations(raw: unknown): OrchestratedRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const out: OrchestratedRecommendation[] = [];
  for (const el of raw) {
    const row = pickCanonicalRecommendationRow(el, true);
    if (row) out.push(row);
  }
  return out;
}

function pickContinuationHint(raw: unknown): ContinuationHintPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    workflowEntityId: pickStrOrNull(o, 'workflowEntityId', 'workflow_entity_id'),
    recommendationId: pickStrOrNull(o, 'recommendationId', 'recommendation_id'),
    canonicalRoute: pickStrOrNull(o, 'canonicalRoute', 'canonical_route'),
    narrativeRole: pickStrOrNull(o, 'narrativeRole', 'narrative_role'),
  };
}

function pickExperienceHierarchy(raw: Record<string, unknown>): ExperienceSurfaceHierarchy | null {
  return {
    visualImportance: pickStrOrNull(raw, 'visualImportance', 'visual_importance'),
    urgency: pickStrOrNull(raw, 'urgency'),
    emotionalTone: pickStrOrNull(raw, 'emotionalTone', 'emotional_tone'),
    actionIntensity: pickStrOrNull(raw, 'actionIntensity', 'action_intensity'),
  };
}

function pickDashboardExperienceSurface(el: unknown): DashboardExperienceSurface | null {
  if (el === null || typeof el !== 'object' || Array.isArray(el)) return null;
  const o = el as Record<string, unknown>;
  const fc = pickOptionalScore(o, 'freshnessConfidence', 'freshness_confidence');
  const cc = pickOptionalScore(o, 'continuityConfidence', 'continuity_confidence');
  const sc = pickOptionalScore(o, 'stabilityConfidence', 'stability_confidence');
  const visualPriority = pickStrOrNull(o, 'visualPriority', 'visual_priority');
  const confidenceRaw = o.confidence ?? o.surfaceConfidence ?? o.surface_confidence;
  const confidence =
    confidenceRaw !== null && typeof confidenceRaw === 'object' && !Array.isArray(confidenceRaw)
      ? (() => {
          const c = confidenceRaw as Record<string, unknown>;
          return {
            recommendationConfidence: pickOptionalScore(
              c,
              'recommendationConfidence',
              'recommendation_confidence',
            ),
            routingConfidence: pickOptionalScore(c, 'routingConfidence', 'routing_confidence'),
            workflowConfidence: pickOptionalScore(c, 'workflowConfidence', 'workflow_confidence'),
            continuityConfidence: pickOptionalScore(c, 'continuityConfidence', 'continuity_confidence'),
          } satisfies SurfaceConfidencePayload;
        })()
      : null;

  const continuationContextRaw = o.continuationContext ?? o.continuation_context;
  const continuationContext =
    continuationContextRaw !== null && typeof continuationContextRaw === 'object' && !Array.isArray(continuationContextRaw)
      ? (() => {
          const c = continuationContextRaw as Record<string, unknown>;
          const idxRaw = c.exactStepIndex ?? c.exact_step_index;
          const totalRaw = c.totalSteps ?? c.total_steps;
          return {
            taskLabel: pickStrOrNull(c, 'taskLabel', 'task_label'),
            detailedSummary: pickStrOrNull(c, 'detailedSummary', 'detailed_summary'),
            exactStepLabel: pickStrOrNull(c, 'exactStepLabel', 'exact_step_label'),
            exactStepIndex:
              typeof idxRaw === 'number' && Number.isFinite(idxRaw) ? Math.max(0, Math.round(idxRaw)) : null,
            totalSteps:
              typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? Math.max(0, Math.round(totalRaw)) : null,
            completionPercent: pickOptionalScore(c, 'completionPercent', 'completion_percent'),
            roleTitle: pickStrOrNull(c, 'roleTitle', 'role_title', 'jobTitle', 'job_title'),
            companyName: pickStrOrNull(c, 'companyName', 'company_name', 'company'),
          } satisfies ContinuationContextPayload;
        })()
      : null;
  const kind = String(pickStr(o, 'kind') ?? '')
    .trim()
    .toLowerCase();
  if (kind === 'informational') {
    return {
      kind: 'informational',
      id: pickStrOrNull(o, 'id', 'surfaceId', 'surface_id'),
      category: String(pickStr(o, 'category') ?? '').trim() || 'informational',
      visualPriority,
      insightCategory: pickStrOrNull(o, 'insightCategory', 'insight_category'),
      headline: pickStrOrNull(o, 'headline'),
      body: pickStrOrNull(o, 'body'),
      supportingMetric: o.supportingMetric ?? o.supporting_metric ?? null,
      freshnessConfidence: fc,
      continuityConfidence: cc,
      stabilityConfidence: sc,
      confidence,
    };
  }
  if (kind === 'action') {
    const hRaw = o.hierarchy ?? o.Hierarchy;
    const hier =
      hRaw !== null && typeof hRaw === 'object' && !Array.isArray(hRaw)
        ? pickExperienceHierarchy(hRaw as Record<string, unknown>)
        : null;
    return {
      kind: 'action',
      id: pickStrOrNull(o, 'id', 'surfaceId', 'surface_id'),
      category: String(pickStr(o, 'category') ?? '').trim() || 'action',
      visualPriority,
      recommendationId: pickStrOrNull(o, 'recommendationId', 'recommendation_id'),
      actionRoute: pickStrOrNull(o, 'actionRoute', 'action_route'),
      narrativeTitle: pickStrOrNull(o, 'narrativeTitle', 'narrative_title'),
      narrativeSubtitle: pickStrOrNull(o, 'narrativeSubtitle', 'narrative_subtitle'),
      hierarchy: hier,
      orchestratorSurface: pickStrOrNull(o, 'orchestratorSurface', 'orchestrator_surface'),
      continuationContext,
      freshnessConfidence: fc,
      continuityConfidence: cc,
      stabilityConfidence: sc,
      confidence,
    };
  }
  return null;
}

function pickDashboardExperience(raw: unknown): DashboardExperiencePayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const surfacesRaw = o.surfaces ?? o.Surfaces;
  const surfaces: DashboardExperienceSurface[] = [];
  if (Array.isArray(surfacesRaw)) {
    for (const el of surfacesRaw) {
      const s = pickDashboardExperienceSurface(el);
      if (s) surfaces.push(s);
    }
  }
  const narrativeRaw = o.narrative ?? o.Narrative;
  let narrative: DashboardExperienceNarrativeBlock = {
    mode: null,
    tone: null,
    hero: null,
    heroStory: null,
    heroSubtitle: null,
    momentumCopy: null,
    narrativeTone: null,
    fatigueAdjusted: null,
  };
  if (narrativeRaw !== null && typeof narrativeRaw === 'object' && !Array.isArray(narrativeRaw)) {
    const n = narrativeRaw as Record<string, unknown>;
    const heroRaw = n.hero ?? n.Hero;
    const hero =
      heroRaw !== null && typeof heroRaw === 'object' && !Array.isArray(heroRaw)
        ? (() => {
            const h = heroRaw as Record<string, unknown>;
            return {
              primaryStatement: pickStrOrNull(h, 'primaryStatement', 'primary_statement'),
              supportingReason: pickStrOrNull(h, 'supportingReason', 'supporting_reason'),
              emotionalTone: pickStrOrNull(h, 'emotionalTone', 'emotional_tone'),
              expectedOutcome: pickStrOrNull(h, 'expectedOutcome', 'expected_outcome'),
            } satisfies HeroNarrativePayload;
          })()
        : null;
    narrative = {
      mode: pickStrOrNull(n, 'mode'),
      tone: pickStrOrNull(n, 'tone'),
      hero,
      heroStory: pickStrOrNull(n, 'heroStory', 'hero_story'),
      heroSubtitle: pickStrOrNull(n, 'heroSubtitle', 'hero_subtitle'),
      momentumCopy: pickStrOrNull(n, 'momentumCopy', 'momentum_copy'),
      narrativeTone: pickStrOrNull(n, 'narrativeTone', 'narrative_tone'),
      fatigueAdjusted:
        typeof n.fatigueAdjusted === 'boolean'
          ? n.fatigueAdjusted
          : typeof n.fatigue_adjusted === 'boolean'
            ? n.fatigue_adjusted
            : null,
    };
  }
  const visibleRecs = pickOrchestratedRecommendations(o.visibleRecommendations ?? o.visible_recommendations);
  let visibleRecommendationIds = pickStrArray(o.visibleRecommendationIds ?? o.visible_recommendation_ids);
  if (visibleRecommendationIds.length === 0 && visibleRecs.length > 0) {
    visibleRecommendationIds = visibleRecs
      .map((r) => (r.recommendationId ?? '').trim())
      .filter(Boolean);
  }
  const suppressedRecommendationIds = pickStrArray(
    o.suppressedRecommendationIds ?? o.suppressed_recommendation_ids,
  );
  const pipelineRaw = o.pipelineSnapshot ?? o.pipeline_snapshot;
  let pipelineSnapshot: ExperiencePipelineSnapshot | null = null;
  if (pipelineRaw !== null && typeof pipelineRaw === 'object' && !Array.isArray(pipelineRaw)) {
    const p = pipelineRaw as Record<string, unknown>;
    const snap: ExperiencePipelineSnapshot = {
      interviewing: pickNumOrNull(p, 'interviewing'),
      waiting: pickNumOrNull(p, 'waiting'),
      followUpNeeded: pickNumOrNull(p, 'followUpNeeded', 'follow_up_needed'),
      newMatchesSinceVisit: pickNumOrNull(p, 'newMatchesSinceVisit', 'new_matches_since_visit'),
    };
    // Copy through any extra numeric metrics (e.g. interviewsUpcoming7d, stalledApplied, etc.)
    for (const [k, v] of Object.entries(p)) {
      if (k in snap) continue;
      if (typeof v === 'number' && Number.isFinite(v)) snap[k] = v;
      else if (v === null) snap[k] = null;
    }
    pipelineSnapshot = snap;
  }
  const version =
    typeof o.version === 'number' && Number.isFinite(o.version) ? Math.max(0, Math.floor(o.version)) : 0;
  const fatigue =
    o.fatigue !== null && typeof o.fatigue === 'object' && !Array.isArray(o.fatigue)
      ? (o.fatigue as Record<string, unknown>)
      : null;

  const hasPayload =
    version >= 1 ||
    surfaces.length > 0 ||
    visibleRecs.length > 0 ||
    visibleRecommendationIds.length > 0 ||
    Boolean(narrative.heroStory?.trim() || narrative.momentumCopy?.trim());
  if (!hasPayload) return null;

  return {
    version: version || 1,
    narrative,
    surfaces,
    visibleRecommendationIds,
    visibleRecommendations: visibleRecs,
    suppressedRecommendationIds,
    pipelineSnapshot,
    fatigue,
  };
}

function pickDashboardNarrative(raw: unknown): DashboardNarrativePayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    heroRecommendationId: pickStrOrNull(o, 'heroRecommendationId', 'hero_recommendation_id'),
    continuationRecommendationId: pickStrOrNull(
      o,
      'continuationRecommendationId',
      'continuation_recommendation_id',
    ),
    arcLabel: pickStrOrNull(o, 'arcLabel', 'arc_label'),
    heroStory: pickStrOrNull(o, 'heroStory', 'hero_story'),
    heroSubtitle: pickStrOrNull(o, 'heroSubtitle', 'hero_subtitle'),
    momentumCopy: pickStrOrNull(o, 'momentumCopy', 'momentum_copy'),
    narrativeTone: pickStrOrNull(o, 'narrativeTone', 'narrative_tone'),
    strategicMode: pickStrOrNull(o, 'strategicMode', 'strategic_mode'),
  };
}

function pickResumeTarget(raw: unknown): ResumeTargetPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const resumeStateRaw = o.resumeState ?? o.resume_state;
  const resumeState =
    resumeStateRaw !== null && typeof resumeStateRaw === 'object' && !Array.isArray(resumeStateRaw)
      ? (() => {
          const rs = resumeStateRaw as Record<string, unknown>;
          const snapRaw = rs.snapshot ?? rs.state_snapshot;
          const snap =
            snapRaw !== null && typeof snapRaw === 'object' && !Array.isArray(snapRaw)
              ? (snapRaw as Record<string, unknown>)
              : null;
          return {
            ...rs,
            evaluationStatus:
              rs.evaluationStatus ??
              rs.evaluation_status ??
              snap?.evaluationStatus ??
              snap?.evaluation_status,
            resultsPath:
              rs.resultsPath ??
              rs.results_path ??
              snap?.resultsPath ??
              snap?.results_path,
          } as Record<string, unknown>;
        })()
      : null;
  const conf = pickOptionalScore(o, 'resumeConfidence', 'resume_confidence');
  const pct = pickOptionalScore(o, 'percentComplete', 'percent_complete');
  const estMinRaw =
    typeof o.estimatedRemainingMinutes === 'number' && Number.isFinite(o.estimatedRemainingMinutes)
      ? o.estimatedRemainingMinutes
      : typeof o.estimated_remaining_minutes === 'number' && Number.isFinite(o.estimated_remaining_minutes)
        ? o.estimated_remaining_minutes
        : null;
  const continuationContextRaw = o.continuationContext ?? o.continuation_context;
  const continuationContext =
    continuationContextRaw !== null && typeof continuationContextRaw === 'object' && !Array.isArray(continuationContextRaw)
      ? (() => {
          const c = continuationContextRaw as Record<string, unknown>;
          const idxRaw = c.exactStepIndex ?? c.exact_step_index;
          const totalRaw = c.totalSteps ?? c.total_steps;
          return {
            taskLabel: pickStrOrNull(c, 'taskLabel', 'task_label'),
            detailedSummary: pickStrOrNull(c, 'detailedSummary', 'detailed_summary'),
            exactStepLabel: pickStrOrNull(c, 'exactStepLabel', 'exact_step_label'),
            exactStepIndex:
              typeof idxRaw === 'number' && Number.isFinite(idxRaw) ? Math.max(0, Math.round(idxRaw)) : null,
            totalSteps:
              typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? Math.max(0, Math.round(totalRaw)) : null,
            completionPercent: pickOptionalScore(c, 'completionPercent', 'completion_percent'),
            roleTitle: pickStrOrNull(c, 'roleTitle', 'role_title', 'jobTitle', 'job_title'),
            companyName: pickStrOrNull(c, 'companyName', 'company_name', 'company'),
          } satisfies ContinuationContextPayload;
        })()
      : null;
  return {
    title: pickStrOrNull(o, 'title'),
    continuationSource: pickStrOrNull(o, 'continuationSource', 'continuation_source'),
    workflowEntityId: pickStrOrNull(o, 'workflowEntityId', 'workflow_entity_id'),
    workflowEntityType: pickStrOrNull(o, 'workflowEntityType', 'workflow_entity_type'),
    executionType: pickStrOrNull(o, 'executionType', 'execution_type'),
    resumeTarget: pickStrOrNull(o, 'resumeTarget', 'resume_target'),
    resumeComponent: pickStrOrNull(o, 'resumeComponent', 'resume_component'),
    resumeState,
    resumeIntent: pickStrOrNull(o, 'resumeIntent', 'resume_intent'),
    resumeConfidence: conf,
    estimatedRemainingMinutes:
      typeof estMinRaw === 'number' && Number.isFinite(estMinRaw) ? Math.max(0, Math.round(estMinRaw)) : null,
    percentComplete: pct,
    hydrationConsistencyKey: pickStrOrNull(o, 'hydrationConsistencyKey', 'hydration_consistency_key'),
    continuationContext,
  };
}

function pickExperienceStability(raw: unknown): ExperienceStabilityPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const experienceReady = o.experienceReady === true || o.experience_ready === true;
  const stableRaw = o.stable ?? o.experience_stable;
  const stable = stableRaw === true ? true : stableRaw === false ? false : null;
  return {
    stable,
    experienceReady,
    stableHeroCandidateId: pickStrOrNull(o, 'stableHeroCandidateId', 'stable_hero_candidate_id'),
    hydrationConsistencyKey: pickStrOrNull(o, 'hydrationConsistencyKey', 'hydration_consistency_key'),
  };
}

function pickAssistantState(raw: unknown): AssistantStatePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const daysRaw = o.daysInArc ?? o.days_in_arc;
  const daysInArc =
    typeof daysRaw === 'number' && Number.isFinite(daysRaw)
      ? Math.max(0, Math.round(daysRaw))
      : typeof daysRaw === 'string' && daysRaw.trim() && Number.isFinite(Number(daysRaw))
        ? Math.max(0, Math.round(Number(daysRaw)))
        : null;
  return {
    narrativeArc: pickStrOrNull(o, 'narrativeArc', 'narrative_arc'),
    daysInArc,
    confidenceTrend: pickStrOrNull(o, 'confidenceTrend', 'confidence_trend'),
    momentumState: pickStrOrNull(o, 'momentumState', 'momentum_state'),
    fatigueLevel: pickStrOrNull(o, 'fatigueLevel', 'fatigue_level'),
  };
}

function pickBehaviorSignals(raw: unknown): Record<string, number> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function pickAdaptiveReasoning(raw: unknown): AdaptiveReasoningPayload[] {
  if (!Array.isArray(raw)) return [];
  const items: AdaptiveReasoningPayload[] = [];
  for (const el of raw) {
    if (el === null || typeof el !== 'object' || Array.isArray(el)) continue;
    const o = el as Record<string, unknown>;
    const signal = pickStr(o, 'signal') ?? '';
    const effect = pickStr(o, 'effect') ?? '';
    if (!signal.trim() || !effect.trim()) continue;
    items.push({ signal: signal.trim(), effect: effect.trim() });
  }
  return items;
}

function pickHeroStability(raw: unknown): HeroStabilityPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const stableRaw = o.stable ?? o.heroStable ?? o.hero_stable;
  const stable = stableRaw === true ? true : stableRaw === false ? false : null;
  return {
    stable,
    heroCommitId: pickStrOrNull(o, 'heroCommitId', 'hero_commit_id'),
    heroStableUntilIso: pickStrOrNull(o, 'heroStableUntilIso', 'hero_stable_until_iso', 'heroStableUntil', 'hero_stable_until'),
    heroReason: pickStrOrNull(o, 'heroReason', 'hero_reason'),
  };
}

function pickExperienceState(raw: unknown): ExperienceStatePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const stableRaw = o.stable ?? o.experienceStable ?? o.experience_stable;
  const stable = stableRaw === true ? true : stableRaw === false ? false : null;
  return {
    stable,
    committedAt: pickStrOrNull(o, 'committedAt', 'committed_at'),
    narrativeArc: pickStrOrNull(o, 'narrativeArc', 'narrative_arc'),
    narrativeFocusLabel: pickStrOrNull(o, 'narrativeFocusLabel', 'narrative_focus_label'),
  };
}

function pickAssistantNarrative(raw: unknown): AssistantNarrativePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const headline = pickStrOrNull(o, 'headline');
  const supporting = pickStrOrNull(o, 'supporting');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const ctaValidated = pickBoolOrNull(o, 'ctaValidated', 'cta_validated');
  const ctaSource = pickStrOrNull(o, 'ctaSource', 'cta_source');
  const microcopy = pickStrOrNull(o, 'microcopy');
  const tone = pickStrOrNull(o, 'tone');
  const suppressGuidanceCard = pickBoolOrNull(o, 'suppressGuidanceCard', 'suppress_guidance_card');
  if (
    !headline &&
    !supporting &&
    !ctaLabel &&
    !ctaHref &&
    ctaValidated == null &&
    !ctaSource &&
    !microcopy &&
    !tone &&
    suppressGuidanceCard == null
  )
    return null;
  return {
    headline,
    supporting,
    ctaLabel,
    ctaHref,
    ctaValidated,
    ctaSource,
    microcopy,
    tone,
    suppressGuidanceCard,
  };
}

function pickOpportunityDetection(raw: unknown): OpportunityDetectionPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const headline = pickStrOrNull(o, 'headline');
  const supporting = pickStrOrNull(o, 'supporting');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const reasonRaw = pickStrOrNull(o, 'reason', 'rationale');
  const reason = (() => {
    const r = String(reasonRaw ?? '').trim().toLowerCase();
    if (!r) return null;
    const allowed = new Set<string>([
      'high_match_not_applied',
      'draft_ready',
      'saved_high_fit',
      'deadline_soon',
      'most_advanced',
    ]);
    return allowed.has(r) ? (r as OpportunityDetectionReason) : null;
  })();
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');

  if (!headline && !supporting && !ctaLabel && !ctaHref && !reason && confidence == null) {
    return null;
  }
  return {
    headline,
    supporting,
    ctaLabel,
    ctaHref,
    confidence,
    reason,
  };
}

function pickFollowUpIntelligence(raw: unknown): FollowUpIntelligencePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const headline = pickStrOrNull(o, 'headline');
  const supporting = pickStrOrNull(o, 'supporting');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const reasonRaw = pickStrOrNull(o, 'reason', 'rationale');
  const reason = (() => {
    const r = String(reasonRaw ?? '').trim().toLowerCase();
    if (!r) return null;
    const allowed = new Set<string>([
      'ideal_followup_window',
      'overdue_followup',
      'high_match_waiting',
      'interview_followup',
    ]);
    return allowed.has(r) ? (r as FollowUpIntelligenceReason) : null;
  })();
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');

  const companyName = pickStrOrNull(
    o,
    'companyName',
    'company_name',
    'company',
    'employerName',
    'employer_name',
    'organizationName',
    'organization_name',
  );
  const jobTitle = pickStrOrNull(
    o,
    'jobTitle',
    'job_title',
    'roleTitle',
    'role_title',
    'positionTitle',
    'position_title',
  );
  const coachingStage = pickStrOrNull(o, 'coachingStage', 'coaching_stage');

  const daysRaw =
    o.daysSinceApplication ??
    o.days_since_application ??
    o.daysSince ??
    o.days_since;
  let daysSinceApplication: number | null = null;
  if (typeof daysRaw === 'number' && Number.isFinite(daysRaw)) {
    daysSinceApplication = Math.max(0, Math.round(daysRaw));
  } else if (typeof daysRaw === 'string' && daysRaw.trim() && Number.isFinite(Number(daysRaw))) {
    daysSinceApplication = Math.max(0, Math.round(Number(daysRaw)));
  }

  if (
    !headline?.trim() &&
    !supporting?.trim() &&
    !ctaLabel?.trim() &&
    !ctaHref?.trim() &&
    reason == null &&
    confidence == null &&
    daysSinceApplication == null &&
    !companyName?.trim() &&
    !jobTitle?.trim() &&
    !coachingStage?.trim()
  ) {
    return null;
  }
  return {
    headline,
    supporting,
    ctaLabel,
    ctaHref,
    confidence,
    daysSinceApplication,
    reason,
    companyName,
    jobTitle,
    coachingStage,
  };
}

function pickFollowUpJobSource(raw: string | null | undefined): FollowUpJobSource | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'application' || s === 'bookmark' || s === 'analysis') return s;
  return null;
}

function pickFollowUpJobRow(raw: unknown): FollowUpJobRowPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = String(pickStrOrNull(o, 'id', 'jobId', 'job_id') ?? '').trim();
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  if (!id && !ctaHref?.trim()) return null;

  const daysRaw =
    o.daysSinceApplication ?? o.days_since_application ?? o.daysSince ?? o.days_since;
  let daysSinceApplication: number | null = null;
  if (typeof daysRaw === 'number' && Number.isFinite(daysRaw)) {
    daysSinceApplication = Math.max(0, Math.round(daysRaw));
  } else if (typeof daysRaw === 'string' && daysRaw.trim() && Number.isFinite(Number(daysRaw))) {
    daysSinceApplication = Math.max(0, Math.round(Number(daysRaw)));
  }

  return {
    id: id || ctaHref || 'follow-up-job',
    source: pickFollowUpJobSource(pickStrOrNull(o, 'source', 'kind', 'type')),
    coachingStage: pickStrOrNull(o, 'coachingStage', 'coaching_stage'),
    headline: pickStrOrNull(o, 'headline', 'title'),
    supporting: pickStrOrNull(o, 'supporting', 'supporting_copy', 'body'),
    ctaLabel,
    ctaHref,
    confidence: pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score'),
    daysSinceApplication,
    reason: pickStrOrNull(o, 'reason', 'rationale'),
    applicationId: pickStrOrNull(o, 'applicationId', 'application_id'),
    jobAnalysisId: pickStrOrNull(o, 'jobAnalysisId', 'job_analysis_id'),
    jobListingId: pickStrOrNull(o, 'jobListingId', 'job_listing_id', 'listingId', 'listing_id'),
    bookmarkId: pickStrOrNull(o, 'bookmarkId', 'bookmark_id', 'hubBookmarkId', 'hub_bookmark_id'),
    companyName: pickStrOrNull(
      o,
      'companyName',
      'company_name',
      'company',
      'employerName',
      'employer_name',
    ),
    companyLogoUrl: pickCompanyLogoUrl(o),
    jobTitle: pickStrOrNull(o, 'jobTitle', 'job_title', 'roleTitle', 'role_title', 'positionTitle', 'position_title'),
  };
}

function pickFollowUpJobsArray(raw: unknown): FollowUpJobRowPayload[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) return [];
  const out: FollowUpJobRowPayload[] = [];
  for (const row of raw) {
    const picked = pickFollowUpJobRow(row);
    if (picked) out.push(picked);
    if (out.length >= 50) break;
  }
  return out;
}

function pickFollowUpJobsTotalCount(body: Record<string, unknown>): number | null {
  const raw = body.followUpJobsTotalCount ?? body.follow_up_jobs_total_count;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Math.max(0, Math.round(Number(raw)));
  return null;
}

function pickFollowUpJobsViewAllHref(body: Record<string, unknown>): string | null {
  const raw = body.followUpJobsViewAllHref ?? body.follow_up_jobs_view_all_href;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return s || null;
}

function pickAdaptiveCoaching(raw: unknown): AdaptiveCoachingPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'supporting_copy', 'body');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');

  const priorityRaw = o.priority ?? o.priority_tier;
  let priority: number | null = null;
  if (typeof priorityRaw === 'number' && Number.isFinite(priorityRaw)) {
    priority = Math.round(priorityRaw);
  } else if (typeof priorityRaw === 'string' && priorityRaw.trim() && Number.isFinite(Number(priorityRaw))) {
    priority = Math.round(Number(priorityRaw));
  }

  const categoryRaw = pickStrOrNull(o, 'category', 'coaching_category');
  const category = (() => {
    const c = String(categoryRaw ?? '').trim().toLowerCase();
    if (!c) return null;
    const allowed = new Set<string>([
      'interview_momentum',
      'application_acceleration',
      'follow_up_opportunity',
      'cv_strengthening',
      'pipeline_recovery',
      'confidence_boost',
    ]);
    return allowed.has(c) ? (c as AdaptiveCoachingCategory) : null;
  })();

  const reasonStr = pickStr(o, 'reason', 'reason_code') ?? null;

  if (!headline && !supporting && !ctaLabel && !ctaHref && priority == null && category == null && !reasonStr) {
    return null;
  }
  return {
    headline,
    supporting,
    ctaLabel,
    ctaHref,
    priority,
    category,
    reason: reasonStr,
  };
}

function pickStrategicRecommendationRationale(raw: unknown): StrategicRecommendationRationalePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const matchScore = pickOptionalScore(o, 'matchScore', 'match_score');
  const daysUntilInterview = pickNonNegIntOrNull(o, 'daysUntilInterview', 'days_until_interview');
  const daysSinceLastActivity = pickNonNegIntOrNull(o, 'daysSinceLastActivity', 'days_since_last_activity');
  const cvScore = pickOptionalScore(o, 'cvScore', 'cv_score');
  const applicationsInProgress = pickNonNegIntOrNull(
    o,
    'applicationsInProgress',
    'applications_in_progress',
  );

  if (
    matchScore == null &&
    daysUntilInterview == null &&
    daysSinceLastActivity == null &&
    cvScore == null &&
    applicationsInProgress == null
  ) {
    return null;
  }
  return {
    matchScore,
    daysUntilInterview,
    daysSinceLastActivity,
    cvScore,
    applicationsInProgress,
  };
}

function pickStrategicRecommendation(raw: unknown): StrategicRecommendationPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'supporting_copy', 'body');
  const reasoning = pickStrOrNull(o, 'reasoning', 'rationale_explanation', 'explanation');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');

  const impactRaw = pickStrOrNull(o, 'expectedImpact', 'expected_impact', 'impact');
  const expectedImpact = (() => {
    const s = String(impactRaw ?? '').trim().toLowerCase();
    if (!s) return null;
    const map: Record<string, StrategicRecommendationImpact> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      very_high: 'very_high',
      veryhigh: 'very_high',
      'very high': 'very_high',
    };
    return map[s] ?? null;
  })();

  const categoryRaw = pickStrOrNull(o, 'category', 'recommendation_category');
  const category = (() => {
    const c = String(categoryRaw ?? '').trim().toLowerCase();
    if (!c) return null;
    const allowed = new Set<string>([
      'apply',
      'interview',
      'follow_up',
      'cv_improvement',
      'job_analysis',
    ]);
    return allowed.has(c) ? (c as StrategicRecommendationCategory) : null;
  })();

  const rationalePayload = pickStrategicRecommendationRationale(
    o.rationale ?? o.rationale_metrics ?? o.decision_rationale,
  );

  if (!headline && !supporting && !reasoning && !ctaLabel && !ctaHref && confidence == null && !expectedImpact && !category) {
    return null;
  }
  return {
    headline,
    supporting,
    reasoning,
    ctaLabel,
    ctaHref,
    confidence,
    expectedImpact,
    category,
    rationale: rationalePayload,
  };
}

function pickStringArrayFromRecord(o: Record<string, unknown>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = o[k];
    if (!Array.isArray(v)) continue;
    return v
      .filter((el): el is string => typeof el === 'string' && el.trim().length > 0)
      .map((s) => s.trim());
  }
  return [];
}

function pickCareerGoalProfile(raw: unknown): CareerGoalProfilePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const targetRoles = pickStringArrayFromRecord(o, 'targetRoles', 'target_roles');
  const preferredCompanies = pickStringArrayFromRecord(o, 'preferredCompanies', 'preferred_companies');
  const preferredIndustries = pickStringArrayFromRecord(o, 'preferredIndustries', 'preferred_industries');
  const targetLocations = pickStringArrayFromRecord(o, 'targetLocations', 'target_locations');
  const technologies = pickStringArrayFromRecord(o, 'technologies', 'tech', 'technology_stack');

  const remoteRaw = pickStrOrNull(o, 'remotePreference', 'remote_preference');
  const remotePreference = (() => {
    const s = String(remoteRaw ?? '').trim().toLowerCase();
    if (!s) return null;
    const allowed = new Set<string>(['remote', 'hybrid', 'onsite', 'flexible']);
    return allowed.has(s) ? (s as CareerGoalRemotePreference) : null;
  })();

  const salaryMin = pickNonNegIntOrNull(o, 'salaryMin', 'salary_min');
  const salaryTarget = pickNonNegIntOrNull(o, 'salaryTarget', 'salary_target');

  const seniorityRaw = pickStrOrNull(o, 'seniorityGoal', 'seniority_goal');
  const seniorityGoal = (() => {
    const s = String(seniorityRaw ?? '').trim().toLowerCase();
    if (!s) return null;
    const allowed = new Set<string>(['mid', 'senior', 'staff', 'principal', 'executive']);
    return allowed.has(s) ? (s as CareerGoalSeniority) : null;
  })();

  const timelineGoal = pickStrOrNull(o, 'timelineGoal', 'timeline_goal', 'job_search_timeline');

  const hasAny =
    targetRoles.length > 0 ||
    preferredCompanies.length > 0 ||
    preferredIndustries.length > 0 ||
    targetLocations.length > 0 ||
    technologies.length > 0 ||
    remotePreference != null ||
    salaryMin != null ||
    salaryTarget != null ||
    seniorityGoal != null ||
    Boolean(timelineGoal?.trim());

  if (!hasAny) return null;
  return {
    targetRoles,
    preferredCompanies,
    preferredIndustries,
    targetLocations,
    remotePreference,
    technologies,
    salaryMin,
    salaryTarget,
    seniorityGoal,
    timelineGoal,
  };
}

function pickGoalAlignment(raw: unknown): GoalAlignmentPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const score = pickOptionalScore(o, 'score', 'alignmentScore', 'alignment_score');
  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'supporting_copy', 'body');
  const strongestSignals = pickStringArrayFromRecord(o, 'strongestSignals', 'strongest_signals');
  const gapSignals = pickStringArrayFromRecord(o, 'gapSignals', 'gap_signals');

  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href');

  if (score == null && !headline && !supporting && strongestSignals.length === 0 && gapSignals.length === 0) {
    return null;
  }
  return {
    score,
    headline,
    supporting,
    strongestSignals,
    gapSignals,
    ctaLabel,
    ctaHref,
  };
}

function pickGoalStrategicCoaching(raw: unknown): GoalStrategicCoachingPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'supporting_copy', 'body');
  const recommendation = pickStrOrNull(o, 'recommendation', 'recommended_action');
  const reasoning = pickStrOrNull(o, 'reasoning', 'rationale');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');

  const horizonRaw = pickStrOrNull(o, 'timeHorizon', 'time_horizon', 'horizon');
  const timeHorizon = (() => {
    const s = String(horizonRaw ?? '').trim().toLowerCase().replace(/-/g, '_');
    if (!s) return null;
    const map: Record<string, GoalStrategicCoachingTimeHorizon> = {
      today: 'today',
      this_week: 'this_week',
      thisweek: 'this_week',
      this_month: 'this_month',
      thismonth: 'this_month',
      quarter: 'quarter',
    };
    return map[s] ?? null;
  })();

  if (!headline && !supporting && !recommendation && !reasoning && !ctaLabel && !ctaHref && confidence == null && !timeHorizon) {
    return null;
  }
  return {
    headline,
    supporting,
    recommendation,
    reasoning,
    confidence,
    timeHorizon,
    ctaLabel,
    ctaHref,
  };
}

function pickPriorityIntelligenceMeta(raw: unknown): PriorityIntelligenceMetaPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const urgencyRaw = pickStrOrNull(o, 'urgencyLevel', 'urgency_level');
  const urgencyLevel =
    urgencyRaw && urgencyRaw.trim() ? urgencyRaw.trim().toLowerCase() : null;
  const promoteRaw = o.promoteToTop ?? o.promote_to_top;
  const promoteToTop =
    promoteRaw === true ? true : promoteRaw === false ? false : null;
  if (!urgencyLevel && promoteToTop == null) return null;
  return { urgencyLevel, promoteToTop };
}

function pickDashboardLayoutConfig(raw: unknown): DashboardLayoutConfigPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const priorityCards = pickStringArrayFromRecord(o, 'priorityCards', 'priority_cards');
  const secondaryCards = pickStringArrayFromRecord(o, 'secondaryCards', 'secondary_cards');
  const hiddenCards = pickStringArrayFromRecord(o, 'hiddenCards', 'hidden_cards');
  const collapsibleCards = pickStringArrayFromRecord(o, 'collapsibleCards', 'collapsible_cards');

  const mergeRaw =
    o.mergeLandscapeIntoPipeline ??
    o.merge_landscape_into_pipeline ??
    o.mergeLandscapeIntoSearchAtAGlance ??
    o.merge_landscape_into_search_at_a_glance;

  let mergeLandscapeIntoPipeline: boolean | null = null;
  if (mergeRaw === true || mergeRaw === 'true') mergeLandscapeIntoPipeline = true;
  else if (mergeRaw === false || mergeRaw === 'false') mergeLandscapeIntoPipeline = false;

  const suppressRaw = o.suppressInsightGuidance ?? o.suppress_insight_guidance;
  let suppressInsightGuidance: boolean | null = null;
  if (suppressRaw === true || suppressRaw === 'true') suppressInsightGuidance = true;
  else if (suppressRaw === false || suppressRaw === 'false') suppressInsightGuidance = false;

  return {
    priorityCards,
    secondaryCards,
    hiddenCards,
    collapsibleCards,
    mergeLandscapeIntoPipeline,
    suppressInsightGuidance,
  };
}

function pickHabitProgress(raw: unknown): HabitProgressPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const currentStreakDays = pickNonNegIntOrNull(o, 'currentStreakDays', 'current_streak_days');
  const longestStreakDays = pickNonNegIntOrNull(o, 'longestStreakDays', 'longest_streak_days');
  const activeDaysThisWeek = pickNonNegIntOrNull(o, 'activeDaysThisWeek', 'active_days_this_week');
  const activeDaysThisMonth = pickNonNegIntOrNull(o, 'activeDaysThisMonth', 'active_days_this_month');
  const consistencyScore = pickOptionalScore(o, 'consistencyScore', 'consistency_score');
  const encouragement = pickStrOrNull(o, 'encouragement', 'encouragement_copy');

  const streakRaw = pickStrOrNull(o, 'streakStatus', 'streak_status');
  const streakStatus = (() => {
    const s = String(streakRaw ?? '').trim().toLowerCase();
    if (!s) return null;
    const allowed = new Set<string>(['starting', 'building', 'strong', 'elite']);
    return allowed.has(s) ? (s as HabitStreakStatusBand) : null;
  })();

  if (
    currentStreakDays == null &&
    longestStreakDays == null &&
    activeDaysThisWeek == null &&
    activeDaysThisMonth == null &&
    consistencyScore == null &&
    streakStatus == null &&
    !encouragement
  ) {
    return null;
  }
  return {
    currentStreakDays,
    longestStreakDays,
    activeDaysThisWeek,
    activeDaysThisMonth,
    consistencyScore,
    streakStatus,
    encouragement,
  };
}

function pickRecommendedMove(raw: unknown): RecommendedMovePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'body', 'message');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const source = pickStrOrNull(o, 'source');
  const category = pickStrOrNull(o, 'category');
  const sigRaw = o.confidence ?? o.actionSignal ?? o.action_signal ?? o.signal;
  let confidence: number | null = null;
  if (typeof sigRaw === 'number' && Number.isFinite(sigRaw)) {
    confidence = Math.min(100, Math.max(0, Math.round(sigRaw)));
  } else if (typeof sigRaw === 'string' && sigRaw.trim() && Number.isFinite(Number(sigRaw))) {
    confidence = Math.min(100, Math.max(0, Math.round(Number(sigRaw))));
  }
  const prRaw = o.priority;
  let priority: number | null = null;
  if (typeof prRaw === 'number' && Number.isFinite(prRaw)) {
    priority = Math.min(100, Math.max(0, Math.round(prRaw)));
  } else if (typeof prRaw === 'string' && prRaw.trim() && Number.isFinite(Number(prRaw))) {
    priority = Math.min(100, Math.max(0, Math.round(Number(prRaw))));
  }
  if (!headline?.trim() || !ctaLabel?.trim() || !ctaHref?.trim()) return null;
  const relevantActivityAt = pickStrOrNull(o, 'relevantActivityAt', 'relevant_activity_at');
  const relevantActivityLabel = pickStrOrNull(
    o,
    'relevantActivityLabel',
    'relevant_activity_label',
  );
  return {
    source,
    headline,
    supporting,
    confidence,
    priority,
    category,
    ctaLabel,
    ctaHref,
    ...(relevantActivityAt ? { relevantActivityAt } : {}),
    ...(relevantActivityLabel ? { relevantActivityLabel } : {}),
  };
}

function pickCareerAchievementRarity(raw: unknown): TodayPlanAchievementRarity | null {
  const r = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!r) return null;
  const allowed = new Set<string>(['common', 'rare', 'epic', 'legendary']);
  return allowed.has(r) ? (r as TodayPlanAchievementRarity) : null;
}

/** Recent win row: full achievement shape, or legacy win-shaped objects. */
function pickCareerRecentWinAchievement(raw: unknown): TodayPlanAchievementPayload | null {
  const row = pickTodayPlanAchievementItem(raw);
  if (row?.title?.trim()) return row;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = pickStrOrNull(o, 'title', 'headline', 'name', 'label');
  if (!title?.trim()) return null;
  return {
    key: pickStrOrNull(o, 'key', 'id'),
    title,
    description: pickStrOrNull(o, 'description', 'subtitle', 'supporting', 'body'),
    earnedAt: pickStrOrNull(o, 'earnedAt', 'earned_at', 'unlockedAt', 'unlocked_at'),
    category: null,
    rarity: pickCareerAchievementRarity(o.rarity ?? o.tier),
  };
}

function pickCareerAchievementsLevel(o: Record<string, unknown>): CareerAchievementsLevelPayload | null {
  const nested = o.level;
  if (nested !== null && nested !== undefined && typeof nested === 'object' && !Array.isArray(nested)) {
    const L = nested as Record<string, unknown>;
    const numRaw = L.number ?? L.level;
    let number: number | null = null;
    if (typeof numRaw === 'number' && Number.isFinite(numRaw)) number = Math.max(0, Math.round(numRaw));
    else if (typeof numRaw === 'string' && numRaw.trim() && Number.isFinite(Number(numRaw)))
      number = Math.max(0, Math.round(Number(numRaw)));
    const title = pickStrOrNull(L, 'title', 'name', 'label');
    if (number != null || title?.trim()) return { number, title: title?.trim() ?? null };
  }
  if (typeof nested === 'number' && Number.isFinite(nested)) {
    return {
      number: Math.max(0, Math.round(nested)),
      title: pickStrOrNull(o, 'levelTitle', 'level_title', 'rankTitle', 'rank_title'),
    };
  }
  if (typeof nested === 'string' && nested.trim() && Number.isFinite(Number(nested))) {
    return {
      number: Math.max(0, Math.round(Number(nested))),
      title: pickStrOrNull(o, 'levelTitle', 'level_title', 'rankTitle', 'rank_title'),
    };
  }
  const onlyTitle = pickStrOrNull(o, 'levelTitle', 'level_title', 'rankTitle', 'rank_title');
  if (onlyTitle?.trim()) return { number: null, title: onlyTitle.trim() };
  return null;
}

function pickCareerAchievementsSummary(o: Record<string, unknown>): CareerAchievementsSummaryPayload | null {
  const raw = o.summary;
  if (raw !== null && raw !== undefined && typeof raw === 'object' && !Array.isArray(raw)) {
    const s = raw as Record<string, unknown>;
    const totalUnlocked = pickNonNegIntOrNull(s, 'totalUnlocked', 'total_unlocked');
    const rareCount = pickNonNegIntOrNull(s, 'rareCount', 'rare_count');
    const epicCount = pickNonNegIntOrNull(s, 'epicCount', 'epic_count');
    const legendaryCount = pickNonNegIntOrNull(s, 'legendaryCount', 'legendary_count');
    if (
      totalUnlocked != null ||
      rareCount != null ||
      epicCount != null ||
      legendaryCount != null
    ) {
      return { totalUnlocked, rareCount, epicCount, legendaryCount };
    }
  }
  const unlockedBadgeCount = pickNonNegIntOrNull(o, 'unlockedBadgeCount', 'unlocked_badge_count', 'badgesUnlocked');
  const rareBadgeCount = pickNonNegIntOrNull(o, 'rareBadgeCount', 'rare_badge_count', 'rareCount');
  if (unlockedBadgeCount != null || rareBadgeCount != null) {
    return {
      totalUnlocked: unlockedBadgeCount,
      rareCount: rareBadgeCount,
      epicCount: null,
      legendaryCount: null,
    };
  }
  return null;
}

function pickCareerExperiencePoints(o: Record<string, unknown>): CareerAchievementsExperiencePointsPayload | null {
  const raw = o.experiencePoints ?? o.experience_points;
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const current = pickNonNegIntOrNull(e, 'current', 'xp', 'value');
  const nextRaw = e.nextLevelAt ?? e.next_level_at ?? e.target;
  let nextLevelAt: number | null = null;
  if (typeof nextRaw === 'number' && Number.isFinite(nextRaw)) nextLevelAt = Math.max(0, Math.round(nextRaw));
  else if (typeof nextRaw === 'string' && nextRaw.trim() && Number.isFinite(Number(nextRaw)))
    nextLevelAt = Math.max(0, Math.round(Number(nextRaw)));
  if (current != null || nextLevelAt != null) return { current, nextLevelAt };
  return null;
}

function pickCareerAlmostUnlockedItem(raw: unknown): CareerAchievementAlmostPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = pickStrOrNull(o, 'title', 'headline', 'name', 'label');
  if (!title?.trim()) return null;
  const key = pickStrOrNull(o, 'key', 'id');
  const description = pickStrOrNull(o, 'description', 'subtitle', 'supporting', 'body');
  const curRaw = o.progressCurrent ?? o.progress_current ?? o.current ?? o.progress ?? o.value ?? o.completed;
  const tgtRaw = o.progressTarget ?? o.progress_target ?? o.target ?? o.goal ?? o.required ?? o.total;
  let progressCurrent = 0;
  let progressTarget = 0;
  if (typeof curRaw === 'number' && Number.isFinite(curRaw)) progressCurrent = Math.max(0, Math.round(curRaw));
  else if (typeof curRaw === 'string' && curRaw.trim() && Number.isFinite(Number(curRaw)))
    progressCurrent = Math.max(0, Math.round(Number(curRaw)));
  if (typeof tgtRaw === 'number' && Number.isFinite(tgtRaw)) progressTarget = Math.max(1, Math.round(tgtRaw));
  else if (typeof tgtRaw === 'string' && tgtRaw.trim() && Number.isFinite(Number(tgtRaw)))
    progressTarget = Math.max(1, Math.round(Number(tgtRaw)));
  if (progressTarget < 1) return null;
  const remRaw = o.remaining;
  let remaining: number | null = null;
  if (typeof remRaw === 'number' && Number.isFinite(remRaw)) remaining = Math.max(0, Math.round(remRaw));
  else if (typeof remRaw === 'string' && remRaw.trim() && Number.isFinite(Number(remRaw)))
    remaining = Math.max(0, Math.round(Number(remRaw)));
  else if (progressTarget > progressCurrent) remaining = progressTarget - progressCurrent;
  return {
    key,
    title,
    description,
    progressCurrent,
    progressTarget,
    remaining,
    rarity: pickCareerAchievementRarity(o.rarity ?? o.tier),
  };
}

function pickCareerAchievements(raw: unknown): CareerAchievementsPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const winsRaw = o.recentWins ?? o.recent_wins ?? o.wins ?? o.recent;
  const recentWins: TodayPlanAchievementPayload[] = [];
  if (Array.isArray(winsRaw)) {
    for (const el of winsRaw) {
      const w = pickCareerRecentWinAchievement(el);
      if (w) recentWins.push(w);
    }
  }

  const mileRaw = o.almostUnlocked ?? o.almost_unlocked ?? o.upcomingMilestones ?? o.upcoming_milestones;
  const almostUnlocked: CareerAchievementAlmostPayload[] = [];
  if (Array.isArray(mileRaw)) {
    for (const el of mileRaw) {
      const m = pickCareerAlmostUnlockedItem(el);
      if (m) almostUnlocked.push(m);
    }
  }

  const level = pickCareerAchievementsLevel(o);
  const summary = pickCareerAchievementsSummary(o);
  const experiencePoints = pickCareerExperiencePoints(o);
  const viewAllHref = pickStrOrNull(o, 'viewAllHref', 'view_all_href');
  const legacyBadgeSummaryLine = pickStrOrNull(
    o,
    'badgeSummary',
    'badge_summary',
    'badgeSummaryLine',
    'badge_summary_line',
  );

  const hasAny =
    level != null ||
    summary != null ||
    recentWins.length > 0 ||
    almostUnlocked.length > 0 ||
    experiencePoints != null ||
    Boolean(legacyBadgeSummaryLine?.trim());
  if (!hasAny) return null;

  return {
    level,
    summary,
    recentWins,
    almostUnlocked,
    experiencePoints,
    viewAllHref,
    legacyBadgeSummaryLine,
  };
}

function pickTodayPlanAchievementItem(raw: unknown): TodayPlanAchievementPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const key = pickStrOrNull(o, 'key', 'id');
  const title = pickStrOrNull(o, 'title');
  const description = pickStrOrNull(o, 'description', 'body');
  const earnedAt = pickStrOrNull(o, 'earnedAt', 'earned_at');

  const categoryRaw = pickStrOrNull(o, 'category');
  const category = (() => {
    const c = String(categoryRaw ?? '').trim().toLowerCase();
    if (!c) return null;
    const allowed = new Set<string>([
      'analysis',
      'cv',
      'application',
      'interview',
      'streak',
      'milestone',
    ]);
    return allowed.has(c) ? (c as TodayPlanAchievementCategory) : null;
  })();

  const rarityRaw = pickStrOrNull(o, 'rarity');
  const rarity = (() => {
    const r = String(rarityRaw ?? '').trim().toLowerCase();
    if (!r) return null;
    const allowed = new Set<string>(['common', 'rare', 'epic', 'legendary']);
    return allowed.has(r) ? (r as TodayPlanAchievementRarity) : null;
  })();

  if (!key && !title && !description && !earnedAt && category == null && rarity == null) {
    return null;
  }
  return {
    key,
    title,
    description,
    earnedAt,
    category,
    rarity,
  };
}

function pickTodayPlanAchievementsFromBody(body: Record<string, unknown>): TodayPlanAchievementPayload[] | null {
  const raw = body.achievements ?? body.habit_achievements;
  if (raw === undefined) return null;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const out: TodayPlanAchievementPayload[] = [];
  for (const el of raw) {
    const item = pickTodayPlanAchievementItem(el);
    if (item) out.push(item);
  }
  return out;
}

function pickMilestoneCelebration(raw: unknown): MilestoneCelebrationPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const title = pickStrOrNull(o, 'title');
  const message = pickStrOrNull(o, 'message', 'body');
  const icon = pickStrOrNull(o, 'icon', 'emoji');

  if (!title && !message && !icon) return null;
  return {
    title,
    message,
    icon,
  };
}

function pickStrategicCoaching(raw: unknown): StrategicCoachingPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const headline = pickStrOrNull(o, 'headline');
  const supporting = pickStrOrNull(o, 'supporting');
  const ctaLabel = pickStrOrNull(o, 'ctaLabel', 'cta_label', 'label');
  const ctaHref = pickStrOrNull(o, 'ctaHref', 'cta_href', 'href', 'route', 'path');
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');
  const reasonRaw = pickStrOrNull(o, 'reason', 'rationale');
  const reason = (() => {
    const r = String(reasonRaw ?? '').trim().toLowerCase();
    if (!r) return null;
    const allowed = new Set<string>([
      'interview_focus',
      'cv_leverage',
      'follow_through',
      'pipeline_stalled',
      'opportunity_rich',
      'consistency_needed',
    ]);
    return allowed.has(r) ? (r as StrategicCoachingReason) : null;
  })();

  if (!headline && !supporting && !ctaLabel && !ctaHref && confidence == null && reason == null) {
    return null;
  }
  return {
    headline,
    supporting,
    ctaLabel,
    ctaHref,
    confidence,
    reason,
  };
}

function pickDeterministicIndexScore(raw: unknown): DeterministicIndexScorePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const value = pickOptionalScore(o, 'value', 'score', 'index');
  const label = pickStrOrNull(o, 'label');
  const type = pickStrOrNull(o, 'type', 'kind');
  const confidenceBand = pickStrOrNull(o, 'confidenceBand', 'confidence_band');
  const description = pickStrOrNull(o, 'description');
  const interpretation = pickStrOrNull(o, 'interpretation');
  const disclaimer = pickStrOrNull(o, 'disclaimer');

  if (
    value == null &&
    !label &&
    !type &&
    !confidenceBand &&
    !description &&
    !interpretation &&
    !disclaimer
  ) {
    return null;
  }
  return {
    value,
    label,
    type,
    confidenceBand,
    description,
    interpretation,
    disclaimer,
  };
}

function pickCareerMomentum(raw: unknown): CareerMomentumPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const score = pickOptionalScore(o, 'score', 'momentum_score');
  const momentumIndex = pickDeterministicIndexScore(o.momentumIndex ?? o.momentum_index);
  const tierRaw = pickStrOrNull(o, 'tier', 'momentum_tier');
  const tier = (() => {
    const t = String(tierRaw ?? '').trim().toLowerCase();
    const allowed = new Set<string>(['building', 'steady', 'strong', 'surging']);
    return allowed.has(t) ? (t as CareerMomentumTier) : null;
  })();
  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'supporting_copy', 'narrative');
  const strengths = pickStrArray(o.strengths ?? o.strength_items);
  const opportunity = pickStrOrNull(o, 'opportunity', 'biggest_opportunity', 'opportunity_line');
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');

  if (
    score == null &&
    momentumIndex == null &&
    tier == null &&
    !headline &&
    !supporting &&
    strengths.length === 0 &&
    !opportunity &&
    confidence == null
  ) {
    return null;
  }
  return {
    score,
    momentumIndex,
    tier,
    headline,
    supporting,
    strengths,
    opportunity,
    confidence,
  };
}

function pickWeeklyBriefing(raw: unknown): WeeklyBriefingPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const headline = pickStrOrNull(o, 'headline', 'title');
  const summary = pickStrOrNull(o, 'summary', 'brief_summary', 'weekly_summary');
  const wins = pickStrArray(o.wins ?? o.win_lines);
  const needsAttention = pickStrArray(
    o.needsAttention ?? o.needs_attention ?? o.needs_attention_items ?? o.risks,
  );
  const recommendedFocus = pickStrOrNull(o, 'recommendedFocus', 'recommended_focus', 'focus');
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');
  const toneRaw = pickStrOrNull(o, 'tone', 'briefing_tone');
  const tone = (() => {
    const t = String(toneRaw ?? '').trim().toLowerCase();
    const allowed = new Set<string>(['encouraging', 'focused', 'urgent', 'celebratory']);
    return allowed.has(t) ? (t as WeeklyBriefingTone) : null;
  })();

  if (
    !headline &&
    !summary &&
    wins.length === 0 &&
    needsAttention.length === 0 &&
    !recommendedFocus &&
    confidence == null &&
    tone == null
  ) {
    return null;
  }
  return {
    headline,
    summary,
    wins,
    needsAttention,
    recommendedFocus,
    confidence,
    tone,
  };
}

function pickSemanticOutlook(raw: unknown): SemanticOutlookPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const valueRaw = String(pickStr(o, 'value') ?? '')
    .trim()
    .toLowerCase();
  if (!isSemanticOutlookBand(valueRaw)) return null;
  const label = pickStrOrNull(o, 'label');
  const outlookBasis = pickStrOrNull(
    o,
    'outlookBasis',
    'outlook_basis',
    'description',
    'interpretation',
  );
  const disclaimer = pickStrOrNull(o, 'disclaimer');
  return {
    value: valueRaw,
    label,
    outlookBasis,
    disclaimer,
  };
}

function pickTimelineOutlookFields(o: Record<string, unknown>): {
  timelineOutlook: TimelineOutlookBand | null;
  timelineOutlookLabel: string | null;
} {
  const bandRaw = String(pickStr(o, 'timelineOutlook', 'timeline_outlook') ?? '')
    .trim()
    .toLowerCase();
  const timelineOutlook = isTimelineOutlookBand(bandRaw) ? bandRaw : null;
  const timelineOutlookLabel = pickStrOrNull(
    o,
    'timelineOutlookLabel',
    'timeline_outlook_label',
  );
  return { timelineOutlook, timelineOutlookLabel };
}

function pickPredictiveOutlook(raw: unknown): PredictiveOutlookPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const interviewOutlook = pickSemanticOutlook(o.interviewOutlook ?? o.interview_outlook);
  const offerOutlook = pickSemanticOutlook(o.offerOutlook ?? o.offer_outlook);
  const { timelineOutlook, timelineOutlookLabel } = pickTimelineOutlookFields(o);

  const pipelineRaw = pickStrOrNull(o, 'pipelineHealth', 'pipeline_health', 'funnel_health');
  const pipelineHealth = (() => {
    const t = String(pipelineRaw ?? '').trim().toLowerCase();
    const allowed = new Set<string>(['fragile', 'building', 'healthy', 'strong']);
    return allowed.has(t) ? (t as PredictivePipelineHealth) : null;
  })();
  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'supporting_copy', 'body');
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');

  const hasTimeline =
    timelineOutlook != null || Boolean(timelineOutlookLabel?.trim());

  if (
    interviewOutlook == null &&
    offerOutlook == null &&
    !hasTimeline &&
    pipelineHealth == null &&
    !headline &&
    !supporting &&
    confidence == null
  ) {
    return null;
  }
  return {
    interviewOutlook,
    offerOutlook,
    timelineOutlook,
    timelineOutlookLabel,
    pipelineHealth,
    headline,
    supporting,
    confidence,
  };
}

function pickStrategicWeeklyCoaching(raw: unknown): StrategicWeeklyCoachingPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const reasonRaw = pickStrOrNull(o, 'reason', 'coaching_reason');
  const reason = (() => {
    const r = String(reasonRaw ?? '').trim().toLowerCase();
    const allowed = new Set<string>([
      'analysis_paralysis',
      'low_application_volume',
      'interview_focus',
      'low_fit_targeting',
      'stalled_pipeline',
      'strong_momentum',
      'recovery_mode',
    ]);
    return allowed.has(r) ? (r as StrategicWeeklyCoachingReason) : null;
  })();
  const headline = pickStrOrNull(o, 'headline', 'title');
  const supporting = pickStrOrNull(o, 'supporting', 'supporting_copy', 'body');
  const recommendedAction = pickStrOrNull(o, 'recommendedAction', 'recommended_action', 'cta_line');
  const confidence = pickOptionalScore(o, 'confidence', 'confidenceScore', 'confidence_score');
  const toneRaw = pickStrOrNull(o, 'tone', 'coaching_tone');
  const tone = (() => {
    const t = String(toneRaw ?? '').trim().toLowerCase();
    const allowed = new Set<string>(['encouraging', 'focused', 'urgent', 'celebratory']);
    return allowed.has(t) ? (t as StrategicWeeklyCoachingTone) : null;
  })();

  if (!headline && !supporting && !recommendedAction && confidence == null && tone == null && reason == null) {
    return null;
  }
  return {
    reason,
    headline,
    supporting,
    recommendedAction,
    confidence,
    tone,
  };
}

function pickEmotionalSummary(raw: unknown): EmotionalSummaryPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tone = pickStrOrNull(o, 'tone');
  const message = pickStrOrNull(o, 'message');
  if (!tone && !message) return null;
  return { tone, message };
}

function pickAssistantReasoning(raw: unknown): AssistantReasoningPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const primaryFocusReason = pickStrOrNull(o, 'primaryFocusReason', 'primary_focus_reason');
  const continuityReason = pickStrOrNull(o, 'continuityReason', 'continuity_reason');
  const pacingReason = pickStrOrNull(o, 'pacingReason', 'pacing_reason');
  if (!primaryFocusReason && !continuityReason && !pacingReason) return null;
  return { primaryFocusReason, continuityReason, pacingReason };
}

function pickAssistantGuidance(raw: unknown): AssistantGuidancePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const headline = pickStrOrNull(o, 'headline');
  const explanation = pickStrOrNull(o, 'explanation');
  const href = pickStrOrNull(o, 'href', 'path', 'route');
  if (!headline && !explanation && !href) return null;
  return { headline, explanation, href };
}

function pickHumanizedLabels(raw: unknown): HumanizedLabelsPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const narrativeArc = pickStrOrNull(o, 'narrativeArc', 'narrative_arc');
  const strategicMode = pickStrOrNull(o, 'strategicMode', 'strategic_mode');
  const momentum = pickStrOrNull(o, 'momentum');
  const fatigue = pickStrOrNull(o, 'fatigue');
  const confidence = pickStrOrNull(o, 'confidence');
  if (!narrativeArc && !strategicMode && !momentum && !fatigue && !confidence) return null;
  return { narrativeArc, strategicMode, momentum, fatigue, confidence };
}

function pickPersonalInsights(raw: unknown): PersonalInsightsPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const headline = pickStr(o, 'headline') ?? null;
  const supporting = pickStr(o, 'supporting') ?? null;
  const whyItMatters = pickStr(o, 'whyItMatters', 'why_it_matters') ?? null;
  const nextBestAction = pickStr(o, 'nextBestAction', 'next_best_action') ?? null;
  if (!headline && !supporting && !whyItMatters && !nextBestAction) return null;
  return { headline, supporting, whyItMatters, nextBestAction };
}

function pickAssistantVoice(raw: unknown): AssistantVoicePayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const emotionalSummary = pickStr(o, 'emotionalSummary', 'emotional_summary') ?? null;
  const narrativeProgression = pickStr(o, 'narrativeProgression', 'narrative_progression') ?? null;
  if (!emotionalSummary && !narrativeProgression) return null;
  return { emotionalSummary, narrativeProgression };
}

function pickPersonalizationContext(raw: unknown): PersonalizationContextPayload | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const primaryInsightActive =
    typeof o.primaryInsightActive === 'boolean'
      ? o.primaryInsightActive
      : typeof o.primary_insight_active === 'boolean'
        ? o.primary_insight_active
        : null;
  const strongestLeverage = pickStr(o, 'strongestLeverage', 'strongest_leverage') ?? null;
  const quantified = o.quantifiedOpportunities ?? o.quantified_opportunities ?? null;
  const personalInsights = pickPersonalInsights(o.personalInsights ?? o.personal_insights);
  const assistantVoice = pickAssistantVoice(o.assistantVoice ?? o.assistant_voice);
  return {
    primaryInsightActive,
    strongestLeverage,
    quantifiedOpportunities: quantified ?? null,
    personalInsights,
    assistantVoice,
  };
}

function pickDashboardHeader(body: Record<string, unknown>): DashboardHeaderPayload | null {
  const raw = body.dashboardHeader ?? body.dashboard_header;
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const msgRaw = pickStr(o, 'momentumMessage', 'momentum_message');
  const msg = msgRaw?.trim() ? msgRaw.trim() : null;
  const momentumType = pickMomentumType(o.momentumType ?? o.momentum_type);
  const dashboardMode = pickDashboardMode(o.dashboardMode ?? o.dashboard_mode);
  const recommendedSections = pickRecommendedSections(o.recommendedSections ?? o.recommended_sections);
  const actionContextRaw =
    o.actionContext !== null && typeof o.actionContext === 'object' && !Array.isArray(o.actionContext)
      ? (o.actionContext as Record<string, unknown>)
      : o.action_context !== null && typeof o.action_context === 'object' && !Array.isArray(o.action_context)
        ? (o.action_context as Record<string, unknown>)
        : null;
  const actionContext = actionContextRaw
    ? (() => {
        const actionExecutionRaw =
          actionContextRaw.executionPayload !== null &&
          typeof actionContextRaw.executionPayload === 'object' &&
          !Array.isArray(actionContextRaw.executionPayload)
            ? (actionContextRaw.executionPayload as Record<string, unknown>)
            : actionContextRaw.execution_payload !== null &&
                typeof actionContextRaw.execution_payload === 'object' &&
                !Array.isArray(actionContextRaw.execution_payload)
              ? (actionContextRaw.execution_payload as Record<string, unknown>)
              : null;
        const t = String(pickStr(actionContextRaw, 'type') ?? '').trim().toLowerCase();
        const validType: NonNullable<DashboardHeaderPayload['actionContext']>['type'] | null =
          t === 'stalled_application' ||
          t === 'unfinished_application' ||
          t === 'interview_followup' ||
          t === 'cv_issue' ||
          t === 'tailoring_needed' ||
          t === 'interview_prep'
            ? t
            : null;
        if (!validType) return null;
        return {
          type: validType,
          companyName: pickStrOrNull(actionContextRaw, 'companyName', 'company_name'),
          roleTitle: pickStrOrNull(actionContextRaw, 'roleTitle', 'role_title'),
          daysSinceActivity:
            typeof actionContextRaw.daysSinceActivity === 'number' && Number.isFinite(actionContextRaw.daysSinceActivity)
              ? actionContextRaw.daysSinceActivity
              : typeof actionContextRaw.days_since_activity === 'number' &&
                  Number.isFinite(actionContextRaw.days_since_activity)
                ? actionContextRaw.days_since_activity
                : null,
          expectedOutcome: pickStrOrNull(actionContextRaw, 'expectedOutcome', 'expected_outcome'),
          suggestedAction: pickStrOrNull(actionContextRaw, 'suggestedAction', 'suggested_action'),
          estimatedMinutes:
            typeof actionContextRaw.estimatedMinutes === 'number' && Number.isFinite(actionContextRaw.estimatedMinutes)
              ? actionContextRaw.estimatedMinutes
              : typeof actionContextRaw.estimated_minutes === 'number' &&
                  Number.isFinite(actionContextRaw.estimated_minutes)
                ? actionContextRaw.estimated_minutes
                : null,
          deepLink: pickStrOrNull(actionContextRaw, 'deepLink', 'deep_link'),
          canonicalJobId: pickStrOrNull(actionContextRaw, 'canonicalJobId', 'canonical_job_id'),
          applicationId: pickStrOrNull(actionContextRaw, 'applicationId', 'application_id'),
          cvProfileId: pickStrOrNull(actionContextRaw, 'cvProfileId', 'cv_profile_id'),
          recommendationId: pickStrOrNull(actionContextRaw, 'recommendationId', 'recommendation_id'),
          canonicalRoute: pickStrOrNull(actionContextRaw, 'canonicalRoute', 'canonical_route'),
          fallbackRoute: pickStrOrNull(actionContextRaw, 'fallbackRoute', 'fallback_route'),
          resolutionState: (() => {
            const s = String(pickStr(actionContextRaw, 'resolutionState', 'resolution_state') ?? '')
              .trim()
              .toLowerCase();
            return s === 'resolved' || s === 'degraded' || s === 'missing_context' ? s : null;
          })(),
          surfaceOwnership: pickSurfaceOwnership(actionContextRaw.surfaceOwnership ?? actionContextRaw.surface_ownership),
          displayPriority:
            typeof actionContextRaw.displayPriority === 'number' && Number.isFinite(actionContextRaw.displayPriority)
              ? actionContextRaw.displayPriority
              : typeof actionContextRaw.display_priority === 'number' &&
                  Number.isFinite(actionContextRaw.display_priority)
                ? actionContextRaw.display_priority
                : null,
          recommendationClusterId: pickStrOrNull(
            actionContextRaw,
            'recommendationClusterId',
            'recommendation_cluster_id',
          ),
          suppressedBy: pickSurfaceOwnership(actionContextRaw.suppressedBy ?? actionContextRaw.suppressed_by),
          suppressionReason: pickStrOrNull(actionContextRaw, 'suppressionReason', 'suppression_reason'),
          executionPayload: actionExecutionRaw
            ? {
                canonicalRoute: pickStrOrNull(actionExecutionRaw, 'canonicalRoute', 'canonical_route'),
                fallbackRoute: pickStrOrNull(actionExecutionRaw, 'fallbackRoute', 'fallback_route'),
                resolutionState: (() => {
                  const s = String(pickStr(actionExecutionRaw, 'resolutionState', 'resolution_state') ?? '')
                    .trim()
                    .toLowerCase();
                  return s === 'resolved' || s === 'degraded' || s === 'missing_context' ? s : null;
                })(),
                applicationId: pickStrOrNull(actionExecutionRaw, 'applicationId', 'application_id'),
                canonicalJobId: pickStrOrNull(actionExecutionRaw, 'canonicalJobId', 'canonical_job_id'),
                cvProfileId: pickStrOrNull(actionExecutionRaw, 'cvProfileId', 'cv_profile_id'),
              }
            : null,
          executionMode: (() => {
            const mode = String(pickStr(actionContextRaw, 'executionMode', 'execution_mode') ?? '')
              .trim()
              .toLowerCase();
            const ok =
              mode === 'inline_modal' ||
              mode === 'direct_editor' ||
              mode === 'checklist' ||
              mode === 'generator' ||
              mode === 'continue_flow';
            return ok ? (mode as NonNullable<DashboardHeaderPayload['actionContext']>['executionMode']) : null;
          })(),
        } as NonNullable<DashboardHeaderPayload['actionContext']>;
      })()
    : null;
  if (!msg && momentumType === null && !actionContext && dashboardMode === null && recommendedSections.length === 0) {
    return null;
  }
  return {
    momentumMessage: msg,
    momentumType,
    dashboardMode,
    recommendedSections,
    actionContext,
  };
}

function pickUnifiedPriorityItem(raw: unknown): UnifiedPriorityItem | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, 'id') ?? '';
  if (!id) return null;
  const idsRaw = o.ids;
  const idsObj =
    idsRaw !== null && typeof idsRaw === 'object' && !Array.isArray(idsRaw)
      ? (idsRaw as Record<string, unknown>)
      : {};

  const urgencyRaw = String(pickStr(o, 'urgencyBucket', 'urgency_bucket') ?? 'soon')
    .trim()
    .toLowerCase();
  const urgencyBucket: UnifiedPriorityUrgencyBucket =
    urgencyRaw === 'now' || urgencyRaw === 'later' ? urgencyRaw : 'soon';

  const actionType = pickStr(o, 'ctaHint', 'cta_hint');
  const recommendationSourceRaw = String(
    pickStr(o, 'recommendationSource', 'recommendation_source') ?? '',
  ).toLowerCase();
  const locationStrategyRaw = String(pickStr(o, 'locationStrategy', 'location_strategy') ?? '').toLowerCase();
  const normalizedLocationStrategy: 'local' | 'remote_fallback' | null =
    locationStrategyRaw === 'local' || locationStrategyRaw === 'remote_fallback' ? locationStrategyRaw : null;
  const recommendationSource: 'local' | 'remote_fallback' | null =
    normalizedLocationStrategy ??
    (recommendationSourceRaw === 'local' || recommendationSourceRaw === 'remote_fallback'
      ? recommendationSourceRaw
      : null);
  const cta = pickCta(
    o.cta ??
      (actionType
        ? {
            label: 'Open',
            action: {
              type: actionType,
              ...idsObj,
            },
          }
        : { label: 'Open', action: { ...idsObj } }),
  );
  const compactRaw =
    o.compactDisplay !== null && typeof o.compactDisplay === 'object' && !Array.isArray(o.compactDisplay)
      ? (o.compactDisplay as Record<string, unknown>)
      : o.compact_display !== null && typeof o.compact_display === 'object' && !Array.isArray(o.compact_display)
        ? (o.compact_display as Record<string, unknown>)
        : null;
  const explainRaw =
    o.explain !== null && typeof o.explain === 'object' && !Array.isArray(o.explain)
      ? (o.explain as Record<string, unknown>)
      : null;
  const applyAssistRaw =
    o.applyAssist !== null && typeof o.applyAssist === 'object' && !Array.isArray(o.applyAssist)
      ? (o.applyAssist as Record<string, unknown>)
      : o.apply_assist !== null && typeof o.apply_assist === 'object' && !Array.isArray(o.apply_assist)
        ? (o.apply_assist as Record<string, unknown>)
        : null;
  const journeyRaw =
    o.journey !== null && typeof o.journey === 'object' && !Array.isArray(o.journey)
      ? (o.journey as Record<string, unknown>)
      : null;
  const prefillRaw =
    o.prefill !== null && typeof o.prefill === 'object' && !Array.isArray(o.prefill)
      ? (o.prefill as Record<string, unknown>)
      : null;
  const resumeRaw =
    o.resumeState !== null && typeof o.resumeState === 'object' && !Array.isArray(o.resumeState)
      ? (o.resumeState as Record<string, unknown>)
      : o.resume_state !== null && typeof o.resume_state === 'object' && !Array.isArray(o.resume_state)
        ? (o.resume_state as Record<string, unknown>)
        : null;
  const snapshotRaw =
    o.stateSnapshot !== null && typeof o.stateSnapshot === 'object' && !Array.isArray(o.stateSnapshot)
      ? (o.stateSnapshot as Record<string, unknown>)
      : o.state_snapshot !== null && typeof o.state_snapshot === 'object' && !Array.isArray(o.state_snapshot)
        ? (o.state_snapshot as Record<string, unknown>)
        : null;
  const nextActionPreviewRaw =
    o.nextActionPreview !== null && typeof o.nextActionPreview === 'object' && !Array.isArray(o.nextActionPreview)
      ? (o.nextActionPreview as Record<string, unknown>)
      : o.next_action_preview !== null &&
          typeof o.next_action_preview === 'object' &&
          !Array.isArray(o.next_action_preview)
        ? (o.next_action_preview as Record<string, unknown>)
        : null;
  const outcomeFramingRaw =
    o.outcomeFraming !== null && typeof o.outcomeFraming === 'object' && !Array.isArray(o.outcomeFraming)
      ? (o.outcomeFraming as Record<string, unknown>)
      : o.outcome_framing !== null &&
          typeof o.outcome_framing === 'object' &&
          !Array.isArray(o.outcome_framing)
        ? (o.outcome_framing as Record<string, unknown>)
        : null;
  const interviewPrepRaw =
    o.interviewPrepContext !== null &&
    typeof o.interviewPrepContext === 'object' &&
    !Array.isArray(o.interviewPrepContext)
      ? (o.interviewPrepContext as Record<string, unknown>)
      : o.interview_prep_context !== null &&
          typeof o.interview_prep_context === 'object' &&
          !Array.isArray(o.interview_prep_context)
        ? (o.interview_prep_context as Record<string, unknown>)
        : null;
  const executionContextRaw =
    o.executionPayload !== null && typeof o.executionPayload === 'object' && !Array.isArray(o.executionPayload)
      ? (o.executionPayload as Record<string, unknown>)
      : o.execution_payload !== null && typeof o.execution_payload === 'object' && !Array.isArray(o.execution_payload)
        ? (o.execution_payload as Record<string, unknown>)
        : o.executionContext !== null && typeof o.executionContext === 'object' && !Array.isArray(o.executionContext)
          ? (o.executionContext as Record<string, unknown>)
          : o.execution_context !== null && typeof o.execution_context === 'object' && !Array.isArray(o.execution_context)
            ? (o.execution_context as Record<string, unknown>)
            : null;
  const followUpContextRaw =
    o.followUpContext !== null && typeof o.followUpContext === 'object' && !Array.isArray(o.followUpContext)
      ? (o.followUpContext as Record<string, unknown>)
      : o.follow_up_context !== null && typeof o.follow_up_context === 'object' && !Array.isArray(o.follow_up_context)
        ? (o.follow_up_context as Record<string, unknown>)
        : null;
  const cvFixContextRaw =
    o.cvFixContext !== null && typeof o.cvFixContext === 'object' && !Array.isArray(o.cvFixContext)
      ? (o.cvFixContext as Record<string, unknown>)
      : o.cv_fix_context !== null && typeof o.cv_fix_context === 'object' && !Array.isArray(o.cv_fix_context)
        ? (o.cv_fix_context as Record<string, unknown>)
        : null;
  const qualitySignalsRaw =
    o.qualitySignals !== null && typeof o.qualitySignals === 'object' && !Array.isArray(o.qualitySignals)
      ? (o.qualitySignals as Record<string, unknown>)
      : o.quality_signals !== null && typeof o.quality_signals === 'object' && !Array.isArray(o.quality_signals)
        ? (o.quality_signals as Record<string, unknown>)
        : null;

  return {
    id,
    priorityScore: pickNum(o, 'priorityScore', 'priority_score'),
    urgencyBucket,
    kind: String(pickStr(o, 'kind') ?? 'follow_up'),
    title: String(pickStr(o, 'title') ?? 'Recommended action'),
    subtitle: pickStrOrNull(o, 'subtitle'),
    reasonCodes: pickStrArray(o.reasonCodes ?? o.reason_codes),
    reasonText: pickStrOrNull(o, 'reasonText', 'reason_text'),
    whyNowShort: pickStrOrNull(o, 'whyNowShort', 'why_now_short'),
    compactDisplay: compactRaw
      ? {
          primaryLine: String(pickStr(compactRaw, 'primaryLine', 'primary_line') ?? ''),
          actionLabel: String(pickStr(compactRaw, 'actionLabel', 'action_label') ?? 'Open'),
          actionType: String(pickStr(compactRaw, 'actionType', 'action_type') ?? ''),
        }
      : null,
    explain: explainRaw
      ? {
          short: String(pickStr(explainRaw, 'short') ?? ''),
          factors: pickStrArray(explainRaw.factors),
          confidence:
            typeof explainRaw.confidence === 'number' && Number.isFinite(explainRaw.confidence)
              ? explainRaw.confidence
              : null,
        }
      : null,
    applyAssist: applyAssistRaw
      ? (() => {
          const stepsRemaining = pickNum(
            applyAssistRaw,
            'estimatedStepsRemaining',
            'estimated_steps_remaining',
          );
          const stepsDirect = applyAssistRaw.estimatedSteps ?? applyAssistRaw.estimated_steps;
          const estimatedSteps =
            typeof stepsDirect === 'number' && Number.isFinite(stepsDirect) ? stepsDirect : stepsRemaining;
          const readyRaw = String(
            pickStr(applyAssistRaw, 'readyState', 'ready_state') ?? '',
          ).trim();
          return {
            suggestedNextStep: String(pickStr(applyAssistRaw, 'suggestedNextStep', 'suggested_next_step') ?? ''),
            estimatedSteps,
            estimatedStepsRemaining: stepsRemaining,
            estimatedMinutesToApply: (() => {
              const v = applyAssistRaw.estimatedMinutesToApply ?? applyAssistRaw.estimated_minutes_to_apply;
              return typeof v === 'number' && Number.isFinite(v) ? v : null;
            })(),
            blockerSeverity:
              (() => {
                const s = String(pickStr(applyAssistRaw, 'blockerSeverity', 'blocker_severity') ?? '').toLowerCase();
                return s === 'none' || s === 'low' || s === 'high' ? s : null;
              })(),
            fastPathEligible:
              applyAssistRaw.fastPathEligible === true || applyAssistRaw.fast_path_eligible === true,
            fastPathRoute: pickStrOrNull(applyAssistRaw, 'fastPathRoute', 'fast_path_route'),
            noEditsNeeded: applyAssistRaw.noEditsNeeded === true || applyAssistRaw.no_edits_needed === true,
            primaryActionLabel: pickStrOrNull(
              applyAssistRaw,
              'primaryActionLabel',
              'primary_action_label',
            ),
            frictionScore: pickOptionalScore(applyAssistRaw, 'frictionScore', 'friction_score'),
            completionLikelihood: pickOptionalScore(
              applyAssistRaw,
              'completionLikelihood',
              'completion_likelihood',
            ),
            blockers: pickStrArray(applyAssistRaw.blockers),
            readyState: readyRaw.length > 0 ? readyRaw : null,
          };
        })()
      : null,
    prefill: prefillRaw
      ? {
          selectedCvId: pickStrOrNull(prefillRaw, 'selectedCvId', 'selected_cv_id'),
          tailoredCvDraftId: pickStrOrNull(prefillRaw, 'tailoredCvDraftId', 'tailored_cv_draft_id'),
          coverLetterDraftId: pickStrOrNull(prefillRaw, 'coverLetterDraftId', 'cover_letter_draft_id'),
          sourceContext: pickStrOrNull(prefillRaw, 'sourceContext', 'source_context'),
        }
      : null,
    resumeState: resumeRaw
      ? {
          entityIds: pickStrArray(resumeRaw.entityIds ?? resumeRaw.entity_ids),
          workingStep: pickStrOrNull(resumeRaw, 'workingStep', 'working_step'),
          filtersContext: pickStrOrNull(resumeRaw, 'filtersContext', 'filters_context'),
          lastUpdatedAt: pickStrOrNull(resumeRaw, 'lastUpdatedAt', 'last_updated_at'),
          ttlMinutes: pickNum(resumeRaw, 'ttlMinutes', 'ttl_minutes'),
        }
      : null,
    stateSnapshot: snapshotRaw
      ? {
          sourceState: pickStrOrNull(snapshotRaw, 'sourceState', 'source_state'),
          sourceUpdatedAt: pickStrOrNull(snapshotRaw, 'sourceUpdatedAt', 'source_updated_at'),
          computedAt: pickStrOrNull(snapshotRaw, 'computedAt', 'computed_at'),
          staleRisk: snapshotRaw.staleRisk === true || snapshotRaw.stale_risk === true,
        }
      : null,
    microcopy: pickStrOrNull(o, 'microcopy'),
    outcomeCopy: pickStrOrNull(o, 'outcomeCopy', 'outcome_copy'),
    nextActionPreview: nextActionPreviewRaw
      ? {
          kind: pickStrOrNull(nextActionPreviewRaw, 'kind'),
          route: pickStrOrNull(nextActionPreviewRaw, 'route'),
          estimatedReadyMs:
            typeof nextActionPreviewRaw.estimatedReadyMs === 'number' &&
            Number.isFinite(nextActionPreviewRaw.estimatedReadyMs)
              ? nextActionPreviewRaw.estimatedReadyMs
              : typeof nextActionPreviewRaw.estimated_ready_ms === 'number' &&
                  Number.isFinite(nextActionPreviewRaw.estimated_ready_ms)
                ? nextActionPreviewRaw.estimated_ready_ms
                : null,
        }
      : null,
    outcomeFraming: outcomeFramingRaw
      ? {
          primaryBenefit: pickStrOrNull(outcomeFramingRaw, 'primaryBenefit', 'primary_benefit'),
          secondaryBenefit: pickStrOrNull(outcomeFramingRaw, 'secondaryBenefit', 'secondary_benefit'),
        }
      : null,
    journey: journeyRaw
      ? {
          nextRoute: String(pickStr(journeyRaw, 'nextRoute', 'next_route') ?? ''),
          returnRoute: pickStrOrNull(journeyRaw, 'returnRoute', 'return_route'),
          contextToken: pickStrOrNull(journeyRaw, 'contextToken', 'context_token'),
        }
      : null,
    ctaHint: actionType ?? null,
    isNewSinceLastVisit: o.isNewSinceLastVisit === true || o.is_new_since_last_visit === true,
    firstSeenAt: pickStrOrNull(o, 'firstSeenAt', 'first_seen_at'),
    lastSeenAt: pickStrOrNull(o, 'lastSeenAt', 'last_seen_at'),
    locationStrategy: recommendationSource,
    locationLabel: pickStrOrNull(o, 'locationLabel', 'location_label'),
    postedAgeHours:
      typeof o.postedAgeHours === 'number' && Number.isFinite(o.postedAgeHours)
        ? o.postedAgeHours
        : typeof o.posted_age_hours === 'number' && Number.isFinite(o.posted_age_hours)
          ? o.posted_age_hours
          : null,
    recommendationSource,
    recommendationLocation:
      pickStrOrNull(o, 'recommendationLocation', 'recommendation_location') ??
      pickStrOrNull(o, 'locationLabel', 'location_label'),
    fallbackReason: pickStrOrNull(o, 'fallbackReason', 'fallback_reason'),
    dedupeGroupKey: pickStrOrNull(o, 'dedupeGroupKey', 'dedupe_group_key'),
    recommendationFamilyId: pickStrOrNull(o, 'recommendationFamilyId', 'recommendation_family_id'),
    confidenceScore: pickOptionalScore(o, 'confidenceScore', 'confidence_score'),
    confidenceReason: pickStrOrNull(o, 'confidenceReason', 'confidence_reason'),
    estimatedOutcome: pickStrOrNull(o, 'estimatedOutcome', 'estimated_outcome'),
    expectedImpactLevel: pickImpactLevel(o),
    suppressionReason: pickStrOrNull(o, 'suppressionReason', 'suppression_reason'),
    surfaceOwnership: pickSurfaceOwnership(o.surfaceOwnership ?? o.surface_ownership),
    displayPriority:
      typeof o.displayPriority === 'number' && Number.isFinite(o.displayPriority)
        ? o.displayPriority
        : typeof o.display_priority === 'number' && Number.isFinite(o.display_priority)
          ? o.display_priority
          : null,
    recommendationClusterId: pickStrOrNull(o, 'recommendationClusterId', 'recommendation_cluster_id'),
    suppressedBy: pickSurfaceOwnership(o.suppressedBy ?? o.suppressed_by),
    workflowState: pickWorkflowState(o),
    workflowEntityKey: pickStrOrNull(o, 'workflowEntityKey', 'workflow_entity_key'),
    workflowEntityId: pickStrOrNull(o, 'workflowEntityId', 'workflow_entity_id'),
    roleTitle: pickStrOrNull(o, 'roleTitle', 'role_title'),
    roleCompany: pickStrOrNull(o, 'roleCompany', 'role_company'),
    roleLabel: pickStrOrNull(o, 'roleLabel', 'role_label'),
    interviewPrepContext: interviewPrepRaw
      ? {
          jobAnalysisId: pickStrOrNull(interviewPrepRaw, 'jobAnalysisId', 'job_analysis_id'),
          jobTitle: pickStrOrNull(interviewPrepRaw, 'jobTitle', 'job_title'),
          company: pickStrOrNull(interviewPrepRaw, 'company'),
          cvProfileId: pickStrOrNull(interviewPrepRaw, 'cvProfileId', 'cv_profile_id'),
          preferredCvProfileId: pickStrOrNull(
            interviewPrepRaw,
            'preferredCvProfileId',
            'preferred_cv_profile_id',
          ),
          analyzedCvProfileId: pickStrOrNull(interviewPrepRaw, 'analyzedCvProfileId', 'analyzed_cv_profile_id'),
          tailoringCvProfileId: pickStrOrNull(interviewPrepRaw, 'tailoringCvProfileId', 'tailoring_cv_profile_id'),
          likelyTopics: pickStrArray(interviewPrepRaw.likelyTopics ?? interviewPrepRaw.likely_topics),
          likelyQuestions: pickStrArray(interviewPrepRaw.likelyQuestions ?? interviewPrepRaw.likely_questions),
          preparationChecklist: pickStrArray(
            interviewPrepRaw.preparationChecklist ?? interviewPrepRaw.preparation_checklist,
          ),
          missingSignals: pickStrArray(interviewPrepRaw.missingSignals ?? interviewPrepRaw.missing_signals),
          suggestedStories: pickStrArray(interviewPrepRaw.suggestedStories ?? interviewPrepRaw.suggested_stories),
          estimatedPrepMinutes:
            typeof interviewPrepRaw.estimatedPrepMinutes === 'number' &&
            Number.isFinite(interviewPrepRaw.estimatedPrepMinutes)
              ? interviewPrepRaw.estimatedPrepMinutes
              : typeof interviewPrepRaw.estimated_prep_minutes === 'number' &&
                  Number.isFinite(interviewPrepRaw.estimated_prep_minutes)
                ? interviewPrepRaw.estimated_prep_minutes
                : null,
          hydrationReady:
            interviewPrepRaw.hydrationReady === true || interviewPrepRaw.hydration_ready === true
              ? true
              : interviewPrepRaw.hydrationReady === false || interviewPrepRaw.hydration_ready === false
                ? false
                : null,
          selectedCvProfileId: pickStrOrNull(interviewPrepRaw, 'selectedCvProfileId', 'selected_cv_profile_id'),
        }
      : null,
    executionContext: executionContextRaw
      ? {
          nextImmediateAction: pickStrOrNull(executionContextRaw, 'nextImmediateAction', 'next_immediate_action'),
          estimatedMinutes:
            typeof executionContextRaw.estimatedMinutes === 'number' &&
            Number.isFinite(executionContextRaw.estimatedMinutes)
              ? executionContextRaw.estimatedMinutes
              : typeof executionContextRaw.estimated_minutes === 'number' &&
                  Number.isFinite(executionContextRaw.estimated_minutes)
                ? executionContextRaw.estimated_minutes
                : null,
          emotionalBenefit: pickStrOrNull(executionContextRaw, 'emotionalBenefit', 'emotional_benefit'),
          executionMode: (() => {
            const mode = String(pickStr(executionContextRaw, 'executionMode', 'execution_mode') ?? '')
              .trim()
              .toLowerCase();
            return mode === 'inline_modal' ||
              mode === 'direct_editor' ||
              mode === 'checklist' ||
              mode === 'generator' ||
              mode === 'continue_flow'
              ? mode
              : null;
          })(),
          deepLink: pickStrOrNull(executionContextRaw, 'deepLink', 'deep_link'),
          canExecuteInline:
            executionContextRaw.canExecuteInline === true || executionContextRaw.can_execute_inline === true,
          preparedDraft: pickStrOrNull(executionContextRaw, 'preparedDraft', 'prepared_draft'),
          suggestedTone: (() => {
            const v = String(pickStr(executionContextRaw, 'suggestedTone', 'suggested_tone') ?? '').toLowerCase();
            return v === 'confident' || v === 'professional' || v === 'warm' || v === 'concise' ? v : null;
          })(),
          estimatedSuccessLikelihood:
            typeof executionContextRaw.estimatedSuccessLikelihood === 'number' &&
            Number.isFinite(executionContextRaw.estimatedSuccessLikelihood)
              ? executionContextRaw.estimatedSuccessLikelihood
              : typeof executionContextRaw.estimated_success_likelihood === 'number' &&
                  Number.isFinite(executionContextRaw.estimated_success_likelihood)
                ? executionContextRaw.estimated_success_likelihood
                : null,
          preparationChecklist: pickStrArray(
            executionContextRaw.preparationChecklist ?? executionContextRaw.preparation_checklist,
          ),
          suggestedTalkingPoints: pickStrArray(
            executionContextRaw.suggestedTalkingPoints ?? executionContextRaw.suggested_talking_points,
          ),
          quickActions: pickStrArray(executionContextRaw.quickActions ?? executionContextRaw.quick_actions),
          fallbackAction: pickStrOrNull(executionContextRaw, 'fallbackAction', 'fallback_action'),
          canonicalJobId: pickStrOrNull(executionContextRaw, 'canonicalJobId', 'canonical_job_id'),
          applicationId: pickStrOrNull(executionContextRaw, 'applicationId', 'application_id'),
          cvProfileId: pickStrOrNull(executionContextRaw, 'cvProfileId', 'cv_profile_id'),
          recommendationId: pickStrOrNull(executionContextRaw, 'recommendationId', 'recommendation_id'),
          executionType: pickStrOrNull(executionContextRaw, 'executionType', 'execution_type'),
          canonicalRoute: pickStrOrNull(executionContextRaw, 'canonicalRoute', 'canonical_route'),
          fallbackRoute: pickStrOrNull(executionContextRaw, 'fallbackRoute', 'fallback_route'),
          resolutionState: (() => {
            const s = String(pickStr(executionContextRaw, 'resolutionState', 'resolution_state') ?? '')
              .trim()
              .toLowerCase();
            return s === 'resolved' || s === 'degraded' || s === 'missing_context' ? s : null;
          })(),
        }
      : null,
    executionPayload: executionContextRaw
      ? {
          executionId: pickStrOrNull(executionContextRaw, 'executionId', 'execution_id'),
          executionType: pickStrOrNull(executionContextRaw, 'executionType', 'execution_type'),
          canonicalRoute: pickStrOrNull(executionContextRaw, 'canonicalRoute', 'canonical_route'),
          fallbackRoute: pickStrOrNull(executionContextRaw, 'fallbackRoute', 'fallback_route'),
          entityType: pickStrOrNull(executionContextRaw, 'entityType', 'entity_type'),
          entityId: pickStrOrNull(executionContextRaw, 'entityId', 'entity_id'),
          applicationId: pickStrOrNull(executionContextRaw, 'applicationId', 'application_id'),
          jobId: pickStrOrNull(executionContextRaw, 'jobId', 'job_id'),
          jobAnalysisId: pickStrOrNull(executionContextRaw, 'jobAnalysisId', 'job_analysis_id'),
          cvProfileId: pickStrOrNull(executionContextRaw, 'cvProfileId', 'cv_profile_id'),
          preferredCvProfileId: pickStrOrNull(
            executionContextRaw,
            'preferredCvProfileId',
            'preferred_cv_profile_id',
          ),
          tailoringCvProfileId: pickStrOrNull(
            executionContextRaw,
            'tailoringCvProfileId',
            'tailoring_cv_profile_id',
          ),
          analyzedCvProfileId: pickStrOrNull(
            executionContextRaw,
            'analyzedCvProfileId',
            'analyzed_cv_profile_id',
          ),
          recommendationState: pickStrOrNull(executionContextRaw, 'recommendationState', 'recommendation_state'),
          resolutionState: (() => {
            const s = String(pickStr(executionContextRaw, 'resolutionState', 'resolution_state') ?? '')
              .trim()
              .toLowerCase();
            return s === 'resolved' || s === 'degraded' || s === 'missing_context' ? s : null;
          })(),
        }
      : null,
    recommendationState: pickStrOrNull(o, 'recommendationState', 'recommendation_state'),
    followUpContext: followUpContextRaw
      ? {
          suggested: followUpContextRaw.suggested === true,
          daysSinceLastActivity:
            typeof followUpContextRaw.daysSinceLastActivity === 'number' &&
            Number.isFinite(followUpContextRaw.daysSinceLastActivity)
              ? followUpContextRaw.daysSinceLastActivity
              : typeof followUpContextRaw.days_since_last_activity === 'number' &&
                  Number.isFinite(followUpContextRaw.days_since_last_activity)
                ? followUpContextRaw.days_since_last_activity
                : null,
          confidence:
            typeof followUpContextRaw.confidence === 'number' && Number.isFinite(followUpContextRaw.confidence)
              ? followUpContextRaw.confidence
              : null,
          recommendedChannel: (() => {
            const v = String(
              pickStr(followUpContextRaw, 'recommendedChannel', 'recommended_channel') ?? '',
            ).toLowerCase();
            return v === 'email' || v === 'in_app' || v === 'manual_note' ? v : null;
          })(),
          draftMessage: pickStrOrNull(followUpContextRaw, 'draftMessage', 'draft_message'),
          suggestedTone: (() => {
            const v = String(pickStr(followUpContextRaw, 'suggestedTone', 'suggested_tone') ?? '').toLowerCase();
            return v === 'confident' || v === 'professional' || v === 'warm' || v === 'concise' ? v : null;
          })(),
          recoveryLikelihood:
            typeof followUpContextRaw.recoveryLikelihood === 'number' &&
            Number.isFinite(followUpContextRaw.recoveryLikelihood)
              ? followUpContextRaw.recoveryLikelihood
              : typeof followUpContextRaw.recovery_likelihood === 'number' &&
                  Number.isFinite(followUpContextRaw.recovery_likelihood)
                ? followUpContextRaw.recovery_likelihood
                : null,
          recommendedSendWindow: pickStrOrNull(
            followUpContextRaw,
            'recommendedSendWindow',
            'recommended_send_window',
          ),
          rationaleShort: pickStrOrNull(followUpContextRaw, 'rationaleShort', 'rationale_short'),
        }
      : null,
    cvFixContext: cvFixContextRaw
      ? {
          affectedSection: pickStrOrNull(cvFixContextRaw, 'affectedSection', 'affected_section'),
          suggestedPatch: pickStrOrNull(cvFixContextRaw, 'suggestedPatch', 'suggested_patch'),
          expectedImpact: pickStrOrNull(cvFixContextRaw, 'expectedImpact', 'expected_impact'),
          confidenceReason: pickStrOrNull(cvFixContextRaw, 'confidenceReason', 'confidence_reason'),
        }
      : null,
    qualitySignals: qualitySignalsRaw
      ? {
          urgency: (() => {
            const v = String(pickStr(qualitySignalsRaw, 'urgency') ?? '').toLowerCase();
            return v === 'low' || v === 'medium' || v === 'high' ? v : null;
          })(),
          reversibility: (() => {
            const v = String(pickStr(qualitySignalsRaw, 'reversibility') ?? '').toLowerCase();
            return v === 'easy' || v === 'moderate' || v === 'hard' ? v : null;
          })(),
          momentumImpact: (() => {
            const v = String(pickStr(qualitySignalsRaw, 'momentumImpact', 'momentum_impact') ?? '').toLowerCase();
            return v === 'low' || v === 'medium' || v === 'high' ? v : null;
          })(),
          estimatedUserEffort: (() => {
            const v = String(
              pickStr(qualitySignalsRaw, 'estimatedUserEffort', 'estimated_user_effort') ?? '',
            ).toLowerCase();
            return v === 'low' || v === 'medium' || v === 'high' ? v : null;
          })(),
          confidenceTier: (() => {
            const v = String(pickStr(qualitySignalsRaw, 'confidenceTier', 'confidence_tier') ?? '').toLowerCase();
            return v === 'low' || v === 'medium' || v === 'high' ? v : null;
          })(),
        }
      : null,
    reasonShort: pickStrOrNull(o, 'reasonShort', 'reason_short'),
    reasonDetailed: pickStrOrNull(o, 'reasonDetailed', 'reason_detailed'),
    recommendationId: pickStrOrNull(o, 'recommendationId', 'recommendation_id') ?? id,
    generationReason: pickStrOrNull(o, 'generationReason', 'generation_reason'),
    priorityState: pickPriorityState(o),
    actionReassurance: pickStrOrNull(o, 'actionReassurance', 'action_reassurance'),
    ids: {
      applicationId: pickStr(idsObj, 'applicationId', 'application_id') ?? null,
      jobAnalysisId: pickStr(idsObj, 'jobAnalysisId', 'job_analysis_id') ?? null,
      bookmarkId: pickStr(idsObj, 'bookmarkId', 'bookmark_id') ?? null,
      jobListingId: pickStr(idsObj, 'jobListingId', 'job_listing_id') ?? null,
      hubReminderId: pickStr(idsObj, 'hubReminderId', 'hub_reminder_id') ?? null,
      jobId: pickStr(idsObj, 'jobId', 'job_id') ?? null,
      cvProfileId: pickStr(idsObj, 'cvProfileId', 'cv_profile_id') ?? null,
    },
    cta,
  };
}

function pickUnifiedPriorityItems(v: unknown): UnifiedPriorityItem[] {
  if (!Array.isArray(v)) return [];
  const out: UnifiedPriorityItem[] = [];
  for (const el of v) {
    const it = pickUnifiedPriorityItem(el);
    if (it) out.push(it);
  }
  return out;
}

function normalizeSinceLastVisitObject(raw: Record<string, unknown>): SinceLastVisitPayload {
  return {
    lastSeenAt: pickStr(raw, 'lastSeenAt', 'last_seen_at') ?? null,
    newJobsCount: pickNum(raw, 'newJobsCount', 'new_jobs_count'),
    newHighMatchCount: pickNum(raw, 'newHighMatchCount', 'new_high_match_count'),
    newStalledCount: pickNum(raw, 'newStalledCount', 'new_stalled_count'),
    statusChangedCount: pickNum(raw, 'statusChangedCount', 'status_changed_count'),
    newRecommendationsCount: pickNum(raw, 'newRecommendationsCount', 'new_recommendations_count'),
  };
}

export function normalizeTodayPlan(raw: unknown): TodayPlanPayload {
  const body = unwrapEnvelope(raw);
  const upcomingInterviewsWire = resolveWireUpcomingInterviews(body);
  const focusItemsRawEarly = body.focusItems ?? body.focus_items;
  const focusItemsEarly =
    focusItemsRawEarly === undefined ? null : pickDashboardFocusItems(focusItemsRawEarly);
  const unifiedItemsEarly = (() => {
    const up =
      body.unifiedPriorities !== null &&
      typeof body.unifiedPriorities === 'object' &&
      !Array.isArray(body.unifiedPriorities)
        ? (body.unifiedPriorities as Record<string, unknown>)
        : body.unified_priorities !== null &&
            typeof body.unified_priorities === 'object' &&
            !Array.isArray(body.unified_priorities)
          ? (body.unified_priorities as Record<string, unknown>)
          : null;
    return up && up.items !== undefined ? pickUnifiedPriorityItems(up.items) : [];
  })();
  const upcomingInterviewsMerged = mergeUpcomingInterviewsFromWireAndFocus(
    upcomingInterviewsWire,
    focusItemsEarly,
    unifiedItemsEarly,
  );
  const nextRaw = body.nextStep ?? body.next_step;
  const unifiedRaw =
    body.unifiedPriorities !== null && typeof body.unifiedPriorities === 'object' && !Array.isArray(body.unifiedPriorities)
      ? (body.unifiedPriorities as Record<string, unknown>)
      : body.unified_priorities !== null &&
          typeof body.unified_priorities === 'object' &&
          !Array.isArray(body.unified_priorities)
        ? (body.unified_priorities as Record<string, unknown>)
        : {};
  const slvRaw =
    body.sinceLastVisit !== null && typeof body.sinceLastVisit === 'object' && !Array.isArray(body.sinceLastVisit)
      ? (body.sinceLastVisit as Record<string, unknown>)
      : body.since_last_visit !== null &&
          typeof body.since_last_visit === 'object' &&
          !Array.isArray(body.since_last_visit)
        ? (body.since_last_visit as Record<string, unknown>)
        : {};
  const progressRaw =
    body.progress !== null && typeof body.progress === 'object' && !Array.isArray(body.progress)
      ? (body.progress as Record<string, unknown>)
      : {};
  const missionRaw =
    body.dailyMission !== null && typeof body.dailyMission === 'object' && !Array.isArray(body.dailyMission)
      ? (body.dailyMission as Record<string, unknown>)
      : body.daily_mission !== null && typeof body.daily_mission === 'object' && !Array.isArray(body.daily_mission)
        ? (body.daily_mission as Record<string, unknown>)
        : {};
  const continuationRaw =
    body.continuationState !== null &&
    typeof body.continuationState === 'object' &&
    !Array.isArray(body.continuationState)
      ? (body.continuationState as Record<string, unknown>)
      : body.continuation_state !== null &&
          typeof body.continuation_state === 'object' &&
          !Array.isArray(body.continuation_state)
        ? (body.continuation_state as Record<string, unknown>)
        : {};
  const continuationConsistencyRaw =
    continuationRaw.consistency !== null &&
    typeof continuationRaw.consistency === 'object' &&
    !Array.isArray(continuationRaw.consistency)
      ? (continuationRaw.consistency as Record<string, unknown>)
      : continuationRaw.consistency_state !== null &&
          typeof continuationRaw.consistency_state === 'object' &&
          !Array.isArray(continuationRaw.consistency_state)
        ? (continuationRaw.consistency_state as Record<string, unknown>)
        : null;
  const reentryRaw =
    body.reentrySummary !== null && typeof body.reentrySummary === 'object' && !Array.isArray(body.reentrySummary)
      ? (body.reentrySummary as Record<string, unknown>)
      : body.reentry_summary !== null &&
          typeof body.reentry_summary === 'object' &&
          !Array.isArray(body.reentry_summary)
        ? (body.reentry_summary as Record<string, unknown>)
        : {};
  const rqRaw =
    unifiedRaw.recommendationQuality !== null &&
    typeof unifiedRaw.recommendationQuality === 'object' &&
    !Array.isArray(unifiedRaw.recommendationQuality)
      ? (unifiedRaw.recommendationQuality as Record<string, unknown>)
      : unifiedRaw.recommendation_quality !== null &&
          typeof unifiedRaw.recommendation_quality === 'object' &&
          !Array.isArray(unifiedRaw.recommendation_quality)
        ? (unifiedRaw.recommendation_quality as Record<string, unknown>)
        : null;
  const unifiedSummaryRaw =
    unifiedRaw.summary !== null && typeof unifiedRaw.summary === 'object' && !Array.isArray(unifiedRaw.summary)
      ? (unifiedRaw.summary as Record<string, unknown>)
      : unifiedRaw.unified_summary !== null &&
          typeof unifiedRaw.unified_summary === 'object' &&
          !Array.isArray(unifiedRaw.unified_summary)
        ? (unifiedRaw.unified_summary as Record<string, unknown>)
        : unifiedRaw;

  return {
    generatedAt: String(pickStr(body, 'generatedAt', 'generated_at') ?? new Date().toISOString()),
    digestVersion: String(pickStr(body, 'digestVersion', 'digest_version') ?? ''),
    experienceSessionId: pickStr(body, 'experienceSessionId', 'experience_session_id') ?? null,
    experienceRevision: (() => {
      const v = body.experienceRevision ?? body.experience_revision;
      if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
      if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Math.max(0, Math.round(Number(v)));
      return null;
    })(),
    activeExecutionSession: body.activeExecutionSession === true || body.active_execution_session === true,
    workflowProgress: (() => {
      const raw =
        body.workflowProgress !== null && typeof body.workflowProgress === 'object' && !Array.isArray(body.workflowProgress)
          ? (body.workflowProgress as Record<string, unknown>)
          : body.workflow_progress !== null && typeof body.workflow_progress === 'object' && !Array.isArray(body.workflow_progress)
            ? (body.workflow_progress as Record<string, unknown>)
            : null;
      if (!raw) return null;
      const pctRaw = raw.percentComplete ?? raw.percent_complete;
      const estRaw = raw.estimatedRemainingMinutes ?? raw.estimated_remaining_minutes;
      return {
        sessionId: pickStr(raw, 'sessionId', 'session_id') ?? null,
        workflowEntityId: pickStr(raw, 'workflowEntityId', 'workflow_entity_id') ?? null,
        workflowEntityType: pickStr(raw, 'workflowEntityType', 'workflow_entity_type') ?? null,
        executionType: pickStr(raw, 'executionType', 'execution_type') ?? null,
        stepKey: pickStr(raw, 'stepKey', 'step_key') ?? null,
        percentComplete:
          typeof pctRaw === 'number' && Number.isFinite(pctRaw)
            ? Math.max(0, Math.min(100, Math.round(pctRaw)))
            : typeof pctRaw === 'string' && pctRaw.trim() && Number.isFinite(Number(pctRaw))
              ? Math.max(0, Math.min(100, Math.round(Number(pctRaw))))
              : null,
        estimatedRemainingMinutes:
          typeof estRaw === 'number' && Number.isFinite(estRaw)
            ? Math.max(0, Math.round(estRaw))
            : typeof estRaw === 'string' && estRaw.trim() && Number.isFinite(Number(estRaw))
              ? Math.max(0, Math.round(Number(estRaw)))
              : null,
        lastActiveAt: pickStr(raw, 'lastActiveAt', 'last_active_at') ?? null,
        lastMeaningfulAction: (raw.lastMeaningfulAction ?? raw.last_meaningful_action) ?? null,
      } satisfies WorkflowProgressPayload;
    })(),
    assistantState: pickAssistantState(body.assistantState ?? body.assistant_state),
    memorySummary: pickStr(body, 'memorySummary', 'memory_summary') ?? null,
    assistantTone: pickStr(body, 'assistantTone', 'assistant_tone') ?? null,
    assistantNarrative: pickAssistantNarrative(body.assistantNarrative ?? body.assistant_narrative),
    opportunityDetection: pickOpportunityDetection(body.opportunityDetection ?? body.opportunity_detection),
    followUpIntelligence: pickFollowUpIntelligence(body.followUpIntelligence ?? body.follow_up_intelligence),
    followUpJobs: pickFollowUpJobsArray(body.followUpJobs ?? body.follow_up_jobs),
    followUpJobsTotalCount: pickFollowUpJobsTotalCount(body),
    followUpJobsViewAllHref: pickFollowUpJobsViewAllHref(body),
    adaptiveCoaching: pickAdaptiveCoaching(body.adaptiveCoaching ?? body.adaptive_coaching),
    strategicRecommendation: pickStrategicRecommendation(body.strategicRecommendation ?? body.strategic_recommendation),
    recommendedMove: pickRecommendedMove(body.recommendedMove ?? body.recommended_move),
    careerGoalProfile: pickCareerGoalProfile(body.careerGoalProfile ?? body.career_goal_profile),
    goalAlignment: pickGoalAlignment(body.goalAlignment ?? body.goal_alignment),
    goalStrategicCoaching: pickGoalStrategicCoaching(body.goalStrategicCoaching ?? body.goal_strategic_coaching),
    strategicCoaching: pickStrategicCoaching(body.strategicCoaching ?? body.strategic_coaching),
    careerMomentum: pickCareerMomentum(body.careerMomentum ?? body.career_momentum),
    weeklyBriefing: pickWeeklyBriefing(body.weeklyBriefing ?? body.weekly_briefing),
    predictiveOutlook: pickPredictiveOutlook(body.predictiveOutlook ?? body.predictive_outlook),
    strategicWeeklyCoaching: pickStrategicWeeklyCoaching(
      body.strategicWeeklyCoaching ?? body.strategic_weekly_coaching,
    ),
    emotionalSummary: pickEmotionalSummary(body.emotionalSummary ?? body.emotional_summary),
    dailyNarrativeSummary: pickStr(body, 'dailyNarrativeSummary', 'daily_narrative_summary') ?? null,
    narrativeProgression: pickStr(body, 'narrativeProgression', 'narrative_progression') ?? null,
    assistantReasoning: pickAssistantReasoning(body.assistantReasoning ?? body.assistant_reasoning),
    assistantGuidance: pickAssistantGuidance(body.assistantGuidance ?? body.assistant_guidance),
    humanizedLabels: pickHumanizedLabels(body.humanizedLabels ?? body.humanized_labels),
    personalizationContext: pickPersonalizationContext(
      body.personalizationContext ?? body.personalization_context,
    ),
    personalizedHeadline: pickStr(body, 'personalizedHeadline', 'personalized_headline') ?? null,
    personalizedSupporting: pickStr(body, 'personalizedSupporting', 'personalized_supporting') ?? null,
    personalizedWhyItMatters: pickStr(body, 'personalizedWhyItMatters', 'personalized_why_it_matters') ?? null,
    personalizedNextBestAction: pickStr(body, 'personalizedNextBestAction', 'personalized_next_best_action') ?? null,
    behaviorSignals: pickBehaviorSignals(body.behaviorSignals ?? body.behavior_signals),
    adaptiveReasoning: pickAdaptiveReasoning(body.adaptiveReasoning ?? body.adaptive_reasoning),
    heroStability: pickHeroStability(body.heroStability ?? body.hero_stability),
    experienceState: pickExperienceState(body.experienceState ?? body.experience_state),
    dashboardNarrativeInput:
      body.dashboardNarrativeInput !== null &&
      typeof body.dashboardNarrativeInput === 'object' &&
      !Array.isArray(body.dashboardNarrativeInput)
        ? (body.dashboardNarrativeInput as Record<string, unknown>)
        : body.dashboard_narrative_input !== null &&
            typeof body.dashboard_narrative_input === 'object' &&
            !Array.isArray(body.dashboard_narrative_input)
          ? (body.dashboard_narrative_input as Record<string, unknown>)
          : null,
    dashboardHeader: pickDashboardHeader(body),
    cvProfileId: pickStr(body, 'cvProfileId', 'cv_profile_id') ?? null,
    nextStep: pickItem(nextRaw),
    todaysFocus: pickItemArray(body.todaysFocus ?? body.todays_focus),
    topMatches: pickItemArray(body.topMatches ?? body.top_matches),
    needsAttention: pickItemArray(body.needsAttention ?? body.needs_attention),
    cvClinicNudge: pickItem(body.cvClinicNudge ?? body.cv_clinic_nudge),
    recentAnalysesContinuations: pickItemArray(
      body.recentAnalysesContinuations ?? body.recent_analyses_continuations,
    ),
    freshness:
      body.freshness !== null && typeof body.freshness === 'object' && !Array.isArray(body.freshness)
        ? (body.freshness as Record<string, unknown>)
        : null,
    unifiedPriorities: {
      items: unifiedItemsEarly,
      summary: {
        highPriorityCount: pickNum(unifiedSummaryRaw, 'highPriorityCount', 'high_priority_count'),
        followUpDueCount: pickNum(unifiedSummaryRaw, 'followUpDueCount', 'follow_up_due_count'),
        newOpportunitiesCount: pickNum(unifiedSummaryRaw, 'newOpportunitiesCount', 'new_opportunities_count'),
        currentRecommendationsCount: pickNum(
          unifiedSummaryRaw,
          'currentRecommendationsCount',
          'current_recommendations_count',
        ),
        newRecommendationsCount: pickNum(
          unifiedSummaryRaw,
          'newRecommendationsCount',
          'new_recommendations_count',
        ),
        carryOverRecommendationsCount: pickNum(
          unifiedSummaryRaw,
          'carryOverRecommendationsCount',
          'carry_over_recommendations_count',
        ),
        localRecommendationsCount: pickNum(
          unifiedSummaryRaw,
          'localRecommendationsCount',
          'local_recommendations_count',
        ),
        remoteFallbackRecommendationsCount: pickNum(
          unifiedSummaryRaw,
          'remoteFallbackRecommendationsCount',
          'remote_fallback_recommendations_count',
        ),
        dedupeDroppedCount: pickNum(unifiedSummaryRaw, 'dedupeDroppedCount', 'dedupe_dropped_count'),
        suppressionFamilyCount: pickNum(
          unifiedSummaryRaw,
          'suppressionFamilyCount',
          'suppression_family_count',
        ),
        workflowOrchestration: pickWorkflowOrchestrationFeed(
          unifiedSummaryRaw.workflowOrchestration ?? unifiedSummaryRaw.workflow_orchestration,
        ),
        recommendationQuality: rqRaw
          ? {
              localQualifiedCount: pickNum(rqRaw, 'localQualifiedCount', 'local_qualified_count'),
              localRejectedLowQualityCount: pickNum(
                rqRaw,
                'localRejectedLowQualityCount',
                'local_rejected_low_quality_count',
              ),
              remotePromotedCount: pickNum(rqRaw, 'remotePromotedCount', 'remote_promoted_count'),
              thresholdUsed: pickNum(rqRaw, 'thresholdUsed', 'threshold_used'),
            }
          : null,
        quietDashboardHint: pickStr(unifiedSummaryRaw, 'quietDashboardHint', 'quiet_dashboard_hint') ?? null,
      },
    },
    sinceLastVisit: {
      ...normalizeSinceLastVisitObject(slvRaw),
    },
    progress: {
      actionsCompletedToday: pickNum(progressRaw, 'actionsCompletedToday', 'actions_completed_today'),
      actionsCompletedWeek: pickNum(progressRaw, 'actionsCompletedWeek', 'actions_completed_week'),
      applicationsSubmittedWeek: pickNum(progressRaw, 'applicationsSubmittedWeek', 'applications_submitted_week'),
      followUpsSentWeek: pickNum(progressRaw, 'followUpsSentWeek', 'follow_ups_sent_week'),
      pipelineAdvancedWeek: pickNum(progressRaw, 'pipelineAdvancedWeek', 'pipeline_advanced_week'),
    },
    dailyMission: {
      targetActionsToday: pickNum(missionRaw, 'targetActionsToday', 'target_actions_today'),
      actionsRemainingToday: pickNum(missionRaw, 'actionsRemainingToday', 'actions_remaining_today'),
      recommendedPriorityIds: pickStrArray(
        missionRaw.recommendedPriorityIds ?? missionRaw.recommended_priority_ids,
      ),
      primaryPriorityId:
        pickStr(missionRaw, 'primaryPriorityId', 'primary_priority_id') ??
        pickStrArray(missionRaw.recommendedPriorityIds ?? missionRaw.recommended_priority_ids)[0] ??
        null,
      isMeaningful: missionRaw.isMeaningful === true || missionRaw.is_meaningful === true,
      estimatedMinutes:
        typeof missionRaw.estimatedMinutes === 'number' && Number.isFinite(missionRaw.estimatedMinutes)
          ? missionRaw.estimatedMinutes
          : typeof missionRaw.estimated_minutes === 'number' && Number.isFinite(missionRaw.estimated_minutes)
            ? missionRaw.estimated_minutes
            : null,
      hiddenReasonIfNone: (() => {
        const s = String(pickStr(missionRaw, 'hiddenReasonIfNone', 'hidden_reason_if_none') ?? '').toLowerCase();
        return s === 'no_meaningful_action' || s === 'all_done' || s === 'insufficient_data' ? s : null;
      })(),
      impactLabel: pickStrOrNull(missionRaw, 'impactLabel', 'impact_label'),
      completionRewardCopy: pickStrOrNull(
        missionRaw,
        'completionRewardCopy',
        'completion_reward_copy',
      ),
      progressContext: pickStrOrNull(missionRaw, 'progressContext', 'progress_context'),
    },
    continuationState: {
      hasNew: continuationRaw.hasNew === true || continuationRaw.has_new === true,
      message: pickStrOrNull(continuationRaw, 'message'),
      suggestedPriorityId: pickStrOrNull(continuationRaw, 'suggestedPriorityId', 'suggested_priority_id'),
      specificTaskLabel: pickStrOrNull(continuationRaw, 'specificTaskLabel', 'specific_task_label'),
      taskDisplayTitle: pickStrOrNull(continuationRaw, 'taskDisplayTitle', 'task_display_title'),
      resolvedRoute: pickStrOrNull(continuationRaw, 'resolvedRoute', 'resolved_route'),
      routeValidated:
        typeof continuationRaw.routeValidated === 'boolean'
          ? continuationRaw.routeValidated
          : typeof continuationRaw.route_validated === 'boolean'
            ? continuationRaw.route_validated
            : null,
      routeValidationReason: (() => {
        const s = String(
          pickStr(continuationRaw, 'routeValidationReason', 'route_validation_reason') ?? '',
        ).toLowerCase();
        return s === 'ok' || s === 'missing_job' || s === 'missing_application' || s === 'inaccessible'
          ? s
          : null;
      })(),
      taskLabelQuality: (() => {
        const s = String(pickStr(continuationRaw, 'taskLabelQuality', 'task_label_quality') ?? '').toLowerCase();
        return s === 'specific' || s === 'heuristic' ? s : null;
      })(),
      taskRationaleShort: pickStrOrNull(continuationRaw, 'taskRationaleShort', 'task_rationale_short'),
      consistency: continuationConsistencyRaw
        ? {
            source: (() => {
              const s = String(pickStr(continuationConsistencyRaw, 'source') ?? '').toLowerCase();
              return s === 'unified_priority' || s === 'none' ? s : null;
            })(),
            selectedPriorityId: pickStrOrNull(
              continuationConsistencyRaw,
              'selectedPriorityId',
              'selected_priority_id',
            ),
            selectedRoute: pickStrOrNull(continuationConsistencyRaw, 'selectedRoute', 'selected_route'),
            idFoundInUnified:
              continuationConsistencyRaw.idFoundInUnified === true ||
              continuationConsistencyRaw.id_found_in_unified === true,
            routeMatchedUnified:
              continuationConsistencyRaw.routeMatchedUnified === true ||
              continuationConsistencyRaw.route_matched_unified === true,
            mismatchReason: (() => {
              const s = String(
                pickStr(continuationConsistencyRaw, 'mismatchReason', 'mismatch_reason') ?? '',
              ).toLowerCase();
              return s === 'no_unified_items' || s === 'id_missing' || s === 'route_mismatch' ? s : null;
            })(),
          }
        : null,
      estimatedMinutesLeft:
        typeof continuationRaw.estimatedMinutesLeft === 'number' &&
        Number.isFinite(continuationRaw.estimatedMinutesLeft)
          ? continuationRaw.estimatedMinutesLeft
          : typeof continuationRaw.estimated_minutes_left === 'number' &&
              Number.isFinite(continuationRaw.estimated_minutes_left)
            ? continuationRaw.estimated_minutes_left
            : null,
      urgencyLabel: pickStrOrNull(continuationRaw, 'urgencyLabel', 'urgency_label'),
      remainingSteps:
        typeof continuationRaw.remainingSteps === 'number' && Number.isFinite(continuationRaw.remainingSteps)
          ? continuationRaw.remainingSteps
          : typeof continuationRaw.remaining_steps === 'number' && Number.isFinite(continuationRaw.remaining_steps)
            ? continuationRaw.remaining_steps
            : null,
      interruptionAgeHours:
        typeof continuationRaw.interruptionAgeHours === 'number' &&
        Number.isFinite(continuationRaw.interruptionAgeHours)
          ? continuationRaw.interruptionAgeHours
          : typeof continuationRaw.interruption_age_hours === 'number' &&
              Number.isFinite(continuationRaw.interruption_age_hours)
            ? continuationRaw.interruption_age_hours
            : null,
      resumeConfidence:
        typeof continuationRaw.resumeConfidence === 'number' && Number.isFinite(continuationRaw.resumeConfidence)
          ? Math.max(0, Math.min(100, Math.round(continuationRaw.resumeConfidence)))
          : typeof continuationRaw.resume_confidence === 'number' &&
              Number.isFinite(continuationRaw.resume_confidence)
            ? Math.max(0, Math.min(100, Math.round(continuationRaw.resume_confidence)))
            : null,
      lastMeaningfulAction: (() => {
        const raw =
          continuationRaw.lastMeaningfulAction ?? continuationRaw.last_meaningful_action;
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const r = raw as Record<string, unknown>;
        const priorityId = String(pickStr(r, 'priorityId', 'priority_id') ?? '').trim();
        if (!priorityId) return null;
        return {
          priorityId,
          kind: pickStrOrNull(r, 'kind'),
          title: pickStrOrNull(r, 'title'),
          ctaHint: pickStrOrNull(r, 'ctaHint', 'cta_hint'),
        };
      })(),
    },
    reentrySummary: {
      newStrongMatchesCount: pickNum(reentryRaw, 'newStrongMatchesCount', 'new_strong_matches_count'),
      nearCompletionCount: pickNum(reentryRaw, 'nearCompletionCount', 'near_completion_count'),
      stalledButRecoverableCount: pickNum(
        reentryRaw,
        'stalledButRecoverableCount',
        'stalled_but_recoverable_count',
      ),
      topReasonsToReturn: pickStrArray(reentryRaw.topReasonsToReturn ?? reentryRaw.top_reasons_to_return),
    },
    dashboardMode: pickDashboardMode(
      body.dashboardMode ??
        body.dashboard_mode ??
        ((body.dashboardHeader as Record<string, unknown> | undefined)?.dashboardMode ?? null),
    ),
    recommendedSections: (() => {
      const bodySections = pickRecommendedSections(body.recommendedSections ?? body.recommended_sections);
      if (bodySections.length > 0) return bodySections;
      const header = pickDashboardHeader(body);
      return header?.recommendedSections ?? [];
    })(),
    sectionPayloads: pickSectionPayloads(body.sectionPayloads ?? body.section_payloads),
    normalizedSectionTitles: pickNormalizedSectionTitles(
      body.normalizedSectionTitles ?? body.normalized_section_titles,
    ),
    orchestrationVersion: (() => {
      const v = body.orchestrationVersion ?? body.orchestration_version;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      return 0;
    })(),
    recommendationGraph: pickRecommendationGraph(body.recommendationGraph ?? body.recommendation_graph),
    orchestratedRecommendations: pickOrchestratedRecommendations(
      body.orchestratedRecommendations ?? body.orchestrated_recommendations,
    ),
    continuationHint: pickContinuationHint(body.continuationHint ?? body.continuation_hint),
    dashboardNarrative: pickDashboardNarrative(body.dashboardNarrative ?? body.dashboard_narrative),
    dashboardExperience: pickDashboardExperience(body.dashboardExperience ?? body.dashboard_experience),
    resumeTarget: pickResumeTarget(body.resumeTarget ?? body.resume_target),
    habitProgress: pickHabitProgress(body.habitProgress ?? body.habit_progress),
    achievements: pickTodayPlanAchievementsFromBody(body),
    careerAchievements: pickCareerAchievements(body.careerAchievements ?? body.career_achievements),
    milestoneCelebration: pickMilestoneCelebration(body.milestoneCelebration ?? body.milestone_celebration),
    experienceStability: pickExperienceStability(body.experienceStability ?? body.experience_stability),
    dashboardLayoutConfig: pickDashboardLayoutConfig(body.dashboardLayoutConfig ?? body.dashboard_layout_config),
    priorityIntelligence: pickPriorityIntelligenceMeta(body.priorityIntelligence ?? body.priority_intelligence),
    commandBar: pickCommandBar(body.commandBar ?? body.command_bar),
    dashboardVitals: pickDashboardVitals(body.dashboardVitals ?? body.dashboard_vitals),
    ...pickContinuationBundle(body),
    ...(() => {
      const interviewPreparationCards = pickInterviewPreparationCards(
        body.interviewPreparationCards ?? body.interview_preparation_cards,
      );
      const prepTotalRaw =
        body.interviewPreparationCardsTotalCount ??
        body.interview_preparation_cards_total_count;
      const interviewPreparationCardsTotalCount =
        typeof prepTotalRaw === 'number' && Number.isFinite(prepTotalRaw)
          ? Math.max(0, Math.round(prepTotalRaw))
          : interviewPreparationCards?.length
            ? interviewPreparationCards.length
            : null;
      return { interviewPreparationCards, interviewPreparationCardsTotalCount };
    })(),
    upcomingInterviews: upcomingInterviewsMerged,
    upcomingInterviewCount: (() => {
      const countRaw = body.upcomingInterviewCount ?? body.upcoming_interview_count;
      if (typeof countRaw === 'number' && Number.isFinite(countRaw)) return Math.max(0, Math.round(countRaw));
      return upcomingInterviewsMerged.length > 0 ? upcomingInterviewsMerged.length : null;
    })(),
    focusItems: focusItemsEarly,
    focusItemsTotalCount: (() => {
      const raw = body.focusItemsTotalCount ?? body.focus_items_total_count;
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
      return focusItemsEarly?.length ? focusItemsEarly.length : null;
    })(),
    staleApplicationItems: pickStaleApplicationItems(
      body.staleApplicationItems ?? body.stale_application_items,
    ),
    staleApplicationItemsTotalCount: (() => {
      const raw =
        body.staleApplicationItemsTotalCount ?? body.stale_application_items_total_count;
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
      const items = pickStaleApplicationItems(
        body.staleApplicationItems ?? body.stale_application_items,
      );
      return items?.length ? items.length : null;
    })(),
    staleApplicationItemsViewAllHref:
      pickStrOrNull(
        body,
        'staleApplicationItemsViewAllHref',
        'stale_application_items_view_all_href',
      ) ?? null,
    dashboardEmptyStates: pickDashboardEmptyStates(body.dashboardEmptyStates ?? body.dashboard_empty_states),
  };
}

/** GET /dashboard/quiet-applications — full quiet queue. */
export type DashboardQuietApplicationsResponsePayload = {
  generatedAt: string;
  staleApplicationItems: DashboardStaleApplicationItemPayload[];
  staleApplicationItemsTotalCount: number | null;
};

/** GET /dashboard/interview-prep — full interview activity list. */
export type DashboardInterviewPrepResponsePayload = {
  generatedAt: string;
  upcomingInterviews: UpcomingInterviewItem[];
  upcomingInterviewCount: number | null;
  interviewPreparationCards: InterviewPreparationCardPayload[];
  interviewPreparationCardsTotalCount: number | null;
};

export function normalizeDashboardInterviewPrep(
  raw: unknown,
): DashboardInterviewPrepResponsePayload {
  const body = unwrapEnvelope(raw);
  const generatedAt = String(pickStr(body, 'generatedAt', 'generated_at') ?? '').trim();
  const upcomingWire = resolveWireUpcomingInterviews(body);
  const focusItems = pickDashboardFocusItems(body.focusItems ?? body.focus_items);
  const unifiedRaw =
    body.unifiedPriorities !== null &&
    typeof body.unifiedPriorities === 'object' &&
    !Array.isArray(body.unifiedPriorities)
      ? (body.unifiedPriorities as Record<string, unknown>)
      : body.unified_priorities !== null &&
          typeof body.unified_priorities === 'object' &&
          !Array.isArray(body.unified_priorities)
        ? (body.unified_priorities as Record<string, unknown>)
        : null;
  const unifiedItems =
    unifiedRaw && unifiedRaw.items !== undefined
      ? pickUnifiedPriorityItems(unifiedRaw.items)
      : [];
  const upcomingInterviews = mergeUpcomingInterviewsFromWireAndFocus(
    upcomingWire,
    focusItems,
    unifiedItems,
  );
  const cards =
    pickInterviewPreparationCards(
      body.interviewPreparationCards ?? body.interview_preparation_cards,
    ) ?? [];
  const upcomingCountRaw = body.upcomingInterviewCount ?? body.upcoming_interview_count;
  const upcomingInterviewCount =
    typeof upcomingCountRaw === 'number' && Number.isFinite(upcomingCountRaw)
      ? Math.max(0, Math.round(upcomingCountRaw))
      : upcomingInterviews.length > 0
        ? upcomingInterviews.length
        : null;
  const prepTotalRaw =
    body.interviewPreparationCardsTotalCount ?? body.interview_preparation_cards_total_count;
  const interviewPreparationCardsTotalCount =
    typeof prepTotalRaw === 'number' && Number.isFinite(prepTotalRaw)
      ? Math.max(0, Math.round(prepTotalRaw))
      : cards.length > 0
        ? cards.length
        : null;
  return {
    generatedAt: generatedAt || new Date().toISOString(),
    upcomingInterviews,
    upcomingInterviewCount,
    interviewPreparationCards: cards,
    interviewPreparationCardsTotalCount,
  };
}

/** GET /dashboard/follow-up-jobs — full follow-up queue. */
export type DashboardFollowUpJobsResponsePayload = {
  generatedAt: string;
  followUpJobs: FollowUpJobRowPayload[];
  followUpJobsTotalCount: number | null;
};

export function normalizeDashboardFollowUpJobs(
  raw: unknown,
): DashboardFollowUpJobsResponsePayload {
  const body = unwrapEnvelope(raw);
  const generatedAt = String(pickStr(body, 'generatedAt', 'generated_at') ?? '').trim();
  const followUpJobs = pickFollowUpJobsArray(body.followUpJobs ?? body.follow_up_jobs);
  return {
    generatedAt: generatedAt || new Date().toISOString(),
    followUpJobs,
    followUpJobsTotalCount: pickFollowUpJobsTotalCount(body),
  };
}

export function normalizeDashboardQuietApplications(
  raw: unknown,
): DashboardQuietApplicationsResponsePayload {
  const body = unwrapEnvelope(raw);
  const generatedAt = String(pickStr(body, 'generatedAt', 'generated_at') ?? '').trim();
  const items =
    pickStaleApplicationItems(body.staleApplicationItems ?? body.stale_application_items) ?? [];
  const totalRaw =
    body.staleApplicationItemsTotalCount ?? body.stale_application_items_total_count;
  const staleApplicationItemsTotalCount =
    typeof totalRaw === 'number' && Number.isFinite(totalRaw)
      ? Math.max(0, Math.round(totalRaw))
      : items.length > 0
        ? items.length
        : null;
  return {
    generatedAt: generatedAt || new Date().toISOString(),
    staleApplicationItems: items,
    staleApplicationItemsTotalCount,
  };
}

/** GET /dashboard/focus — ranked feed subset (not full today-plan). */
export type DashboardFocusResponsePayload = {
  generatedAt: string;
  focusItems: DashboardFocusItemPayload[] | null;
  continuationItems: DashboardContinuationItemPayload[] | null;
  continuationCount: number | null;
  dashboardVitals: DashboardVitalsPayload | null;
};

export function normalizeDashboardFocus(raw: unknown): DashboardFocusResponsePayload {
  const body = unwrapEnvelope(raw);
  const generatedAt = String(pickStr(body, 'generatedAt', 'generated_at') ?? '').trim();
  const focusRaw = body.focusItems ?? body.focus_items;
  const focusItems = focusRaw === undefined ? null : pickDashboardFocusItems(focusRaw);
  const bundle = pickContinuationBundle(body);
  const dashboardVitals = pickDashboardVitals(body.dashboardVitals ?? body.dashboard_vitals);
  return {
    generatedAt: generatedAt || new Date().toISOString(),
    focusItems,
    continuationItems: bundle.continuationItems,
    continuationCount: bundle.continuationCount,
    dashboardVitals,
  };
}

export function normalizeSinceLastVisit(raw: unknown): SinceLastVisitPayload {
  const body = unwrapEnvelope(raw);
  const slv =
    body.sinceLastVisit !== null && typeof body.sinceLastVisit === 'object' && !Array.isArray(body.sinceLastVisit)
      ? (body.sinceLastVisit as Record<string, unknown>)
      : body.since_last_visit !== null &&
          typeof body.since_last_visit === 'object' &&
          !Array.isArray(body.since_last_visit)
        ? (body.since_last_visit as Record<string, unknown>)
        : body;
  return normalizeSinceLastVisitObject(slv);
}

function strField(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Optional item fields — routing uses `action.type` + ids, with light reason/source heuristics when payloads drift. */
export type TodayPlanLinkContext = {
  source?: string | null;
  reasonCodes?: string[];
};

function upperCodes(ctx?: TodayPlanLinkContext): string[] {
  return (ctx?.reasonCodes ?? []).map((c) => c.toUpperCase());
}

/** Discovery-style rows (board / listing-first), including DISCOVERY_FIT in reasonCodes. */
export function isDiscoveryPlanContext(ctx?: TodayPlanLinkContext): boolean {
  if (!ctx) return false;
  if ((ctx.source ?? '').toUpperCase() === 'DISCOVERY') return true;
  return upperCodes(ctx).some((u) => u.includes('DISCOVERY'));
}

/** “Finish apply” / pipeline nudges — should land in Job Hub, never re-open Analyzer. */
export function isAnalyzedNotAppliedContext(ctx?: TodayPlanLinkContext): boolean {
  return upperCodes(ctx).some((u) => {
    if (u.includes('ANALYZED_NOT_APPLIED')) return true;
    if (u.includes('ANALYZED') && u.includes('NOT') && u.includes('APPLIED')) return true;
    return false;
  });
}

/** Server `cta.href` sometimes points at Analyze for hub/discovery intents — ignore those when we can route better. */
function shouldPreferComputedHrefOverServer(serverHref: string, ctx?: TodayPlanLinkContext): boolean {
  const h = serverHref.toLowerCase();
  if (!h.includes('analyze')) return false;
  if (isAnalyzedNotAppliedContext(ctx)) return true;
  if (isDiscoveryPlanContext(ctx)) return true;
  return false;
}

function jobBoardHrefWithListing(jobListingId: string): string {
  const q = new URLSearchParams({ jobListingId }).toString();
  return `/dashboard/job-board?${q}`;
}

function normalizeActionType(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
}

function hubQueryFromAction(rec: Record<string, unknown>): string | null {
  const applicationId = strField(rec, 'applicationId', 'application_id');
  const jobAnalysisId = strField(rec, 'jobAnalysisId', 'job_analysis_id', 'canonicalJobId', 'canonical_job_id');
  const bookmarkId = strField(rec, 'bookmarkId', 'bookmark_id');
  const jobListingId = strField(rec, 'jobListingId', 'job_listing_id');
  const params = new URLSearchParams();
  if (applicationId) params.set('applicationId', applicationId);
  else if (jobAnalysisId) params.set('jobId', jobAnalysisId);
  else if (bookmarkId) params.set('bookmarkId', bookmarkId);
  else if (jobListingId) params.set('jobListingId', jobListingId);
  else return null;
  const q = params.toString();
  return q ? `?${q}` : null;
}

/**
 * Map backend CTA `action.type` + ids to an in-app path.
 * Prefer `action` over `cta.href` when href points at Analyze but reason codes imply Hub or Job Board.
 * @see backend handoff: OPEN_DISCOVERY, OPEN_JOB_ANALYZE, OPEN_JOB_HUB, OPEN_TAILOR, OPEN_CV_CLINIC
 */
export function resolveTodayPlanHref(cta: TodayPlanCta, ctx?: TodayPlanLinkContext): string | null {
  const computed = resolveTodayPlanHrefFromAction(cta, ctx);
  const h = cta.href?.trim();
  if (h?.startsWith('/')) {
    if (shouldPreferComputedHrefOverServer(h, ctx)) {
      return normalizeTodayPlanRoute(computed ?? (isDiscoveryPlanContext(ctx) ? '/dashboard/job-board' : '/dashboard/jobs'));
    }
    return normalizeTodayPlanRoute(h);
  }
  return normalizeTodayPlanRoute(computed);
}

/**
 * Guard against stale/deprecated internal routes while preserving query params.
 * Keeps routing additive and avoids broken pages from older deep links.
 */
export function normalizeTodayPlanRoute(href: string | null | undefined): string | null {
  const raw = (href ?? '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '');
  if (!raw) return null;
  if (!raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw, 'https://applymate.invalid');
    u.pathname = u.pathname.replace(/['"]+$/g, '');
    return normalizeDashboardRoute(`${u.pathname}${u.search}`);
  } catch {
    const cleaned = raw.replace(/['"]+$/g, '');
    return normalizeDashboardRoute(cleaned);
  }
}

/** Normalize routed destination for dedupe (pathname + stable entity ids from query). */
function normalizeHrefPathAndStableQuery(href: string): string {
  const trimmed = href.trim();
  if (!trimmed.startsWith('/')) return trimmed.toLowerCase();
  try {
    const u = new URL(trimmed, 'https://applymate.invalid');
    const path = u.pathname.replace(/\/$/, '') || '/';
    const keys = ['profileId', 'jobId', 'jobListingId', 'applicationId', 'bookmarkId'];
    const parts = [path.toLowerCase()];
    for (const k of keys) {
      const v = u.searchParams.get(k);
      if (v) parts.push(`${k.toLowerCase()}=${v}`);
    }
    return parts.join('|');
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * Dedupe key for today's plan rows: same routed destination + human-visible title + kind
 * collapses duplicate unified priorities and hides redundant legacy sections.
 */
export function todayPlanDestinationDedupeKey(
  title: string,
  kind: string | undefined | null,
  cta: TodayPlanCta,
  ctx?: TodayPlanLinkContext,
): string {
  const resolved = resolveTodayPlanHref(cta, ctx) ?? '';
  const hrefKey = normalizeHrefPathAndStableQuery(resolved);
  const normTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const k = (kind ?? '').trim().toLowerCase();
  return `${k}::${hrefKey}::${normTitle}`;
}

export function todayPlanItemDedupeKey(item: TodayPlanItem): string {
  return todayPlanDestinationDedupeKey(item.title, 'plan_item', item.cta, {
    source: item.source,
    reasonCodes: item.reasonCodes,
  });
}

export function unifiedPriorityDedupeKey(item: UnifiedPriorityItem): string {
  const wf = (item.workflowEntityKey ?? '').trim();
  if (wf) return `workflow_entity::${wf}`;
  return todayPlanDestinationDedupeKey(item.title, item.kind, item.cta, {
    source: null,
    reasonCodes: item.reasonCodes,
  });
}

/**
 * Collapses duplicate "open Job Board / discovery" unified rows that share the same generic board entry
 * (no specific listing) — e.g. two cards titled "Review jobs matched to your CV".
 */
export function discoveryJobBoardCanonicalDedupeKey(item: UnifiedPriorityItem): string | null {
  const ctx: TodayPlanLinkContext = { source: null, reasonCodes: item.reasonCodes };
  const raw = resolveTodayPlanHref(item.cta, ctx) ?? '';
  let path = '';
  let jobListingId: string | null = null;
  try {
    const u = new URL(raw, 'https://applymate.invalid');
    path = (u.pathname.replace(/\/$/, '') || '/').toLowerCase();
    jobListingId = u.searchParams.get('jobListingId');
  } catch {
    return null;
  }
  if (path !== '/dashboard/job-board') return null;
  if (jobListingId) return null;

  const t = item.title.trim().toLowerCase();
  const looksLikeReviewMatches =
    (t.includes('review') && (t.includes('match') || t.includes('matched'))) ||
    (t.includes('job') && t.includes('discover'));
  const discoveryish =
    isDiscoveryPlanContext(ctx) ||
    (item.reasonCodes ?? []).some((c) => c.toUpperCase().includes('DISCOVERY')) ||
    String(item.kind ?? '').toLowerCase().includes('discover');

  if (!discoveryish && !looksLikeReviewMatches) return null;

  return 'canonical:job-board:discovery-generic';
}

function resolveTodayPlanHrefFromAction(cta: TodayPlanCta, ctx?: TodayPlanLinkContext): string | null {
  const a = cta.action;
  if (!a || typeof a !== 'object') return null;
  const rec = a as Record<string, unknown>;
  const type = normalizeActionType(strField(rec, 'type', 'actionType', 'kind') ?? '');

  const jobAnalysisId = strField(rec, 'jobAnalysisId', 'job_analysis_id');
  const jobListingId = strField(rec, 'jobListingId', 'job_listing_id');
  const cvProfileId = strField(rec, 'cvProfileId', 'cv_profile_id');
  const interviewPrepJobAnalysisId = strField(rec, 'interviewPrepJobAnalysisId', 'interview_prep_job_analysis_id');
  const interviewPrepJobTitle = strField(rec, 'interviewPrepJobTitle', 'interview_prep_job_title');
  const interviewPrepCompany = strField(rec, 'interviewPrepCompany', 'interview_prep_company');
  const interviewPrepCvProfileId = strField(rec, 'interviewPrepCvProfileId', 'interview_prep_cv_profile_id');
  const interviewPrepPreferredCvProfileId = strField(
    rec,
    'interviewPrepPreferredCvProfileId',
    'interview_prep_preferred_cv_profile_id',
    'preferredCvProfileId',
    'preferred_cv_profile_id',
  );
  const interviewPrepAnalyzedCvProfileId = strField(
    rec,
    'interviewPrepAnalyzedCvProfileId',
    'interview_prep_analyzed_cv_profile_id',
    'analyzedCvProfileId',
    'analyzed_cv_profile_id',
  );
  const interviewPrepTailoringCvProfileId = strField(
    rec,
    'interviewPrepTailoringCvProfileId',
    'interview_prep_tailoring_cv_profile_id',
    'tailoringCvProfileId',
    'tailoring_cv_profile_id',
  );
  const discovery = isDiscoveryPlanContext(ctx);
  const analyzedNotApplied = isAnalyzedNotAppliedContext(ctx);

  if (type === 'OPEN_DISCOVERY') {
    return jobListingId ? jobBoardHrefWithListing(jobListingId) : '/dashboard/job-board';
  }

  if (type === 'OPEN_JOB_ANALYZE') {
    const applicationIdEarly = strField(rec, 'applicationId', 'application_id');
    if (applicationIdEarly) {
      return `/dashboard/jobs?applicationId=${encodeURIComponent(applicationIdEarly)}`;
    }
    if (analyzedNotApplied && jobAnalysisId) {
      return `/dashboard/jobs?jobId=${encodeURIComponent(jobAnalysisId)}`;
    }
    if (discovery && jobListingId) {
      return jobBoardHrefWithListing(jobListingId);
    }
    if (jobAnalysisId) {
      return `/dashboard/jobs?jobId=${encodeURIComponent(jobAnalysisId)}`;
    }
    if (jobListingId) {
      return `/dashboard/jobs/analyze?jobListingId=${encodeURIComponent(jobListingId)}`;
    }
    return '/dashboard/jobs/analyze';
  }

  if (type === 'OPEN_JOB_HUB') {
    const q = hubQueryFromAction(rec);
    return q ? `/dashboard/jobs${q}` : '/dashboard/jobs';
  }

  if (type === 'OPEN_TAILOR') {
    if (!jobAnalysisId) return '/dashboard/jobs/analyze';
    const jl = jobListingId ? `&jobListingId=${encodeURIComponent(jobListingId)}` : '';
    return `/dashboard/jobs/analyze?jobId=${encodeURIComponent(jobAnalysisId)}&openTailor=1${jl}`;
  }

  if (type === 'OPEN_CV_CLINIC') {
    return cvProfileId ? `/dashboard/cv?profileId=${encodeURIComponent(cvProfileId)}` : '/dashboard/cv';
  }
  if (type === 'OPEN_INTERVIEW_PREP' || type === 'OPEN_INTERVIEW') {
    const qp = new URLSearchParams();
    const jId = interviewPrepJobAnalysisId ?? jobAnalysisId;
    const cvId = interviewPrepCvProfileId ?? cvProfileId;
    if (jId) qp.set('jobAnalysisId', jId);
    if (interviewPrepJobTitle) qp.set('jobTitle', interviewPrepJobTitle);
    if (interviewPrepCompany) qp.set('company', interviewPrepCompany);
    if (cvId) qp.set('cvProfileId', cvId);
    if (interviewPrepPreferredCvProfileId) qp.set('preferredCvProfileId', interviewPrepPreferredCvProfileId);
    if (interviewPrepAnalyzedCvProfileId) qp.set('analyzedCvProfileId', interviewPrepAnalyzedCvProfileId);
    if (interviewPrepTailoringCvProfileId) qp.set('tailoringCvProfileId', interviewPrepTailoringCvProfileId);
    return `/dashboard/interview${qp.toString() ? `?${qp.toString()}` : ''}`;
  }

  /** Legacy / transitional payloads (substring matching) — prefer explicit `action.type` from API. */
  const jobKey = strField(rec, 'jobKey', 'job_key');
  const applicationId = strField(rec, 'applicationId', 'application_id');

  if (applicationId) {
    return `/dashboard/jobs?applicationId=${encodeURIComponent(applicationId)}`;
  }
  if (analyzedNotApplied && jobAnalysisId) {
    return `/dashboard/jobs?jobId=${encodeURIComponent(jobAnalysisId)}`;
  }
  if (discovery && jobListingId) {
    return jobBoardHrefWithListing(jobListingId);
  }
  if (jobAnalysisId) {
    return `/dashboard/jobs?jobId=${encodeURIComponent(jobAnalysisId)}`;
  }
  if (jobKey) {
    return `/dashboard/jobs?jobKey=${encodeURIComponent(jobKey)}`;
  }
  if (type.includes('ANALYZE') && !type.includes('HUB')) {
    if (discovery && jobListingId) return jobBoardHrefWithListing(jobListingId);
    if (jobListingId) return `/dashboard/jobs/analyze?jobListingId=${encodeURIComponent(jobListingId)}`;
    return '/dashboard/jobs/analyze';
  }
  if (type.includes('CV') || type.includes('CLINIC') || type.includes('RESUME')) {
    return cvProfileId ? `/dashboard/cv?profileId=${encodeURIComponent(cvProfileId)}` : '/dashboard/cv';
  }
  if (type.includes('INTERVIEW')) {
    const qp = new URLSearchParams();
    const jId = interviewPrepJobAnalysisId ?? jobAnalysisId;
    const cvId = interviewPrepCvProfileId ?? cvProfileId;
    if (jId) qp.set('jobAnalysisId', jId);
    if (interviewPrepJobTitle) qp.set('jobTitle', interviewPrepJobTitle);
    if (interviewPrepCompany) qp.set('company', interviewPrepCompany);
    if (cvId) qp.set('cvProfileId', cvId);
    return `/dashboard/interview${qp.toString() ? `?${qp.toString()}` : ''}`;
  }
  if (type.includes('HUB') || type.includes('TRACKER') || type.includes('PIPELINE')) {
    const q = hubQueryFromAction(rec);
    return q ? `/dashboard/jobs${q}` : '/dashboard/jobs';
  }

  return null;
}

export function formatReasonCodeLabel(code: string): string {
  return code
    .replace(/^[A-Z_]+::/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const APPLIED_OR_LATER_STATES = new Set([
  'applied',
  'interviewing',
  'interview_scheduled',
  'interviewed',
  'offered',
  'offer_received',
  'negotiating',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
]);

export function isAppliedOrLaterState(state: string | null | undefined, isApplied?: boolean): boolean {
  if (isApplied === true) return true;
  const normalized = String(state ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return APPLIED_OR_LATER_STATES.has(normalized);
}

function isApplyLikePriority(item: UnifiedPriorityItem): boolean {
  const kind = String(item.kind ?? '').trim().toLowerCase();
  if (kind === 'apply' || kind === 'analyze' || kind === 'bookmark_review' || kind === 'discovery') {
    return true;
  }
  const actionType = String(item.compactDisplay?.actionType ?? item.ctaHint ?? '')
    .trim()
    .toUpperCase();
  if (actionType.includes('OPEN_JOB_ANALYZE') || actionType.includes('OPEN_DISCOVERY')) {
    return true;
  }
  return false;
}

export function isPriorityInvalidByState(item: UnifiedPriorityItem): boolean {
  const sourceState = item.stateSnapshot?.sourceState;
  return isAppliedOrLaterState(sourceState) && isApplyLikePriority(item);
}
