import { queryKeys } from '@/lib/queryKeys';
import axios from 'axios';

import {
  mapNormalizedUserToAuthUser,
  normalizeAuthResponse,
  normalizeRefreshResponse,
} from './auth-response';
import { axiosClient, throwIfApiFailureResponse } from './axios';
import {
  aiWaitForResultBody,
  resolveMaybeQueuedAiResponse,
} from './aiBackgroundJob';
import { ensureArray } from './ensure-array';
import {
  normalizeDashboardFocus,
  normalizeSinceLastVisit,
  normalizeTodayPlan,
} from './today-plan';
import type { AtsSimulationReport } from './atsSimulation';
import {
  clampWeeklyStallLimit,
  normalizeWeeklyStallSummary,
} from './weekly-stall-summary';
import { parseJobAnalysisV2 } from './jobAnalysisV2';
import {
  parseJobMatchFactorsBreakdown,
  type JobMatchFactorsBreakdown,
} from './jobMatchFactorsBreakdown';
import {
  parseScoreImprovementGuide,
  type ScoreImprovementGuide,
} from './scoreImprovement';
import { pickApplyUrlFromRecord } from './jobApplyUrlPick';
import {
  normalizeCvAssistantSectionCommandResponse,
  normalizeCvGlobalAssistantCommandResponse,
  normalizeCvGlobalAssistantOperations,
  type CvAssistantCommandResponse,
  type CvGlobalAssistantCommandResponse,
  type CvGlobalAssistantOperation,
  type CvGlobalAssistantOperationKey,
} from './cvGlobalAssistant';
import { sanitizeAssistantClarificationQuestion } from './cvAssistantUserFacing';
import {
  prepareCvChatTextForAi,
  prepareCvSectionTextForAi,
  prepareJobDescriptionForAi,
} from './sanitizeAiPromptInput';
import { parseCvHybridScoring, type CvAiAssessment, type CvScoringMethod, type CvScoringTransparency } from './cvHybridScoring';
import type { CvSectionScoreExplainer } from './cvSectionScoreExplainer';
import {
  normalizeCareerDashboard,
  parseMarkAcceptedResult,
  parseVerificationSubmitResult,
} from './career';
import { interviewPrepApi as interviewPrepApiClient } from './interview-prep-api';
import {
  parseInterviewResultPoll,
  type InterviewEvaluationPollState,
} from './interviewEvaluationPoll';
import { resolveExportFilename } from './exportFilenameFromResponse';
import {
  coerceAiPatchSectionBlob,
  coerceAiPatchToDisplayString,
} from './cvAiPatchDisplay';
import {
  extractCvParseImportSummary,
  type CvParseImportSummary,
} from './cvParseImportSummary';
import {
  parseAcceptAllQuota,
  type CvAcceptAllQuota,
} from './cvAcceptAllQuota';
import {
  normalizeCvMergeProfilesResponse,
  type CvMergeCreatedResult,
  type CvMergeMode,
  type CvMergePreviewResult,
} from './cvProfileMerge';

export type JobSearchUrgency = 'asap' | 'few_months' | 'exploring';

/** GET/PATCH /users/me — partial keys on PATCH merge per key (omit = unchanged). */
/** Nested UI flags from GET/PATCH /users/me (`User.uiPrefs` on the server). */
export type UserUiPrefs = {
  tourCompleted?: boolean;
  /** Cross-device job board location preference (Phase 1). */
  jobSearchLocation?: string;
  [key: string]: unknown;
};

export type JobRankingTier = 'APPLY_NOW' | 'CONSIDER' | 'LOW_MATCH';

export type JobListingRanking = {
  score: number;
  tier: JobRankingTier;
  recommendation: string;
};

export type JobListingExplanation = {
  matchedSkills: string[];
  missingSkills: string[];
  riskFactors: string[];
  seniorityMismatch: 'none' | 'under' | 'over' | 'unknown';
  whyThisJob: string;
  recommendation: string;
};

export type ResolvedGeoLocationDto = {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export type NotificationPrefs = {
  emailHubReminderDue?: boolean;
  /** Reserved; push not wired server-side yet. */
  pushHubReminderDue?: boolean;
  weeklyStallDigest?: boolean;
  /** Daily engagement digest; default enabled when omitted. */
  dailyGrowthDigest?: boolean;
  /** 1–21; server default 3 when omitted. */
  maxMarketingEmailsPerWeek?: number;
};

export type GrowthProgressWindow = 'daily' | 'weekly' | 'monthly';

export type GrowthDailyDirection = {
  generatedAt: string;
  identitySignal: string;
  dailyDirection: {
    primaryPriorityId: string | null;
    recommendedPriorityIds: string[];
    progressContext: string | null;
    impactLabel: string | null;
  };
  continuationState: {
    hasNew: boolean;
    message: string | null;
    suggestedPriorityId: string | null;
    specificTaskLabel: string | null;
    estimatedMinutesLeft: number | null;
    urgencyLabel: string | null;
  };
};

export type GrowthProgress = {
  window: GrowthProgressWindow;
  from: string;
  to: string;
  metrics: {
    jobsProgressed: number;
    followUpsCompleted: number;
    matchQualityAvg: number;
    matchQualityDelta: number;
  };
};

export type GrowthMomentumNudge = {
  id: string;
  title: string;
  message: string;
  actionLabel: string;
  route: string;
  relevanceScore: number;
  updatedAt: string;
};

export type GrowthImmediateFeedback = {
  id: string;
  message: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type GrowthAchievement = {
  id: string;
  type:
    | 'high_match_reached'
    | 'cv_improvement_completed'
    | 'momentum_streak'
    | 'pipeline_progress';
  title: string;
  subtitle: string;
  metricValue: number | null;
  sharePayload: {
    badge: string;
    value: number | null;
    note: string;
  };
  createdAt: string;
};

export type GrowthEventName =
  | 'analyze_completed'
  | 'apply_completed'
  | 'cv_update_completed'
  | 'follow_up_completed'
  | 'suggested_task_started'
  | 'suggested_task_completed'
  | 'daily_direction_completed';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  image?: string;
  /** Home / current city when returned by GET /users/me (job board default location). */
  location?: string | null;
  onboardingCompleted?: boolean;
  selectedFeatures?: string[];
  primaryGoal?: string | null;
  /** FREE tier: from GET /users/me (and often merged into analytics overview). */
  aiUsesToday?: number;
  /** null = PAID / no daily cap */
  aiDailyLimit?: number | null;
  /** null = unlimited (PAID) */
  aiUsesRemaining?: number | null;
  aiUsageResetsAt?: string;
  /** e.g. `"UTC"` — calendar day for the cap */
  aiUsageTimezone?: string;
  /** Denormalized from onboarding / user preferences (GET /users/me). */
  jobSearchUrgency?: JobSearchUrgency | null;
  targetRoles?: string[];
  /** Opaque JSON; known keys in `NotificationPrefs`. */
  notificationPrefs?: NotificationPrefs | null;
  /** When in the future, marketing nudges (e.g. weekly digest) are suppressed. */
  nudgePausedUntil?: string | null;
  /** Server-backed UI flags (e.g. coach-mark tour completion). */
  uiPrefs?: UserUiPrefs | null;
};

/** PATCH /users/me body — only send fields that changed. */
export type UsersPatchMePayload = {
  name?: string;
  notificationPrefs?: Partial<NotificationPrefs>;
  /** `null` or `""` clears pause per API. */
  nudgePausedUntil?: string | null | '';
  /** Convenience: merges into `uiPrefs.tourCompleted` on the server. */
  tourCompleted?: boolean;
  /** Shallow/partial merge of `uiPrefs` per API contract. */
  uiPrefs?: Partial<UserUiPrefs>;
};

export type CVProfile = {
  id: string;
  rawText?: string;
  structured?: {
    summary?: string;
    skills?: string[];
    primarySkills?: string[];
    experience?: Array<{
      title: string;
      company: string;
      bullets?: string[];
      /** job | internship | project */
      type?: string;
      duration?: string;
      startDate?: string;
      endDate?: string;
    }>;
    education?: Array<{
      degree: string;
      school: string;
      year?: string;
    }>;
    keywords?: string[];
    /** intern | junior | mid | senior | lead | principal */
    roleLevel?: string;
    /** Merged via PATCH `structured` when not stored on profile columns */
    linkedin?: string;
    github?: string;
    extras?: Array<{ label?: string; value?: string }>;
  };
  createdAt?: string;
  updatedAt?: string;
  /** CV layout key from API — classic | modern | creative | professional */
  template?: string;
  /** Set once on file upload; null for built/chat CVs. */
  originalTemplate?: string | null;
  /** Raw layout from upload detection (display only). */
  detectedLayout?: string | null;
  headline?: string | null;
  location?: string | null;
  phone?: string | null;
  website?: string | null;
  /** Display label from API when present (e.g. "Name — Role"). */
  name?: string | null;
};

/** Lightweight row from GET /cv/profiles */
export type CvProfileSummary = {
  id: string;
  name: string;
  score: number | null;
  isDefault: boolean;
  template?: string;
  updatedAt?: string;
  /** Present on GET /cv/profiles list items when the API includes them. */
  headline?: string | null;
  location?: string | null;
  /** When the API includes it (e.g. list select). */
  lastScoredAt?: string;
  /** Section count from `_count.sections` when the API includes it. */
  sectionCount?: number;
  /** When set, profile was created from a file upload (list badge). */
  originalTemplate?: string | null;
};

/** Backend often wraps JSON as `{ success, data: { cvProfileId, structured, ... } }`. */
function unwrapApiDataEnvelope(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.success === true && o.data !== null && typeof o.data === 'object') {
      return o.data as Record<string, unknown>;
    }
  }
  return raw !== null && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : {};
}

/** True when structured has no experience and no education rows (parse may be incomplete). */
export function isPartialCvExtractionFromStructured(
  structured: CVProfile['structured'] | undefined,
): boolean {
  const hasExp =
    Array.isArray(structured?.experience) && structured!.experience!.length > 0;
  const hasEdu =
    Array.isArray(structured?.education) && structured!.education!.length > 0;
  return !hasExp && !hasEdu;
}

function mapBodyToCvProfile(body: Record<string, unknown>): CVProfile {
  const id = String(body.cvProfileId ?? body.profileId ?? body.id ?? '').trim();
  const structured =
    body.structured !== null && typeof body.structured === 'object'
      ? (body.structured as CVProfile['structured'])
      : undefined;
  const nullableStr = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    id,
    rawText: typeof body.rawText === 'string' ? body.rawText : undefined,
    structured,
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : undefined,
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : undefined,
    template: typeof body.template === 'string' ? body.template : undefined,
    originalTemplate:
      body.originalTemplate === null
        ? null
        : typeof body.originalTemplate === 'string'
          ? body.originalTemplate
          : undefined,
    detectedLayout:
      body.detectedLayout === null
        ? null
        : typeof body.detectedLayout === 'string'
          ? body.detectedLayout
          : undefined,
    headline: body.headline === null ? null : nullableStr(body.headline),
    location: body.location === null ? null : nullableStr(body.location),
    phone: body.phone === null ? null : nullableStr(body.phone),
    website: body.website === null ? null : nullableStr(body.website),
  };
}

/**
 * POST /cv/parse — `data` is a parse envelope (cvProfileId, structured, …), not a full Prisma row.
 * Canonical id: `cvProfileId` (same as CvProfile.id). `skillsFound` is client-derived only.
 */
export type {
  CvParseImportSummary,
  CvParseImportSectionKind,
  CvParseImportSectionRow,
} from './cvParseImportSummary';

function normalizeCvParseResponse(raw: unknown): {
  profile: CVProfile;
  skillsFound?: number;
  isPartialExtraction: boolean;
  importSummary: CvParseImportSummary | null;
} {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const profile = mapBodyToCvProfile(body);
  const resolvedId = resolveCvProfileId(body, profile);
  if (resolvedId) {
    profile.id = resolvedId;
  }
  let skillsFound: number | undefined =
    typeof body.skillsFound === 'number' ? body.skillsFound : undefined;
  const s = profile.structured;
  if (skillsFound === undefined && Array.isArray(s?.skills)) {
    skillsFound = s!.skills!.length;
  }
  if (skillsFound === undefined && Array.isArray(s?.primarySkills)) {
    skillsFound = s!.primarySkills!.length;
  }
  const isPartialExtraction = isPartialCvExtractionFromStructured(s);
  const importSummary = extractCvParseImportSummary(body);
  return { profile, skillsFound, isPartialExtraction, importSummary };
}

function normalizeCvProfileResponse(raw: unknown): CVProfile {
  const body = unwrapApiDataEnvelope(raw);
  return mapBodyToCvProfile(body);
}

function normalizeCvProfileSummary(raw: unknown): CvProfileSummary {
  const o =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const id = String(o.id ?? o.cvProfileId ?? o.profileId ?? '').trim();
  const scoreRaw = o.score;
  const score =
    typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : null;
  const headline =
    o.headline === null
      ? null
      : typeof o.headline === 'string'
        ? o.headline
        : undefined;
  const location =
    o.location === null
      ? null
      : typeof o.location === 'string'
        ? o.location
        : undefined;
  const lastScoredAt =
    typeof o.lastScoredAt === 'string' ? o.lastScoredAt : undefined;
  let sectionCount: number | undefined;
  const rawCount = o._count;
  if (
    rawCount !== null &&
    typeof rawCount === 'object' &&
    !Array.isArray(rawCount)
  ) {
    const sec = (rawCount as Record<string, unknown>).sections;
    if (typeof sec === 'number' && Number.isFinite(sec)) sectionCount = sec;
  }
  return {
    id,
    name: String(o.name ?? 'Untitled CV'),
    score,
    isDefault: o.isDefault === true,
    template: typeof o.template === 'string' ? o.template : undefined,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
    headline,
    location,
    lastScoredAt,
    sectionCount,
    originalTemplate:
      o.originalTemplate === null
        ? null
        : typeof o.originalTemplate === 'string'
          ? o.originalTemplate
          : undefined,
  };
}

function pickNullableNumber(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

function normalizeNotificationPrefs(raw: unknown): NotificationPrefs | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const emailHub =
    typeof o.emailHubReminderDue === 'boolean'
      ? o.emailHubReminderDue
      : typeof o.email_hub_reminder_due === 'boolean'
        ? o.email_hub_reminder_due
        : undefined;
  const pushHub =
    typeof o.pushHubReminderDue === 'boolean'
      ? o.pushHubReminderDue
      : typeof o.push_hub_reminder_due === 'boolean'
        ? o.push_hub_reminder_due
        : undefined;
  const weekly =
    typeof o.weeklyStallDigest === 'boolean'
      ? o.weeklyStallDigest
      : typeof o.weekly_stall_digest === 'boolean'
        ? o.weekly_stall_digest
        : undefined;
  const maxRaw = o.maxMarketingEmailsPerWeek ?? o.max_marketing_emails_per_week;
  let maxMarketing: number | undefined;
  if (typeof maxRaw === 'number' && Number.isFinite(maxRaw)) {
    maxMarketing = Math.max(1, Math.min(21, Math.round(maxRaw)));
  }
  const out: NotificationPrefs = {};
  if (emailHub !== undefined) out.emailHubReminderDue = emailHub;
  if (pushHub !== undefined) out.pushHubReminderDue = pushHub;
  if (weekly !== undefined) out.weeklyStallDigest = weekly;
  if (maxMarketing !== undefined) out.maxMarketingEmailsPerWeek = maxMarketing;
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeUiPrefs(raw: unknown): UserUiPrefs | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tourCompletedRaw = o.tourCompleted ?? o.tour_completed;
  const tourCompleted =
    typeof tourCompletedRaw === 'boolean' ? tourCompletedRaw : undefined;
  const out: UserUiPrefs = { ...o };
  if (tourCompleted !== undefined) out.tourCompleted = tourCompleted;
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeNudgePausedUntil(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw === '') return null;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = new Date(raw.trim()).getTime();
  return Number.isFinite(t) ? raw.trim() : null;
}

function normalizeUserMe(raw: unknown): AuthUser {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const aiDailyLimit = pickNullableNumber(body.aiDailyLimit);
  const aiUsesRemaining = pickNullableNumber(body.aiUsesRemaining);
  const rawFeatures = Array.isArray(body.selectedFeatures)
    ? (body.selectedFeatures as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : undefined;
  const selectedFeatures =
    rawFeatures && rawFeatures.length > 0
      ? rawFeatures.includes('cv')
        ? rawFeatures
        : [...rawFeatures, 'cv']
      : undefined;

  const locationRaw =
    body.location ?? body.city ?? body.homeLocation ?? body.home_location;
  const location =
    locationRaw === null
      ? null
      : typeof locationRaw === 'string' && locationRaw.trim()
        ? locationRaw.trim()
        : undefined;

  return {
    id: String(body.id ?? ''),
    email: String(body.email ?? ''),
    name: typeof body.name === 'string' ? body.name : undefined,
    image: typeof body.image === 'string' ? body.image : undefined,
    ...(location !== undefined ? { location } : {}),
    onboardingCompleted:
      typeof body.onboardingCompleted === 'boolean'
        ? body.onboardingCompleted
        : typeof body.onboarding_completed === 'boolean'
          ? body.onboarding_completed
          : undefined,
    selectedFeatures,
    primaryGoal:
      body.primaryGoal === null
        ? null
        : typeof body.primaryGoal === 'string'
          ? body.primaryGoal
          : undefined,
    aiUsesToday:
      typeof body.aiUsesToday === 'number' && Number.isFinite(body.aiUsesToday)
        ? body.aiUsesToday
        : undefined,
    aiDailyLimit: aiDailyLimit === undefined ? undefined : aiDailyLimit,
    aiUsesRemaining:
      aiUsesRemaining === undefined ? undefined : aiUsesRemaining,
    aiUsageResetsAt:
      typeof body.aiUsageResetsAt === 'string'
        ? body.aiUsageResetsAt
        : undefined,
    aiUsageTimezone:
      typeof body.aiUsageTimezone === 'string'
        ? body.aiUsageTimezone
        : undefined,
    ...(() => {
      const ju = pickUserJobSearchUrgency(body);
      const tr = normalizeTargetRolesField(
        body.targetRoles ?? body.target_roles,
      );
      const out: Partial<Pick<AuthUser, 'jobSearchUrgency' | 'targetRoles'>> =
        {};
      if (ju !== undefined) out.jobSearchUrgency = ju;
      if (tr !== undefined) out.targetRoles = tr;
      return out;
    })(),
    ...(() => {
      const extra: Partial<
        Pick<AuthUser, 'notificationPrefs' | 'nudgePausedUntil' | 'uiPrefs'>
      > = {};
      if ('notificationPrefs' in body || 'notification_prefs' in body) {
        const raw = body.notificationPrefs ?? body.notification_prefs;
        extra.notificationPrefs =
          raw === null ? null : normalizeNotificationPrefs(raw);
      }
      if ('nudgePausedUntil' in body || 'nudge_paused_until' in body) {
        const raw = body.nudgePausedUntil ?? body.nudge_paused_until;
        extra.nudgePausedUntil =
          raw === null || raw === '' ? null : normalizeNudgePausedUntil(raw);
      }
      if ('uiPrefs' in body || 'ui_prefs' in body) {
        const raw = body.uiPrefs ?? body.ui_prefs;
        extra.uiPrefs = raw === null ? null : normalizeUiPrefs(raw);
      }
      return extra;
    })(),
  };
}

function pickUserJobSearchUrgency(
  body: Record<string, unknown>,
): JobSearchUrgency | null | undefined {
  if (!('jobSearchUrgency' in body) && !('job_search_urgency' in body))
    return undefined;
  return parseJobSearchUrgency(
    body.jobSearchUrgency ?? body.job_search_urgency,
  );
}

/** Server Job Hub pipeline — bookmark `hubPipelineStage` and JobAnalysis `status`. */
export type HubPipelineStage =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'negotiating'
  | 'accepted'
  | 'rejected';

export type RecruiterVerdict = 'STRONG' | 'COMPETITIVE' | 'WEAK';
export type ApplyStrategy = 'APPLY_NOW' | 'TAILOR_FIRST' | 'SKIP';

export type JobAnalysisV2 = {
  recruiterVerdict: RecruiterVerdict;
  axes: {
    skillMatch: number;
    experienceFit: number;
    industryFit: number;
    evidenceStrength: number;
  };
  attackPlan: {
    topCVFixes: string[];
    interviewRisks: string[];
    missingEvidence: string[];
    salaryRange?: string;
  };
  applyStrategy: ApplyStrategy;
};

export type JobAnalysis = {
  id?: string;
  title?: string;
  company?: string;
  matchScore: number;
  scoreBeforeTailoring?: number | null;
  /** Profile used for the match (API `cvProfileId`). */
  cvProfileId?: string | null;
  /** Legacy / alternate keys merged here for older payloads. */
  sourceCvProfileId?: string | null;
  tailoredCvProfileId?: string | null;
  tailoredCvName?: string | null;
  isTailored?: boolean;
  hasCoverLetter?: boolean;
  /** Discovery listing row id when analysis is tied to job board / discovery. */
  jobListingId?: string | null;
  jobListingSourceHash?: string | null;
  /** External employer posting URL when returned by the API. */
  applyUrl?: string | null;
  /** True when POST /jobs/analyze returned an existing row without running AI. */
  reusedExistingAnalysis?: boolean;
  /** How the match score was produced (persisted + preview analyze). */
  scoreSource?: 'heuristic' | 'ai' | string;
  /** Present on some GET /jobs/:id payloads when the API embeds the active draft. */
  tailorDraft?: CvTailorDraft | null;
  breakdown?: {
    skills?: number;
    experience?: number;
    level?: number;
  };
  missingSkills?: Array<{
    name: string;
    importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  strengths?: string[];
  recommendation?: 'STRONG_MATCH' | 'MEDIUM_MATCH' | 'LOW_MATCH';
  createdAt?: string;
  salaryEstimate?: JobSalaryEstimate | null;
  /** Job Hub pipeline — same enum as bookmark `hubPipelineStage` when returned by GET /jobs/:id. */
  status?: HubPipelineStage;
  /** Recruiter intelligence (when ENABLE_ANALYSIS_V2 on server). */
  analysisV2?: JobAnalysisV2;
  /** Post-tailor score context (GET /jobs/:id, analyze, tailor mutations — not on history lists). */
  scoreImprovement?: ScoreImprovementGuide;
  /** Transparent match score factors (3.3). */
  factorsBreakdown?: JobMatchFactorsBreakdown | null;
  /** Soft notice when posting location may not match user profile region. */
  locationEligibility?: LocationEligibility | null;
  /** AI-detected requirements from the posting with CV match status. */
  skillCoverage?: Array<{
    skill: string;
    status: 'found' | 'missing' | string;
    importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
};

export type LocationEligibility = {
  jobLocations?: string[];
  detectedUserCountryCode?: string | null;
  detectedUserCountryName?: string | null;
  message: string;
};

export type {
  JobMatchFactor,
  JobMatchFactorKey,
  JobMatchFactorsBreakdown,
} from './jobMatchFactorsBreakdown';

export type {
  ScoreImprovementGuide,
  ScoreImprovementItem,
  ScoreImprovementBand,
  ScoreImprovementAxis,
} from './scoreImprovement';

/** True when this object looks like a job analysis row from the API. */
function looksLikeJobAnalysisRow(o: Record<string, unknown>): boolean {
  if (Array.isArray(o.missingSkills) && o.missingSkills.length > 0) return true;
  if (Array.isArray(o.strengths) && o.strengths.length > 0) return true;
  if (o.matchScore != null && o.matchScore !== '') return true;
  if (typeof o.jobListingId === 'string' && o.jobListingId.trim()) return true;
  if (typeof o.title === 'string' && typeof o.id === 'string') return true;
  if (o.salaryEstimate !== null && typeof o.salaryEstimate === 'object')
    return true;
  if (o.salary_estimate !== null && typeof o.salary_estimate === 'object')
    return true;
  if (o.analysisV2 != null || o.analysis_v2 != null) return true;
  if (o.factorsBreakdown != null || o.factors_breakdown != null) return true;
  if (Array.isArray(o.skillCoverage) && o.skillCoverage.length > 0) return true;
  if (Array.isArray(o.skill_coverage) && o.skill_coverage.length > 0) return true;
  return false;
}

/**
 * Walks common API shapes until we get the real row:
 * `{ success, data: [...] }`, `{ data: [...] }`, `{ data: { ... } }`, nested arrays, etc.
 */
function drillToJobAnalysisRow(raw: unknown): Record<string, unknown> {
  let cur: unknown = raw;

  for (let depth = 0; depth < 16; depth++) {
    if (cur === null || cur === undefined) return {};

    if (Array.isArray(cur)) {
      if (cur.length === 0) return {};
      cur = cur[0];
      continue;
    }

    if (typeof cur !== 'object') return {};

    const o = cur as Record<string, unknown>;

    if (looksLikeJobAnalysisRow(o)) {
      return o;
    }

    if (o.success === true && 'data' in o && o.data != null) {
      cur = o.data;
      continue;
    }

    if (Array.isArray(o.data)) {
      cur = o.data;
      continue;
    }

    if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
      const inner = o.data as Record<string, unknown>;
      if (looksLikeJobAnalysisRow(inner)) return inner;
      cur = o.data;
      continue;
    }

    let advanced = false;
    for (const key of [
      'result',
      'analysis',
      'job',
      'record',
      'payload',
      'item',
    ]) {
      const v = o[key];
      if (v != null && typeof v === 'object') {
        cur = v;
        advanced = true;
        break;
      }
    }
    if (advanced) continue;

    return o;
  }

  return {};
}

function parseSkillImportance(
  v: unknown,
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const s = String(v ?? 'LOW').toUpperCase();
  if (s === 'CRITICAL') return 'CRITICAL';
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function parseOptionalNumberField(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? parseFloat(v)
        : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeStrengthsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === 'string') return x;
      if (
        x &&
        typeof x === 'object' &&
        'text' in x &&
        typeof (x as { text?: string }).text === 'string'
      ) {
        return (x as { text: string }).text;
      }
      if (
        x &&
        typeof x === 'object' &&
        'strength' in x &&
        typeof (x as { strength?: string }).strength === 'string'
      ) {
        return (x as { strength: string }).strength;
      }
      return null;
    })
    .filter((s): s is string => Boolean(s && s.trim()));
}

/** Persisted analysis id — GET /jobs/:id uses route id; POST /analyze often returns jobId or nested analysis. */
function pickJobAnalysisId(body: Record<string, unknown>): string | undefined {
  const direct = [
    body.id,
    body.jobId,
    body.job_id,
    body.analysisId,
    body.analysis_id,
    body.uuid,
  ];
  for (const v of direct) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const nestedJob = body.job;
  if (
    nestedJob !== null &&
    typeof nestedJob === 'object' &&
    !Array.isArray(nestedJob)
  ) {
    const j = nestedJob as Record<string, unknown>;
    const jid =
      typeof j.id === 'string'
        ? j.id
        : typeof j.jobId === 'string'
          ? j.jobId
          : '';
    if (jid.trim()) return jid.trim();
  }
  const nestedAnalysis = body.analysis;
  if (
    nestedAnalysis !== null &&
    typeof nestedAnalysis === 'object' &&
    !Array.isArray(nestedAnalysis)
  ) {
    const a = nestedAnalysis as Record<string, unknown>;
    const aid =
      typeof a.id === 'string'
        ? a.id
        : typeof a.jobId === 'string'
          ? a.jobId
          : '';
    if (aid.trim()) return aid.trim();
  }
  return undefined;
}

/** Shared parsing for salary blocks on job analysis payloads (nested or top-level). */
function parseSalaryEstimateFromUnknown(
  seRaw: unknown,
): JobSalaryEstimate | null | undefined {
  if (seRaw === null || seRaw === undefined) return undefined;
  if (typeof seRaw !== 'object' || Array.isArray(seRaw)) return null;
  const se = seRaw as Record<string, unknown>;
  const currency = typeof se.currency === 'string' ? se.currency.trim() : '';
  const min =
    typeof se.min === 'number'
      ? se.min
      : typeof se.min === 'string'
        ? parseFloat(se.min)
        : NaN;
  const max =
    typeof se.max === 'number'
      ? se.max
      : typeof se.max === 'string'
        ? parseFloat(se.max)
        : NaN;
  const median =
    typeof se.median === 'number'
      ? se.median
      : typeof se.median === 'string'
        ? parseFloat(se.median)
        : NaN;
  const basis = typeof se.basis === 'string' ? se.basis : 'annual';
  const confRaw = String(se.confidence ?? '').toLowerCase();
  const confidence =
    confRaw === 'high' || confRaw === 'medium' || confRaw === 'low'
      ? confRaw
      : ('medium' as const);
  const note = typeof se.note === 'string' ? se.note : '';
  const sourceRaw = String(
    se.source ?? se.dataSource ?? se.data_source ?? '',
  )
    .trim()
    .toLowerCase();
  const source: JobSalaryEstimateSource | undefined =
    sourceRaw === 'job_description' ||
    sourceRaw === 'job_posting' ||
    sourceRaw === 'posting'
      ? 'job_description'
      : sourceRaw === 'ai_estimate' || sourceRaw === 'ai'
        ? 'ai_estimate'
        : undefined;
  const sourceLabel =
    typeof se.sourceLabel === 'string'
      ? se.sourceLabel
      : typeof se.source_label === 'string'
        ? se.source_label
        : undefined;
  const disclaimer =
    typeof se.disclaimer === 'string' ? se.disclaimer : undefined;
  const dataSource =
    typeof se.dataSource === 'string'
      ? se.dataSource
      : typeof se.data_source === 'string'
        ? se.data_source
        : undefined;
  const marketLocation =
    typeof se.marketLocation === 'string'
      ? se.marketLocation
      : typeof se.market_location === 'string'
        ? se.market_location
        : undefined;
  const marketCountryCode =
    typeof se.marketCountryCode === 'string'
      ? se.marketCountryCode
      : typeof se.market_country_code === 'string'
        ? se.market_country_code
        : undefined;
  const preferredCurrencyCode =
    typeof se.preferredCurrencyCode === 'string'
      ? se.preferredCurrencyCode
      : typeof se.preferred_currency_code === 'string'
        ? se.preferred_currency_code
        : undefined;
  if (currency && Number.isFinite(min) && Number.isFinite(max)) {
    return {
      currency,
      min,
      max,
      median: Number.isFinite(median) ? median : (min + max) / 2,
      basis,
      confidence,
      note,
      ...(source ? { source } : {}),
      ...(sourceLabel?.trim() ? { sourceLabel: sourceLabel.trim() } : {}),
      ...(disclaimer?.trim() ? { disclaimer: disclaimer.trim() } : {}),
      ...(dataSource ? { dataSource } : {}),
      ...(marketLocation?.trim() ? { marketLocation: marketLocation.trim() } : {}),
      ...(marketCountryCode?.trim()
        ? { marketCountryCode: marketCountryCode.trim() }
        : {}),
      ...(preferredCurrencyCode?.trim()
        ? { preferredCurrencyCode: preferredCurrencyCode.trim() }
        : {}),
    };
  }
  return null;
}

function normalizeJobAnalysis(raw: unknown): JobAnalysis {
  const body = drillToJobAnalysisRow(raw);
  const rawScore =
    body.matchScore ??
    body.score ??
    body.overallScore ??
    body.overallMatchScore ??
    body.matchPercentage ??
    body.match_percent;
  const n =
    typeof rawScore === 'number'
      ? rawScore
      : typeof rawScore === 'string'
        ? parseFloat(rawScore)
        : Number(rawScore);
  const matchScore = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;

  const missing: NonNullable<JobAnalysis['missingSkills']> = [];
  const ms =
    body.missingSkills ?? body.missing_skills ?? body.gaps ?? body.skillGaps;
  if (Array.isArray(ms)) {
    for (const item of ms) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const name =
        (typeof o.name === 'string' && o.name.trim()) ||
        (typeof o.skill === 'string' && o.skill.trim()) ||
        (typeof o.skillName === 'string' && o.skillName.trim()) ||
        '';
      if (!name) continue;
      missing.push({ name, importance: parseSkillImportance(o.importance) });
    }
  }

  const strengths = normalizeStrengthsList(
    body.strengths ??
      body.keyStrengths ??
      body.strengthList ??
      body.key_strengths ??
      body.positiveSignals,
  );

  const cvProfileIdTrim =
    (typeof body.cvProfileId === 'string' && body.cvProfileId.trim()) ||
    (typeof body.cv_profile_id === 'string' && body.cv_profile_id.trim()) ||
    null;

  const sourceCvProfileIdLegacy =
    (typeof body.sourceCvProfileId === 'string' &&
      body.sourceCvProfileId.trim()) ||
    (typeof body.source_cv_profile_id === 'string' &&
      body.source_cv_profile_id.trim()) ||
    (typeof body.matchedCvProfileId === 'string' &&
      body.matchedCvProfileId.trim()) ||
    (typeof body.matched_cv_profile_id === 'string' &&
      body.matched_cv_profile_id.trim()) ||
    null;

  const sourceCvProfileId = sourceCvProfileIdLegacy ?? cvProfileIdTrim;

  const jobListingId =
    (typeof body.jobListingId === 'string' && body.jobListingId.trim()) ||
    (typeof body.job_listing_id === 'string' && body.job_listing_id.trim()) ||
    null;

  const jobListingSourceHash =
    (typeof body.jobListingSourceHash === 'string' &&
      body.jobListingSourceHash.trim()) ||
    (typeof body.job_listing_source_hash === 'string' &&
      body.job_listing_source_hash.trim()) ||
    null;

  const applyUrlRaw = pickApplyUrlFromRecord(body);

  const reusedExistingAnalysis =
    body.reusedExistingAnalysis === true ||
    body.reused_existing_analysis === true ||
    body.reusedExisting === true;

  const tailoredCvProfileId =
    typeof body.tailoredCvProfileId === 'string'
      ? body.tailoredCvProfileId
      : typeof body.tailored_cv_profile_id === 'string'
        ? body.tailored_cv_profile_id
        : null;
  const tailoredCvName =
    typeof body.tailoredCvName === 'string'
      ? body.tailoredCvName
      : typeof body.tailored_cv_name === 'string'
        ? body.tailored_cv_name
        : null;
  const isTailored =
    typeof body.isTailored === 'boolean'
      ? body.isTailored
      : typeof body.is_tailored === 'boolean'
        ? body.is_tailored
        : undefined;
  const hasCoverLetter =
    typeof body.hasCoverLetter === 'boolean'
      ? body.hasCoverLetter
      : typeof body.has_cover_letter === 'boolean'
        ? body.has_cover_letter
        : undefined;

  const seRaw = body.salaryEstimate ?? body.salary_estimate;
  const salaryEstimate = parseSalaryEstimateFromUnknown(seRaw);

  let tailorDraft: CvTailorDraft | null | undefined;
  const tdRaw = body.tailorDraft ?? body.tailor_draft;
  if (
    tdRaw !== null &&
    tdRaw !== undefined &&
    typeof tdRaw === 'object' &&
    !Array.isArray(tdRaw)
  ) {
    const td = normalizeCvTailorDraft(tdRaw);
    tailorDraft = td.id.trim() ? td : null;
  } else {
    tailorDraft = undefined;
  }

  const analysisV2 = parseJobAnalysisV2(body.analysisV2 ?? body.analysis_v2);
  const scoreImprovement = parseScoreImprovementGuide(
    body.scoreImprovement ?? body.score_improvement,
  );

  const scoreSourceRaw = body.scoreSource ?? body.score_source;
  const scoreSource =
    typeof scoreSourceRaw === 'string' && scoreSourceRaw.trim()
      ? scoreSourceRaw.trim().toLowerCase()
      : undefined;

  const factorsBreakdown = parseJobMatchFactorsBreakdown(
    body.factorsBreakdown ?? body.factors_breakdown,
  );

  const locationEligibility = parseLocationEligibility(
    body.locationEligibility ?? body.location_eligibility,
  );

  const skillCoverageRaw = body.skillCoverage ?? body.skill_coverage;
  let skillCoverage: JobAnalysis['skillCoverage'];
  if (Array.isArray(skillCoverageRaw) && skillCoverageRaw.length > 0) {
    const parsed: NonNullable<JobAnalysis['skillCoverage']> = [];
    for (const item of skillCoverageRaw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const skill =
        (typeof o.skill === 'string' && o.skill.trim()) ||
        (typeof o.name === 'string' && o.name.trim()) ||
        '';
      if (!skill) continue;
      const statusRaw =
        typeof o.status === 'string' ? o.status.trim().toLowerCase() : 'missing';
      parsed.push({
        skill,
        status: statusRaw === 'found' ? 'found' : 'missing',
        importance: parseSkillImportance(o.importance),
      });
    }
    skillCoverage = parsed.length > 0 ? parsed : undefined;
  }

  return {
    id: pickJobAnalysisId(body),
    title: typeof body.title === 'string' ? body.title : undefined,
    company: typeof body.company === 'string' ? body.company : undefined,
    matchScore,
    scoreBeforeTailoring: parseOptionalNumberField(
      body.scoreBeforeTailoring ?? body.score_before_tailoring,
    ),
    ...(cvProfileIdTrim ? { cvProfileId: cvProfileIdTrim } : {}),
    ...(sourceCvProfileId ? { sourceCvProfileId } : {}),
    ...(jobListingId ? { jobListingId } : {}),
    ...(jobListingSourceHash ? { jobListingSourceHash } : {}),
    ...(applyUrlRaw ? { applyUrl: applyUrlRaw } : {}),
    ...(reusedExistingAnalysis ? { reusedExistingAnalysis: true } : {}),
    ...(scoreSource ? { scoreSource } : {}),
    tailoredCvProfileId,
    tailoredCvName,
    isTailored,
    hasCoverLetter,
    tailorDraft,
    breakdown:
      body.breakdown !== null && typeof body.breakdown === 'object'
        ? (body.breakdown as JobAnalysis['breakdown'])
        : undefined,
    missingSkills: missing,
    strengths,
    recommendation: body.recommendation as JobAnalysis['recommendation'],
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : undefined,
    salaryEstimate,
    ...((): { status?: HubPipelineStage } => {
      const st =
        parseHubPipelineStage(body.status) ??
        parseHubPipelineStage(body.hubPipelineStage ?? body.hub_pipeline_stage);
      return st ? { status: st } : {};
    })(),
    ...(analysisV2 ? { analysisV2 } : {}),
    ...(scoreImprovement ? { scoreImprovement } : {}),
    ...(factorsBreakdown ? { factorsBreakdown } : {}),
    ...(locationEligibility ? { locationEligibility } : {}),
    ...(skillCoverage?.length ? { skillCoverage } : {}),
  };
}

function parseLocationEligibility(raw: unknown): LocationEligibility | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const message =
    (typeof o.message === 'string' && o.message.trim()) ||
    (typeof o.hint === 'string' && o.hint.trim()) ||
    '';
  if (!message) return null;
  const jobLocations = Array.isArray(o.jobLocations ?? o.job_locations)
    ? (o.jobLocations ?? o.job_locations)
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .map((item) => item.trim())
    : undefined;
  const detectedUserCountryCode =
    typeof o.detectedUserCountryCode === 'string'
      ? o.detectedUserCountryCode
      : typeof o.detected_user_country_code === 'string'
        ? o.detected_user_country_code
        : null;
  const detectedUserCountryName =
    typeof o.detectedUserCountryName === 'string'
      ? o.detectedUserCountryName
      : typeof o.detected_user_country_name === 'string'
        ? o.detected_user_country_name
        : null;
  return {
    message,
    ...(jobLocations?.length ? { jobLocations } : {}),
    ...(detectedUserCountryCode ? { detectedUserCountryCode } : {}),
    ...(detectedUserCountryName ? { detectedUserCountryName } : {}),
  };
}

export type CvTailorDraftSectionStatus = 'pending' | 'accepted' | 'rejected';

export type CvTailorDraftStatus =
  | 'pending'
  | 'partially_accepted'
  | 'completed';

export type CvTailorDraftEntry = {
  sectionId: string;
  sectionType: string;
  before: string;
  after: string;
  status: CvTailorDraftSectionStatus;
  changedFields: string[];
  /** Phase 4 patch registry id when returned by tailor-draft. */
  patchId?: string | null;
};

export type CvPatchRecord = {
  patchId: string;
  sectionId: string;
  sectionType: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
};

export type CvTailorDraft = {
  id: string;
  cvProfileId: string;
  jobAnalysisId: string;
  selectedSkills: string[];
  status: CvTailorDraftStatus;
  drafts: CvTailorDraftEntry[];
  tailoredCvName?: string | null;
};

/** POST accept/reject/revert tailor — draft plus refreshed job analysis when backend returns it. */
export type TailorMutationResponse = {
  draft: CvTailorDraft;
  jobAnalysis: JobAnalysis | null;
};

export type JobHistoryItem = {
  id: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  recommendation: string;
  createdAt: string;
  scoreBeforeTailoring: number | null;
  tailoredCvProfileId: string | null;
  tailoredCvName: string | null;
  isTailored: boolean;
  hasCoverLetter: boolean;
  /** CV profile used for the original match (when API includes it). */
  cvProfileId?: string | null;
  jobListingId?: string | null;
  jobListingSourceHash?: string | null;
  /** Canonical employer posting URL when returned by GET /jobs/history. */
  applyUrl?: string | null;
  /** Back-compat if API still sends `title` */
  title?: string;
  /** Present when the history/list endpoint includes the stored JD text */
  description?: string;
  jobDescription?: string;
  salaryEstimate?: JobSalaryEstimate | null;
  /** Job Hub pipeline from `status` on history rows when present. */
  pipelineStatus?: HubPipelineStage;
  origin?: string;
  state?: string;
  isApplied?: boolean;
  lastActivityAt?: string;
  nextRecommendedAction?: string;
  reasonText?: string;
  applicationAssist?: {
    hasCvReady: boolean;
    hasTailoredCv: boolean;
    hasCoverLetterDraft: boolean;
    missingFields: string[];
    suggestedNextStep?: string | null;
  };
  analysisV2?: JobAnalysisV2;
  /** True when analyzeSource is set (scored/analyzed), false for bookmark-only extension saves. */
  hasAnalysis?: boolean;
  analyzeSource?: string | null;
  savedVia?: string | null;
};

/** Paginated `GET /jobs/history` (items + total for UI paging). */
export type JobHistoryPageResult = {
  items: JobHistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type ArchivedEntityKind = 'bookmark' | 'job_analysis' | 'application';

export type ArchivedBookmarkCard = {
  kind: 'bookmark';
  id: string;
  archivedAt: string;
  restorePlacementHint: string;
  jobListingId: string | null;
  jobAnalysisId: string | null;
  applicationId: string | null;
  hubPipelineStage: string;
  title: string;
  company: string;
  descriptionSnippet?: string;
  url?: string | null;
};

export type ArchivedJobAnalysisCard = {
  kind: 'job_analysis';
  id: string;
  archivedAt: string;
  restorePlacementHint: string;
  jobListingId: string | null;
  title: string;
  company: string;
  status: string;
  matchScore: number | null;
};

export type ArchivedApplicationCard = {
  kind: 'application';
  id: string;
  archivedAt: string;
  restorePlacementHint: string;
  jobAnalysisId: string | null;
  title: string;
  company: string;
  status: string;
  matchScore: number | null;
};

export type JobArchiveListResponse = {
  bookmarks: ArchivedBookmarkCard[];
  orphanJobAnalyses: ArchivedJobAnalysisCard[];
  applications: ArchivedApplicationCard[];
};

export type JobArchiveMutationResult = {
  archived: {
    bookmarkIds: string[];
    jobAnalysisIds: string[];
    applicationIds: string[];
  };
  archivedAt: string;
};

export type JobArchiveRestoreResult = {
  restored: {
    bookmarkIds: string[];
    jobAnalysisIds: string[];
    applicationIds: string[];
  };
  restorePlacementHint: string;
  message: string;
};

export type HubReminderStatus = 'pending' | 'completed' | 'dismissed';

/** GET/POST/PATCH /jobs/hub-reminders — CRM follow-ups (not Application email reminders). */
export type HubReminderItem = {
  id: string;
  jobBookmarkId: string | null;
  jobAnalysisId: string | null;
  remindAt: string;
  title: string | null;
  note: string | null;
  status: HubReminderStatus;
  createdAt: string;
  updatedAt: string | null;
};

/** Row from GET /jobs/analyses */
export type JobAnalysisSummary = {
  id: string;
  title: string;
  company: string;
  matchScore: number;
  isTailored: boolean;
  salaryEstimate?: JobSalaryEstimate | null;
  createdAt: string;
  updatedAt: string;
  cvProfileId?: string;
  tailoredCvProfileId?: string | null;
  jobListingId?: string | null;
  jobListingSourceHash?: string | null;
  applyUrl?: string | null;
  recommendation?: string;
};

/** Full analyzed job from GET /jobs/:jobId (form + analysis). */
export type JobDetailForForm = {
  title: string;
  company: string;
  description: string;
  analysis: JobAnalysis;
  /** Resolved hub column from GET /jobs/:id. */
  hubPipelineStage?: HubPipelineStage;
  /** Embedded cover letter + answers when generated. */
  generatedContent?: GeneratedContent | null;
  /**
   * When GET /jobs/:id includes linked tailoring (cross-device).
   * Backend may nest under `job`, `analysis`, or top-level camel/snake case.
   */
  tailorDraft?: CvTailorDraft | null;
  /** Pending hub CRM reminders for this analysis (server-filtered). */
  hubReminders?: HubReminderItem[];
};

function normalizeJobDetailForForm(
  raw: unknown,
  fallbackId: string,
): JobDetailForForm {
  const analysis = normalizeJobAnalysis(raw);
  const body = unwrapApiDataEnvelope(raw);
  const o = body as Record<string, unknown>;
  const nestedJob =
    o.job !== null && typeof o.job === 'object' && !Array.isArray(o.job)
      ? (o.job as Record<string, unknown>)
      : null;
  const nestedAnalysis =
    o.analysis !== null &&
    typeof o.analysis === 'object' &&
    !Array.isArray(o.analysis)
      ? (o.analysis as Record<string, unknown>)
      : null;

  let mergedSalary = analysis.salaryEstimate;
  if (mergedSalary === undefined) {
    mergedSalary =
      parseSalaryEstimateFromUnknown(o.salaryEstimate ?? o.salary_estimate) ??
      (nestedJob
        ? parseSalaryEstimateFromUnknown(
            nestedJob.salaryEstimate ?? nestedJob.salary_estimate,
          )
        : undefined) ??
      (nestedAnalysis
        ? parseSalaryEstimateFromUnknown(
            nestedAnalysis.salaryEstimate ?? nestedAnalysis.salary_estimate,
          )
        : undefined);
  }

  const desc =
    typeof o.description === 'string'
      ? o.description
      : typeof o.jobDescription === 'string'
        ? o.jobDescription
        : typeof o.job_description === 'string'
          ? o.job_description
          : '';
  const na =
    nestedAnalysis !== null
      ? (nestedAnalysis as Record<string, unknown>)
      : null;
  const topJobListingId =
    (typeof o.jobListingId === 'string' && o.jobListingId.trim()) ||
    (typeof o.job_listing_id === 'string' && o.job_listing_id.trim()) ||
    (nestedJob &&
      typeof nestedJob.jobListingId === 'string' &&
      nestedJob.jobListingId.trim()) ||
    (na && typeof na.jobListingId === 'string' && na.jobListingId.trim()) ||
    (na &&
      typeof na.job_listing_id === 'string' &&
      String(na.job_listing_id).trim()) ||
    null;
  const topJobListingHash =
    (typeof o.jobListingSourceHash === 'string' &&
      o.jobListingSourceHash.trim()) ||
    (typeof o.job_listing_source_hash === 'string' &&
      o.job_listing_source_hash.trim()) ||
    (nestedJob &&
      typeof nestedJob.jobListingSourceHash === 'string' &&
      nestedJob.jobListingSourceHash.trim()) ||
    (na &&
      typeof na.jobListingSourceHash === 'string' &&
      na.jobListingSourceHash.trim()) ||
    null;

  const hubRemindersRaw =
    o.hubReminders ??
    o.hub_reminders ??
    (nestedJob
      ? (nestedJob.hubReminders ?? nestedJob.hub_reminders)
      : undefined) ??
    (na ? (na.hubReminders ?? na.hub_reminders) : undefined);
  const hubRemindersParsed =
    Array.isArray(hubRemindersRaw) && hubRemindersRaw.length > 0
      ? hubRemindersRaw
          .filter(
            (x): x is Record<string, unknown> =>
              x !== null && typeof x === 'object' && !Array.isArray(x),
          )
          .map((x) => normalizeHubReminderItem(x))
      : undefined;

  const hubPipelineStage =
    parseHubPipelineStage(o.hubPipelineStage ?? o.hub_pipeline_stage) ??
    parseHubPipelineStage(o.status) ??
    analysis.status;

  const genRaw = o.generatedContent ?? o.generated_content;
  let generatedContent: GeneratedContent | null = null;
  if (genRaw !== null && typeof genRaw === 'object' && !Array.isArray(genRaw)) {
    const g = genRaw as Record<string, unknown>;
    const coverLetter =
      typeof g.coverLetter === 'string' && g.coverLetter.trim()
        ? g.coverLetter
        : typeof g.cover_letter === 'string' && g.cover_letter.trim()
          ? g.cover_letter
          : undefined;
    const answers = Array.isArray(g.answers)
      ? (g.answers as GeneratedContent['answers'])
      : undefined;
    if (coverLetter || answers) {
      generatedContent = {
        jobId: fallbackId,
        coverLetter,
        answers,
      };
    }
  }

  return {
    title: (typeof o.title === 'string' ? o.title : analysis.title) ?? '',
    company:
      (typeof o.company === 'string' ? o.company : analysis.company) ?? '',
    description: desc,
    analysis: {
      ...analysis,
      id: analysis.id ?? (typeof o.id === 'string' ? o.id : fallbackId),
      salaryEstimate:
        mergedSalary !== undefined ? mergedSalary : analysis.salaryEstimate,
      ...(topJobListingId && !analysis.jobListingId
        ? { jobListingId: topJobListingId }
        : {}),
      ...(topJobListingHash && !analysis.jobListingSourceHash
        ? { jobListingSourceHash: topJobListingHash }
        : {}),
      ...(hubPipelineStage && !analysis.status
        ? { status: hubPipelineStage }
        : {}),
      ...(typeof o.hasCoverLetter === 'boolean'
        ? { hasCoverLetter: o.hasCoverLetter }
        : typeof o.has_cover_letter === 'boolean'
          ? { hasCoverLetter: o.has_cover_letter }
          : generatedContent?.coverLetter
            ? { hasCoverLetter: true }
            : {}),
      ...(typeof o.tailoredCvProfileId === 'string'
        ? { tailoredCvProfileId: o.tailoredCvProfileId }
        : typeof o.tailored_cv_profile_id === 'string'
          ? { tailoredCvProfileId: o.tailored_cv_profile_id }
          : {}),
    },
    ...(hubPipelineStage ? { hubPipelineStage } : {}),
    ...(generatedContent ? { generatedContent } : {}),
    ...(hubRemindersParsed ? { hubReminders: hubRemindersParsed } : {}),
  };
}

export type GeneratedContent = {
  jobId: string;
  coverLetter?: string;
  answers?: Array<{ question: string; answer: string }>;
};

export interface JobListingDto {
  id: string;
  title: string;
  company: string;
  location?: string;
  workMode?: string;
  employmentType?: string;
  datePosted?: string;
  url?: string;
  description: string;
  snippet?: string;
  logoUrl?: string;
  salary?: string;
  /** When discovery API scores listing against selected CV (camel/snake normalized here). */
  matchScore?: number;
  whyThisJobShort?: string;
  whyThisJobSignals?: string[];
  matchPreview?: {
    instantScore: number | null;
    instantBand: 'high' | 'medium' | 'low' | null;
    refinedScore: number | null;
    refinedReady: boolean;
    refinedEtaMs: number | null;
    version: string | null;
  };
  novelty?: {
    isNewSinceLastVisit: boolean;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
  };
  journey?: {
    focusToken: string | null;
    jobListingId: string;
    returnRoute: string | null;
  };
  highlight?: {
    isTopMatch: boolean;
    emphasisLevel: 'none' | 'subtle' | 'strong';
    label: string | null;
  };
  locationStrategy?: 'local' | 'remote_fallback' | null;
  locationLabel?: string | null;
  fallbackReason?: string | null;
  postedAgeHours?: number | null;
  isBookmarked?: boolean;
  /** Hub bookmark row id from POST …/bookmark (`body.data.id`) — notes + PATCH bookmark use this, not the job listing id. */
  bookmarkRowId?: string;
  /** When discovery rows carry analysis / application context (deep links from today-plan). */
  jobAnalysisId?: string;
  applicationId?: string;
  ranking?: JobListingRanking;
  explanation?: JobListingExplanation;
}

/** Parsed from axios `response.data` after POST /job-discovery/:jobListingId/bookmark (top-level `success`, nested `data` row). */
export type JobDiscoveryBookmarkResult = {
  bookmarkId: string;
  /** Same id used for discover list items / GET detail cache keys. */
  jobListingId: string;
};

export interface DiscoverJobsResponse {
  items: JobListingDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Backend widened search when local results were empty. */
  locationFallback?: boolean;
  /** Response used remote-first / global remote mode. */
  remoteFirst?: boolean;
  freshness?: {
    newSinceLastVisitCount: number;
    updatedSinceLastVisitCount: number;
    lastSeenAt: string | null;
  };
  qualityState?: {
    mode: 'healthy' | 'low_quality' | 'empty';
    reasonCodes: string[];
    suggestedActions: Array<{
      type:
        | 'improve_cv'
        | 'expand_location'
        | 'adjust_filters'
        | 'refresh_preferences';
      label: string;
      route: string;
      impactHint: string | null;
    }>;
  };
  searchContext?: {
    locationLabel: string;
    locationSource: string;
    countryCode: string;
    roleQuery: string;
  };
}

export type JobDiscoveryQuickActionResult = {
  ok: boolean;
  nextAction: {
    type: string;
    route: string;
    contextToken: string | null;
  } | null;
  stateSnapshot: Record<string, unknown> | null;
};

function parseJobRanking(raw: unknown): JobListingRanking | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw))
    return undefined;
  const r = raw as Record<string, unknown>;
  const tierRaw = String(r.tier ?? '')
    .toUpperCase()
    .trim();
  const tier: JobRankingTier | null =
    tierRaw === 'APPLY_NOW' || tierRaw === 'CONSIDER' || tierRaw === 'LOW_MATCH'
      ? (tierRaw as JobRankingTier)
      : null;
  const scoreNum = Number(r.score);
  if (!tier || !Number.isFinite(scoreNum)) return undefined;
  const rec = String(r.recommendation ?? '').trim();
  return {
    score: Math.max(0, Math.min(100, Math.round(scoreNum))),
    tier,
    recommendation: rec || 'Review match details',
  };
}

function parseJobExplanation(raw: unknown): JobListingExplanation | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw))
    return undefined;
  const e = raw as Record<string, unknown>;
  const strArr = (v: unknown) =>
    Array.isArray(v)
      ? v.filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        )
      : [];
  const sm = String(
    e.seniorityMismatch ?? e.seniority_mismatch ?? 'none',
  ).toLowerCase();
  const seniorityMismatch: JobListingExplanation['seniorityMismatch'] =
    sm === 'under' || sm === 'over' || sm === 'unknown' ? sm : 'none';
  return {
    matchedSkills: strArr(e.matchedSkills ?? e.matched_skills).slice(0, 12),
    missingSkills: strArr(e.missingSkills ?? e.missing_skills).slice(0, 10),
    riskFactors: strArr(e.riskFactors ?? e.risk_factors).slice(0, 5),
    seniorityMismatch,
    whyThisJob: String(e.whyThisJob ?? e.why_this_job ?? '').trim(),
    recommendation: String(e.recommendation ?? '').trim(),
  };
}

function pickBookmarkedFlag(o: Record<string, unknown>): boolean | undefined {
  const candidates = [
    o.isBookmarked,
    o.is_bookmarked,
    o.bookmarked,
    o.isBookmark,
    o.bookmark,
  ];
  for (const v of candidates) {
    if (v === true || v === false) return v;
    if (v === 1) return true;
    if (v === 0) return false;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
    }
  }
  return undefined;
}

/** Normalize GET /job-discovery/:id and list items (camel/snake bookmark flags, nested `job`). */
export function normalizeJobListingDto(raw: unknown): JobListingDto {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  let o = body;
  const nested = o.job ?? o.listing ?? o.item;
  if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
    o = { ...o, ...(nested as Record<string, unknown>) };
  }
  const description =
    typeof o.description === 'string'
      ? o.description
      : typeof o.jobDescription === 'string'
        ? o.jobDescription
        : typeof o.fullDescription === 'string'
          ? o.fullDescription
          : '';
  const isBookmarked = pickBookmarkedFlag(o);
  const bookmarkRowId =
    typeof o.bookmarkRowId === 'string'
      ? o.bookmarkRowId
      : typeof o.bookmark_id === 'string'
        ? o.bookmark_id
        : typeof o.hubBookmarkId === 'string'
          ? o.hubBookmarkId
          : undefined;
  const rawScore = o.matchScore ?? o.score ?? o.match_score;
  let matchScore: number | undefined;
  if (rawScore != null && rawScore !== '') {
    const scoreNum =
      typeof rawScore === 'number'
        ? rawScore
        : typeof rawScore === 'string'
          ? parseFloat(rawScore)
          : Number(rawScore);
    if (Number.isFinite(scoreNum))
      matchScore = Math.max(0, Math.min(100, scoreNum));
  }
  const whyThisJobSignalsRaw = o.whyThisJobSignals ?? o.why_this_job_signals;
  const whyThisJobSignals = Array.isArray(whyThisJobSignalsRaw)
    ? whyThisJobSignalsRaw.filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 0,
      )
    : [];
  const previewRaw =
    o.matchPreview !== null &&
    typeof o.matchPreview === 'object' &&
    !Array.isArray(o.matchPreview)
      ? (o.matchPreview as Record<string, unknown>)
      : o.match_preview !== null &&
          typeof o.match_preview === 'object' &&
          !Array.isArray(o.match_preview)
        ? (o.match_preview as Record<string, unknown>)
        : null;
  const noveltyRaw =
    o.novelty !== null &&
    typeof o.novelty === 'object' &&
    !Array.isArray(o.novelty)
      ? (o.novelty as Record<string, unknown>)
      : null;
  const journeyRaw =
    o.journey !== null &&
    typeof o.journey === 'object' &&
    !Array.isArray(o.journey)
      ? (o.journey as Record<string, unknown>)
      : null;
  const highlightRaw =
    o.highlight !== null &&
    typeof o.highlight === 'object' &&
    !Array.isArray(o.highlight)
      ? (o.highlight as Record<string, unknown>)
      : null;
  const locationStrategyRaw = String(
    o.locationStrategy ?? o.location_strategy ?? '',
  )
    .toLowerCase()
    .trim();
  const locationStrategy: 'local' | 'remote_fallback' | null =
    locationStrategyRaw === 'local' || locationStrategyRaw === 'remote_fallback'
      ? locationStrategyRaw
      : null;
  return {
    id: String(o.id ?? ''),
    title: typeof o.title === 'string' ? o.title : '',
    company: typeof o.company === 'string' ? o.company : '',
    location: typeof o.location === 'string' ? o.location : undefined,
    workMode: typeof o.workMode === 'string' ? o.workMode : undefined,
    employmentType:
      typeof o.employmentType === 'string' ? o.employmentType : undefined,
    datePosted: typeof o.datePosted === 'string' ? o.datePosted : undefined,
    url: typeof o.url === 'string' ? o.url : undefined,
    description,
    snippet: typeof o.snippet === 'string' ? o.snippet : undefined,
    logoUrl: typeof o.logoUrl === 'string' ? o.logoUrl : undefined,
    salary: typeof o.salary === 'string' ? o.salary : undefined,
    ...(matchScore !== undefined ? { matchScore } : {}),
    ...(typeof o.whyThisJobShort === 'string'
      ? { whyThisJobShort: o.whyThisJobShort }
      : typeof o.why_this_job_short === 'string'
        ? { whyThisJobShort: String(o.why_this_job_short) }
        : {}),
    ...(whyThisJobSignals.length > 0 ? { whyThisJobSignals } : {}),
    ...(previewRaw
      ? {
          matchPreview: {
            instantScore:
              typeof previewRaw.instantScore === 'number' &&
              Number.isFinite(previewRaw.instantScore)
                ? Math.max(0, Math.min(100, previewRaw.instantScore))
                : typeof previewRaw.instant_score === 'number' &&
                    Number.isFinite(previewRaw.instant_score)
                  ? Math.max(0, Math.min(100, Number(previewRaw.instant_score)))
                  : null,
            instantBand: (() => {
              const s = String(
                previewRaw.instantBand ?? previewRaw.instant_band ?? '',
              )
                .trim()
                .toLowerCase();
              return s === 'high' || s === 'medium' || s === 'low' ? s : null;
            })(),
            refinedScore:
              typeof previewRaw.refinedScore === 'number' &&
              Number.isFinite(previewRaw.refinedScore)
                ? Math.max(0, Math.min(100, previewRaw.refinedScore))
                : typeof previewRaw.refined_score === 'number' &&
                    Number.isFinite(previewRaw.refined_score)
                  ? Math.max(0, Math.min(100, Number(previewRaw.refined_score)))
                  : null,
            refinedReady:
              previewRaw.refinedReady === true ||
              previewRaw.refined_ready === true,
            refinedEtaMs:
              typeof previewRaw.refinedEtaMs === 'number' &&
              Number.isFinite(previewRaw.refinedEtaMs)
                ? previewRaw.refinedEtaMs
                : typeof previewRaw.refined_eta_ms === 'number' &&
                    Number.isFinite(previewRaw.refined_eta_ms)
                  ? Number(previewRaw.refined_eta_ms)
                  : null,
            version:
              typeof previewRaw.version === 'string'
                ? previewRaw.version
                : typeof previewRaw.matchVersion === 'string'
                  ? previewRaw.matchVersion
                  : null,
          },
        }
      : {}),
    ...(noveltyRaw
      ? {
          novelty: {
            isNewSinceLastVisit:
              noveltyRaw.isNewSinceLastVisit === true ||
              noveltyRaw.is_new_since_last_visit === true,
            firstSeenAt:
              typeof noveltyRaw.firstSeenAt === 'string'
                ? noveltyRaw.firstSeenAt
                : typeof noveltyRaw.first_seen_at === 'string'
                  ? String(noveltyRaw.first_seen_at)
                  : null,
            lastSeenAt:
              typeof noveltyRaw.lastSeenAt === 'string'
                ? noveltyRaw.lastSeenAt
                : typeof noveltyRaw.last_seen_at === 'string'
                  ? String(noveltyRaw.last_seen_at)
                  : null,
          },
        }
      : {}),
    ...(journeyRaw
      ? {
          journey: {
            focusToken:
              typeof journeyRaw.focusToken === 'string'
                ? journeyRaw.focusToken
                : typeof journeyRaw.focus_token === 'string'
                  ? String(journeyRaw.focus_token)
                  : null,
            jobListingId: (typeof journeyRaw.jobListingId === 'string'
              ? journeyRaw.jobListingId
              : typeof journeyRaw.job_listing_id === 'string'
                ? String(journeyRaw.job_listing_id)
                : String(o.id ?? '')
            ).trim(),
            returnRoute:
              typeof journeyRaw.returnRoute === 'string'
                ? journeyRaw.returnRoute
                : typeof journeyRaw.return_route === 'string'
                  ? String(journeyRaw.return_route)
                  : null,
          },
        }
      : {}),
    ...(highlightRaw
      ? {
          highlight: {
            isTopMatch:
              highlightRaw.isTopMatch === true ||
              highlightRaw.is_top_match === true,
            emphasisLevel: (() => {
              const s = String(
                highlightRaw.emphasisLevel ?? highlightRaw.emphasis_level ?? '',
              )
                .trim()
                .toLowerCase();
              return s === 'none' || s === 'subtle' || s === 'strong'
                ? s
                : 'none';
            })(),
            label:
              typeof highlightRaw.label === 'string'
                ? highlightRaw.label
                : typeof highlightRaw.badgeLabel === 'string'
                  ? String(highlightRaw.badgeLabel)
                  : null,
          },
        }
      : {}),
    ...(locationStrategy ? { locationStrategy } : {}),
    ...(typeof o.locationLabel === 'string'
      ? { locationLabel: o.locationLabel }
      : typeof o.location_label === 'string'
        ? { locationLabel: String(o.location_label) }
        : {}),
    ...(typeof o.fallbackReason === 'string'
      ? { fallbackReason: o.fallbackReason }
      : typeof o.fallback_reason === 'string'
        ? { fallbackReason: String(o.fallback_reason) }
        : {}),
    ...(typeof o.postedAgeHours === 'number' &&
    Number.isFinite(o.postedAgeHours)
      ? { postedAgeHours: o.postedAgeHours }
      : typeof o.posted_age_hours === 'number' &&
          Number.isFinite(o.posted_age_hours)
        ? { postedAgeHours: Number(o.posted_age_hours) }
        : {}),
    ...(isBookmarked !== undefined ? { isBookmarked } : {}),
    ...(bookmarkRowId?.trim() ? { bookmarkRowId: bookmarkRowId.trim() } : {}),
    ...(typeof o.jobAnalysisId === 'string' && o.jobAnalysisId.trim()
      ? { jobAnalysisId: o.jobAnalysisId.trim() }
      : typeof o.job_analysis_id === 'string' &&
          String(o.job_analysis_id).trim()
        ? { jobAnalysisId: String(o.job_analysis_id).trim() }
        : {}),
    ...(typeof o.applicationId === 'string' && o.applicationId.trim()
      ? { applicationId: o.applicationId.trim() }
      : typeof o.application_id === 'string' && String(o.application_id).trim()
        ? { applicationId: String(o.application_id).trim() }
        : {}),
    ...(parseJobRanking(o.ranking)
      ? { ranking: parseJobRanking(o.ranking) }
      : {}),
    ...(parseJobExplanation(o.explanation)
      ? { explanation: parseJobExplanation(o.explanation) }
      : {}),
  };
}

export type ApplicationTrackerStatus =
  | 'draft'
  | 'researching'
  | 'ready_to_apply'
  | 'applied'
  | 'interview_scheduled'
  | 'interviewed'
  | 'offer_received'
  | 'negotiating'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted';

/** Opt-in: POST /users/me/local-reminders — Job Hub calls only when the user enables cloud delivery. */
export type SyncLocalReminderPayload = {
  remindAt: string;
  message: string;
  applicationId?: string;
  jobAnalysisId?: string;
  jobKey?: string;
  title?: string;
  company?: string;
};

export type SyncLocalReminderResponse = {
  id: string;
  applicationId: string;
};

/** Multi-entry hub note (GET …/notes, POST …/notes). */
export type HubNoteEntry = {
  id: string;
  body: string;
  snippet: string;
  createdAt: string;
  updatedAt: string | null;
};

function parseHubPipelineStage(v: unknown): HubPipelineStage | undefined {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (
    s === 'saved' ||
    s === 'applied' ||
    s === 'interviewing' ||
    s === 'offered' ||
    s === 'negotiating' ||
    s === 'accepted' ||
    s === 'rejected'
  ) {
    return s;
  }
  return undefined;
}

function parseHubReminderStatus(v: unknown): HubReminderStatus {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (s === 'pending' || s === 'completed' || s === 'dismissed') return s;
  return 'pending';
}

function parseApplicationAssist(raw: unknown):
  | {
      hasCvReady: boolean;
      hasTailoredCv: boolean;
      hasCoverLetterDraft: boolean;
      missingFields: string[];
      suggestedNextStep?: string | null;
    }
  | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return undefined;
  const o = raw as Record<string, unknown>;
  const missingRaw = o.missingFields ?? o.missing_fields;
  const missingFields = Array.isArray(missingRaw)
    ? missingRaw.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    hasCvReady: o.hasCvReady === true || o.has_cv_ready === true,
    hasTailoredCv: o.hasTailoredCv === true || o.has_tailored_cv === true,
    hasCoverLetterDraft:
      o.hasCoverLetterDraft === true || o.has_cover_letter_draft === true,
    missingFields,
    suggestedNextStep:
      typeof o.suggestedNextStep === 'string'
        ? o.suggestedNextStep
        : typeof o.suggested_next_step === 'string'
          ? o.suggested_next_step
          : null,
  };
}

function normalizeHubReminderItem(o: Record<string, unknown>): HubReminderItem {
  return {
    id: typeof o.id === 'string' ? o.id : '',
    jobBookmarkId:
      typeof o.jobBookmarkId === 'string'
        ? o.jobBookmarkId
        : typeof o.job_bookmark_id === 'string'
          ? o.job_bookmark_id
          : null,
    jobAnalysisId:
      typeof o.jobAnalysisId === 'string'
        ? o.jobAnalysisId
        : typeof o.job_analysis_id === 'string'
          ? o.job_analysis_id
          : null,
    remindAt:
      typeof o.remindAt === 'string'
        ? o.remindAt
        : typeof o.remind_at === 'string'
          ? o.remind_at
          : '',
    title: typeof o.title === 'string' ? o.title : null,
    note: typeof o.note === 'string' ? o.note : null,
    status: parseHubReminderStatus(o.status),
    createdAt:
      typeof o.createdAt === 'string'
        ? o.createdAt
        : typeof o.created_at === 'string'
          ? o.created_at
          : '',
    updatedAt:
      typeof o.updatedAt === 'string'
        ? o.updatedAt
        : typeof o.updated_at === 'string'
          ? o.updated_at
          : null,
  };
}

/** GET /job-discovery/bookmarks — server-backed Job Hub bookmark row. */
export type HubBookmarkItem = {
  id: string;
  jobListingId: string;
  title: string;
  company: string;
  descriptionSnippet: string;
  url?: string;
  bookmarkedAt: string;
  jobAnalysisId: string | null;
  applicationId: string | null;
  /** Persisted pipeline when no linked Application (see PATCH bookmark). */
  hubPipelineStage?: HubPipelineStage;
  origin?: string;
  state?: string;
  isApplied?: boolean;
  lastActivityAt?: string;
  nextRecommendedAction?: string;
  reasonText?: string;
  applicationAssist?: {
    hasCvReady: boolean;
    hasTailoredCv: boolean;
    hasCoverLetterDraft: boolean;
    missingFields: string[];
    suggestedNextStep?: string | null;
  };
};

export type HubGlobalNoteItem = {
  id: string;
  snippet: string;
  body?: string;
  createdAt: string;
  jobTitle?: string | null;
  jobCompany?: string | null;
  applicationId?: string | null;
  jobAnalysisId?: string | null;
  bookmarkId?: string | null;
};

export type HubNotesGlobalPage = {
  items: HubGlobalNoteItem[];
  nextCursor: string | null;
};

function normalizeHubNoteEntry(o: Record<string, unknown>): HubNoteEntry {
  const id = typeof o.id === 'string' ? o.id : '';
  const body = typeof o.body === 'string' ? o.body : '';
  const firstLine = body.trim().split(/\r?\n/)[0] ?? '';
  const snippet =
    typeof o.snippet === 'string'
      ? o.snippet
      : firstLine
        ? firstLine.length > 120
          ? `${firstLine.slice(0, 120)}…`
          : firstLine
        : '';
  const createdAt =
    typeof o.createdAt === 'string'
      ? o.createdAt
      : typeof o.created_at === 'string'
        ? o.created_at
        : new Date().toISOString();
  const updatedAt =
    typeof o.updatedAt === 'string'
      ? o.updatedAt
      : typeof o.updated_at === 'string'
        ? o.updated_at
        : null;
  return { id, body, snippet, createdAt, updatedAt };
}

function normalizeHubBookmarkItem(o: Record<string, unknown>): HubBookmarkItem {
  const id = typeof o.id === 'string' ? o.id : '';
  const jobListingId =
    typeof o.jobListingId === 'string'
      ? o.jobListingId
      : typeof o.job_listing_id === 'string'
        ? o.job_listing_id
        : typeof o.discoveryId === 'string'
          ? o.discoveryId
          : '';
  const hubPs = parseHubPipelineStage(
    o.hubPipelineStage ?? o.hub_pipeline_stage,
  );
  const applicationAssist = parseApplicationAssist(
    o.applicationAssist ?? o.application_assist,
  );
  return {
    id,
    jobListingId,
    title: typeof o.title === 'string' ? o.title : 'Untitled role',
    company: typeof o.company === 'string' ? o.company : '—',
    descriptionSnippet:
      typeof o.descriptionSnippet === 'string'
        ? o.descriptionSnippet
        : typeof o.description_snippet === 'string'
          ? o.description_snippet
          : typeof o.description === 'string'
            ? o.description
            : '',
    url: typeof o.url === 'string' ? o.url : undefined,
    bookmarkedAt:
      typeof o.bookmarkedAt === 'string'
        ? o.bookmarkedAt
        : typeof o.bookmarked_at === 'string'
          ? o.bookmarked_at
          : typeof o.createdAt === 'string'
            ? o.createdAt
            : new Date().toISOString(),
    jobAnalysisId:
      typeof o.jobAnalysisId === 'string'
        ? o.jobAnalysisId
        : typeof o.job_analysis_id === 'string'
          ? o.job_analysis_id
          : null,
    applicationId:
      typeof o.applicationId === 'string'
        ? o.applicationId
        : typeof o.application_id === 'string'
          ? o.application_id
          : null,
    ...(hubPs ? { hubPipelineStage: hubPs } : {}),
    ...(typeof o.origin === 'string' ? { origin: o.origin } : {}),
    ...(typeof o.state === 'string' ? { state: o.state } : {}),
    ...(o.isApplied === true || o.is_applied === true
      ? { isApplied: true }
      : {}),
    ...(typeof o.lastActivityAt === 'string'
      ? { lastActivityAt: o.lastActivityAt }
      : typeof o.last_activity_at === 'string'
        ? { lastActivityAt: o.last_activity_at }
        : {}),
    ...(typeof o.nextRecommendedAction === 'string'
      ? { nextRecommendedAction: o.nextRecommendedAction }
      : typeof o.next_recommended_action === 'string'
        ? { nextRecommendedAction: o.next_recommended_action }
        : {}),
    ...(typeof o.reasonText === 'string'
      ? { reasonText: o.reasonText }
      : typeof o.reason_text === 'string'
        ? { reasonText: o.reason_text }
        : {}),
    ...(applicationAssist ? { applicationAssist } : {}),
  };
}

function extractHubNotesArrayFromResponse(raw: unknown): unknown[] {
  const u = unwrapApiDataEnvelope(raw);
  if (Array.isArray(u)) return u;
  if (u !== null && typeof u === 'object' && !Array.isArray(u)) {
    const o = u as Record<string, unknown>;
    const arr = o.items ?? o.notes ?? o.entries ?? o.rows ?? o.bookmarks;
    if (Array.isArray(arr)) return arr;
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

function sortHubNotesNewestFirst(rows: HubNoteEntry[]): HubNoteEntry[] {
  return [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** @deprecated Prefer {@link ApplicationTrackerStatus} — kept for older callers */
export type ApplicationStatus =
  | ApplicationTrackerStatus
  | 'APPLIED'
  | 'INTERVIEW'
  | 'REJECTED'
  | 'OFFER';

export type ApplicationItem = {
  id: string;
  title: string;
  company: string;
  url?: string;
  matchScore?: number;
  status?: ApplicationTrackerStatus;
  notes?: string;
  createdAt?: string;
  jobAnalysisId?: string;
  /** Present on PATCH /applications/:id/status when relevant */
  interviewPrepAvailable?: boolean;
  origin?: string;
  state?: string;
  isApplied?: boolean;
  lastActivityAt?: string;
  nextRecommendedAction?: string;
  reasonText?: string;
  applicationAssist?: {
    hasCvReady: boolean;
    hasTailoredCv: boolean;
    hasCoverLetterDraft: boolean;
    missingFields: string[];
    suggestedNextStep?: string | null;
  };
};

export type JobSalaryEstimateSource = 'job_description' | 'ai_estimate';

export type JobSalaryEstimate = {
  currency: string;
  min: number;
  max: number;
  median: number;
  basis: string;
  confidence: 'high' | 'medium' | 'low';
  note: string;
  /** Primary provenance — drives badge + disclaimer. */
  source?: JobSalaryEstimateSource;
  sourceLabel?: string;
  disclaimer?: string;
  /** Deprecated alias for `source`. */
  dataSource?: JobSalaryEstimateSource | string;
  marketLocation?: string;
  marketCountryCode?: string;
  preferredCurrencyCode?: string;
};

export type FollowUpEmailDraft = {
  subject: string;
  body: string;
};

export type ApplicationReminderStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'cancelled'
  | 'failed';

export type ApplicationReminderItem = {
  id: string;
  applicationId: string;
  remindAt: string;
  message: string;
  status: ApplicationReminderStatus;
  createdAt: string;
  updatedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
};

export type UserReminderItem = ApplicationReminderItem & {
  jobTitle?: string | null;
  jobCompany?: string | null;
};

export type UserRemindersListResponse = {
  items: UserReminderItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type InterviewType = 'technical' | 'behavioral' | 'mixed';
export type InterviewPersonality = 'alex' | 'sarah' | 'marcus' | 'zoe';
export type InterviewStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'evaluation_failed';

export interface InterviewQuestion {
  id: string;
  order: number;
  category: 'cv' | 'job' | 'behavioral';
  question: string;
  /** When `follow_up`, excluded from final `/submit` payload (main questions only). */
  section?: string;
}

export interface QuestionScore {
  questionId: string;
  question: string;
  answer: string;
  scores: {
    relevance: number;
    clarity: number;
    depth: number;
    confidence: number;
    roleAlignment: number;
  };
  overallScore: number;
  strength: string;
  improvement: string;
  betterAnswer?: string;
}

export interface InterviewResult {
  overallScore: number;
  scoreBreakdown: {
    relevance: number;
    clarity: number;
    depth: number;
    confidence: number;
    roleAlignment: number;
  };
  questionScores: QuestionScore[];
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  encouragementNote: string;
  readyForInterview: boolean;
  readinessScore?: number;
  readinessBreakdown?: import('@/lib/interview-prep-types').ReadinessBreakdown;
  realityScore?: import('@/lib/interview-prep-types').RealityScoreBreakdown;
}

export interface InterviewSession {
  id: string;
  status: InterviewStatus;
  interviewType: InterviewType;
  personality: InterviewPersonality;
  totalQuestions: number;
  jobTitle?: string;
  company?: string;
  /** Optional: server-hydrated job context for question generation + UI. */
  jobDescription?: string;
  /** Optional: server-hydrated linkage to the originating analysis + CV. */
  jobAnalysisId?: string;
  cvProfileId?: string;
  questions: InterviewQuestion[];
  result?: InterviewResult;
  createdAt: string;
  expiresAt: string;
  overallScore?: number;
  /** Phase 1 — optional on legacy sessions */
  interviewMode?: 'job_based' | 'role_based';
  coachPersonality?: 'friendly' | 'professional' | 'strict' | 'fast_paced';
  interviewerPersonality?: string;
  interviewPersona?: import('@/lib/interviewPersonas').InterviewPersonaId;
  interviewerLabel?: string;
  /** Role title for UI chips (e.g. Friendly Coach) — separate from human `interviewerLabel`. */
  interviewerRoleLabel?: string;
  interviewerAvatar?: string;
  interviewerColor?: string;
  personalityPresentation?: import('@/lib/interviewPersonas').PersonalityPresentation;
  speakingSpeed?: number;
  roleTitle?: string;
  turns?: import('@/lib/interview-prep-types').InterviewTurn[];
  /** Phase 2 — after full eval */
  readinessScore?: number;
  readinessBreakdown?: import('@/lib/interview-prep-types').ReadinessBreakdown;
  weaknessSnapshot?: import('@/lib/interview-prep-types').WeaknessSnapshot;
  prepMode?: import('@/lib/interview-prep-types').PrepMode;
  adaptiveDifficulty?: boolean;
  stressLevel?: number;
  stressMode?: boolean;
  questionTimeLimitSec?: number;
  realityScore?: import('@/lib/interview-prep-types').RealityScoreBreakdown;
  coachingSettings?: import('@/lib/interview-prep-types').CoachingSettings;
  /** Optional telemetry (e.g. question generation v2). */
  setupMetadataJson?: import('@/lib/interview-prep-types').InterviewSetupMetadata;
}

export type NotificationItem = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    applicationId?: string;
    jobAnalysisId?: string;
    jobId?: string;
    bookmarkId?: string;
    href?: string;
    ctaHref?: string;
    deepLink?: string;
    focus?: string;
    eventName?: string;
    metricValue?: number;
  };
};

export type OnboardingStatus = {
  completed?: boolean;
  step?: number;
  selectedFeatures?: string[];
  primaryGoal?: string;
  hasCV?: boolean;
  focusGetHired?: boolean;
  focusStudentLaunchpad?: boolean;
  jobSearchUrgency?: JobSearchUrgency | null;
  targetRoles?: string[];
  referralSource?: string | null;
  referralOther?: string | null;
};

export type CVSectionRecord = {
  id: string;
  type: string;
  order: number;
  /** Derived from API `visible` when present (`hidden === !visible`). */
  hidden?: boolean;
  data?: Record<string, unknown>;
};

/** GET /cv/profiles/:id — profile document + sections */
export type CvProfileDetail = {
  profile: CVProfile;
  sections: CVSectionRecord[];
};

/** POST /cv/profiles/:id/assistant/commit — success (`source: ai_assistant`). */
export type CvAssistantCommitResult = {
  success: boolean;
  message: string;
  targetSection?: string;
  sectionsSynced?: boolean;
  profileId: string;
  profile: CVProfile;
  sections: CVSectionRecord[];
  cvRevisionId?: string | null;
};

export type CvReorderSectionsResult = {
  sections: CVSectionRecord[];
};

/** POST /cv/profiles/:id/sections/batch-upsert — Phase 4 autosave body item. */
export type CvBatchUpsertSectionInput = {
  /** Existing section row UUID — required so batch-upsert updates in place (reorder + autosave). */
  id?: string;
  type: string;
  order: number;
  visible: boolean;
  data: Record<string, unknown>;
};

/** POST /cv/profiles/:id/sections/batch-upsert — response (may be nested under `data` by interceptor). */
export type CvBatchUpsertSectionsResult = {
  success: boolean;
  updated: number;
  unchanged: number;
  sections: CVSectionRecord[];
};

/** Prefer whichever list includes real server row UUIDs (PATCH reorder requires each row `id`). */
export function pickCvSectionRowsForEditor(
  queryRows: CVSectionRecord[] | undefined,
  detailRows: CVSectionRecord[] | undefined,
): CVSectionRecord[] {
  const hasRowIds = (rows: CVSectionRecord[] | undefined) =>
    Array.isArray(rows) &&
    rows.some((r) => typeof r.id === 'string' && r.id.trim().length > 0);
  if (hasRowIds(queryRows)) return queryRows!;
  if (hasRowIds(detailRows)) return detailRows!;
  if (Array.isArray(queryRows) && queryRows.length > 0) return queryRows;
  if (Array.isArray(detailRows) && detailRows.length > 0) return detailRows;
  return queryRows ?? detailRows ?? [];
}

export type CVScorePayload = {
  /** `null` when the API has not produced a score yet (show “Calculating…” in UI). */
  score: number | null;
  lastScoredAt?: string;
  breakdown?: Record<string, unknown>;
  /** When a detailed score POST returns suggestions in the same payload. */
  improvements?: CVImprovementItem[];
  /** Hybrid scoring (30% structure + 70% AI quality when available). */
  scoringMethod?: CvScoringMethod;
  structuralScore?: number | null;
  aiScore?: number | null;
  aiCached?: boolean;
  aiEvaluatedAt?: string;
  aiAssessment?: CvAiAssessment | null;
  scoringTransparency?: CvScoringTransparency | null;
};

export type CVImprovementItem = {
  id?: string;
  /** Server lifecycle; missing legacy rows are treated as `pending`. */
  status?: 'pending' | 'applying' | 'accepted' | 'rejected' | 'failed' | 'in_progress';
  /** ISO timestamp when accepted/rejected (when provided). */
  resolvedAt?: string;
  resolution?: 'accepted' | 'rejected' | 'already_applied';
  section?: string;
  message?: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestion?: string;
  /** Optional before/after or rewrite example from the API */
  example?: string;
  /** 1 = high impact (maps from severity or API `priority`) */
  priority?: number;
  /** Alias for message when API sends `issue` */
  issue?: string;
  /** When true, the server marks this row resolved; hide from active suggestion UI (do not infer from pending paths alone). */
  resolved?: boolean;
  /** Partial accept/reject metadata from backend (canonical field paths). */
  acceptedFieldPaths?: string[];
  pendingFieldPaths?: string[];
};

/** GET /cv/suggestions (and legacy GET /cv/improvements) — open-queue list plus scoring hints. */
export type CvImprovementsPayload = {
  improvements: CVImprovementItem[];
  /**
   * When true, a section row changed after `lastScoredAt`; `improvements` may be empty/null until the client
   * runs a detailed score again (`POST /cv/profiles/:cvProfileId/score/detailed`, or legacy global detailed POST).
   */
  needsScoring: boolean;
  /** Prefer for badges when present (pending queue size). */
  pendingSuggestionsCount?: number;
  score?: number | null;
  lastScoredAt?: string;
  /** Canonical structured CV revision hash for invalidation / version checks. */
  cvRevisionId?: string | null;
  /** Optional fingerprint aligned with structured CV (when mutations return it). */
  structuredRevisionHash?: string | null;
  /** Bulk apply-all quota from server (FREE tier daily cap). */
  acceptAllQuota?: CvAcceptAllQuota | null;
};

/** POST /cv/suggestions/:id/accept|reject — product flows (full suggestion, no field subset). */
export type CvTruthfulnessMeta = {
  factualityValidated?: boolean;
  unsupportedChangesDetected?: number;
  truthfulnessWarnings?: string[];
};

/**
 * Optional server telemetry for AI materialization (apply preview, accept-time materialize, accept-all batch).
 * All fields are best-effort; clients must not depend on them for control flow.
 */
export type CvPerformanceMeta = {
  cacheHit?: boolean;
  usedSectionScopedPrompt?: boolean;
  usedFallback?: boolean;
  latencyMs?: number;
  inputCharacters?: number;
  outputCharacters?: number;
  /** Optional Gemini / model token counts when the API exposes them (additive telemetry). */
  promptTokenCount?: number;
  completionTokenCount?: number;
  totalTokenCount?: number;
};

/**
 * Optional fields returned after suggestion accept/reject mutations (Phase 3 — fast HTTP, background section sync).
 */
export type CvMutationCommitMeta = {
  /** Server queued core section rebuild and/or async rescoring after accept. */
  backgroundTasksScheduled?: boolean;
  /** Approximate Prisma transaction duration for this request (excludes background work). */
  transactionLatencyMs?: number;
  /** Suggestion row ids that were fully accepted (single accept or accept-all batch). */
  acceptedSuggestionIds?: string[];
  /** Suggestion ids persisted as terminal rejected (single reject or reject-all). */
  rejectedSuggestionIds?: string[];
  /**
   * Whether async rescoring was triggered (accept paths). Reject / reject-all may send `false` explicitly.
   */
  scoringTriggered?: boolean;
  /** Optional structured CV revision fingerprint for cache coherence (when API provides it). */
  structuredRevisionHash?: string | null;
};

/** Params when opening the CV improvement diff preview (Apply with AI) — truthfulness fields are optional. */
export type CvDiffPreviewOpenParams = CvTruthfulnessMeta & {
  /**
   * Stable React Query / UI map key for this preview (improvement row id).
   * When set, overrides {@link cvDiffPreviewStorageKey} resolution from pointer alone.
   */
  previewMapKey?: string;
  /** Server suggestion id when distinct from transient pointer (Phase 4.5). */
  suggestionId?: string | null;
  section: string;
  before: unknown;
  after: unknown;
  pointer: string;
  draftHash?: string | null;
  changedFields: Array<{
    field?: string;
    fieldPath: string;
    fieldLabel?: string;
    before: string;
    after: string;
    type: 'added' | 'removed' | 'changed';
  }>;
  /** Materialization telemetry for this preview (replaced on each apply). */
  performance?: CvPerformanceMeta;
};

export type CvSuggestionMutationResult = CvTruthfulnessMeta &
  CvPerformanceMeta &
  CvMutationCommitMeta & {
    suggestion?: CVImprovementItem;
    pendingSuggestionsCount: number;
    cvRevisionId: string | null;
    legacy?: Record<string, unknown>;
    idempotent?: boolean;
    /** Server already applied this change — treat as success for queue UX. */
    alreadyApplied?: boolean;
    duplicateSuppressed?: boolean;
    /** Draft preview slots still stored on profile after accept (Phase 4.5). */
    remainingDraftPreviews?: number;
  };

/** POST /cv/suggestions/accept-all — optional additive batch summary (Phase 5). */
export type CvAcceptAllSummary = {
  applied?: number;
  skippedDuplicate?: number;
  skippedNoop?: number;
  failedTruthfulness?: number;
  skippedAiBudget?: number;
  leftPending?: number;
  queueOverflow?: boolean;
};

/** POST /cv/suggestions/accept-all | reject-all */
export type CvSuggestionsBulkMutationResult = CvTruthfulnessMeta &
  CvPerformanceMeta &
  CvMutationCommitMeta & {
    acceptedCount?: number;
    rejectedCount?: number;
    remainingPendingCount?: number;
    pendingSuggestionsCount?: number;
    cvRevisionId?: string | null;
    idempotent?: boolean;
    duplicateSuppressed?: boolean;
    alreadyApplied?: boolean;
    /** When false, server skipped scheduling a score job (no meaningful structured change). */
    scoringTriggered?: boolean;
    /** Human-readable server message (e.g. Accept All caps / limits). */
    message?: string;
    acceptAllQueueOverflow?: boolean;
    acceptAllSkippedForAiLimit?: boolean;
    acceptAllDraftReuseCount?: number;
    acceptAllMaxSuggestions?: number;
    acceptAllMaxAiCalls?: number;
    /** Daily AI uses charged for this accept-all batch (0 = no charge). */
    acceptAllAiCalls?: number;
    cacheHit?: boolean;
    /** Suggestions skipped because the AI draft failed truthfulness / structure checks. */
    failedTruthfulnessCount?: number;
    /** Structured accept-all rollup when provided (camel or snake from API). */
    acceptAllSummary?: CvAcceptAllSummary;
  };

/** POST /cv/improvements/:id/apply — preview / draft (may reuse draft without second AI call). */
export type CvApplyImprovementResult = CvTruthfulnessMeta &
  CvPerformanceMeta & {
    success: boolean;
    pointer: string;
    improvementId: string | null;
    /** Stable suggestion id for multi-preview maps (same as improvement row id when present). */
    suggestionId?: string | null;
    section: string;
    before: unknown;
    after: unknown;
    changedFields: Array<{
      field: string;
      fieldPath: string;
      fieldLabel?: string;
      before: string;
      after: string;
      type: 'added' | 'removed' | 'changed';
    }>;
    draftHash: string | null;
    message: string;
    duplicateSuppressed?: boolean;
    alreadyApplied?: boolean;
    /** Server resolved the suggestion without a new preview (treat like already on CV). */
    autoResolved?: boolean;
    idempotent?: boolean;
    pendingSuggestionsCount?: number;
    cvRevisionId?: string | null;
    remainingDraftPreviews?: number;
  };

/** POST /cv/improvements/:id/accept|reject — partial field flows. */
export type CvImprovementPartialMutationResult = CvTruthfulnessMeta &
  CvPerformanceMeta &
  CvMutationCommitMeta & {
    partial: boolean;
    draftHash: string | null;
    remainingChangedFields: string[];
    improvementId: string | null;
    appliedChangedFields?: string[];
    pendingSuggestionsCount?: number;
    cvRevisionId?: string | null;
    idempotent?: boolean;
    alreadyApplied?: boolean;
    duplicateSuppressed?: boolean;
  };

/** ATS block nested under score `breakdown` when the API provides it. */
export type ATSCompatibility = {
  score: number;
  compatible: boolean;
  issues: string[];
  passed: string[];
  /** Heuristic disclaimer — not a guarantee of employer-specific parsers. */
  methodologyNote?: string;
  /** Job-aware ATS simulation report; absent when job context is insufficient. */
  simulation?: AtsSimulationReport;
};

export type CareerStage = 'student' | 'early' | 'mid' | 'senior';

export type CVFlag = {
  severity: 'error' | 'warning' | 'info';
  section: string;
  message: string;
  fix: string;
};

/** Rich improvement row from detailed score / breakdown (distinct from {@link CVImprovementItem} list API). */
export type CVImprovement = {
  priority: 1 | 2 | 3;
  section: string;
  issue: string;
  suggestion: string;
  example?: string;
};

export type SectionScore = {
  score: number;
  weight: number;
  feedback: string;
  flags: CVFlag[];
  /** Section score explainer (3.2) when returned on breakdown sections. */
  explainer?: CvSectionScoreExplainer | null;
};

/** Optional job-alignment block under `breakdown.sections.jobMatch` (same core shape as {@link SectionScore}). */
export type JobMatchSectionScore = SectionScore & {
  missingSkills?: string[];
  recommendations?: string[];
  alignmentInsights?: string[];
};

/** Normalized CV score breakdown from detailed score POST or GET score payload. */
export type CVScoreBreakdown = {
  overall: number;
  careerStage: CareerStage;
  sections: {
    contact: SectionScore;
    experience: SectionScore;
    education: SectionScore;
    skills: SectionScore;
    summary: SectionScore;
    formatting: SectionScore;
    /** Present when job context was used; `weight === 0` means skipped (no job). */
    jobMatch?: JobMatchSectionScore;
  };
  ats: ATSCompatibility;
  flags: CVFlag[];
  strengths: string[];
  improvements: CVImprovement[];
};

/** Optional job-aware scoring inputs (GET query or POST detailed body). */
export type CvScoreJobContextParams = {
  jobDescription?: string;
  targetRole?: string;
};

/** POST /cv/chat-create body — extend as backend adds fields. */
export type ChatCreateCVPayload = Record<string, unknown>;

/** Successful CV persist (chat-create, parse-text, etc.). */
export type CvPersistResult = {
  profileId: string;
  profile: CVProfile;
};

/** Normalize profile id from API `data` envelopes. */
export function resolveCvProfileId(
  body: Record<string, unknown>,
  profile?: { id?: string } | null,
): string {
  return String(
    body.cvProfileId ?? body.profileId ?? body.id ?? profile?.id ?? '',
  ).trim();
}

function normalizeCvPersistResult(raw: unknown): CvPersistResult {
  const envelope = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const nested =
    envelope.profile !== null &&
    typeof envelope.profile === 'object' &&
    !Array.isArray(envelope.profile)
      ? (envelope.profile as Record<string, unknown>)
      : null;
  const profile = mapBodyToCvProfile(nested ?? envelope);
  const profileId = resolveCvProfileId(envelope, profile);
  if (!profileId) {
    throw new Error('CV persist response missing profile id');
  }
  return {
    profileId,
    profile: { ...profile, id: profileId },
  };
}

export type ChatConversationHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatConversationResponse =
  | { type: 'message'; message: string }
  | { type: 'complete'; message: string; extractedData: ChatCreateCVPayload };

export type CvSpellIssue = {
  /** Same as `issueId` when the API sends both. */
  id?: string;
  issueId?: string;
  start?: number;
  end?: number;
  type?: 'spelling' | 'grammar' | 'style';
  severity?: 'high' | 'medium' | 'low';
  confidence?: number;
  suggestions?: string[];
  /** Hash of the analyzed plain text; required for apply + 409 recovery. */
  sourceTextHash?: string;
  sectionId: string;
  fieldPath?: string;
  message: string;
  suggestion?: string;
  original?: string;
  originalText?: string;
};

export type CvSpellcheckFieldResult = {
  sectionId: string;
  fieldPath: string;
  sourceTextHash?: string;
  issues: CvSpellIssue[];
};

export type CvSpellcheckBulkResult = {
  results: Record<
    string,
    Array<{
      fieldPath: string;
      sourceTextHash?: string;
      issues: CvSpellIssue[];
    }>
  >;
};

export type CvSpellcheckApplyPayload = {
  sectionId: string;
  fieldPath: string;
  text: string;
  issueId: string;
  sourceTextHash: string;
  start: number;
  end: number;
  suggestion: string;
  forceRefresh?: boolean;
};

export type CvSpellcheckApplyResult = {
  issues: CvSpellIssue[];
  sourceTextHash: string;
  applied?: boolean;
  alreadyApplied?: boolean;
  /** When present, replaces the whole field string client-side. */
  text?: string;
};

export type CvCompletenessResult = {
  score: number;
  totalFields: number;
  filledFields: number;
  sections: Array<{
    sectionId: string;
    sectionType: string;
    label: string;
    missingFields: Array<{
      fieldPath: string;
      label: string;
      required: boolean;
    }>;
  }>;
};

export type {
  CvAssistantCommandResponse,
  CvAssistantScope,
  CvAssistantSectionCommandResult,
  CvAssistantSectionDiff,
  CvGlobalAssistantCommandResponse,
  CvGlobalAssistantFindingsResult,
  CvGlobalAssistantFullCvResult,
  CvGlobalAssistantOperation,
  CvGlobalAssistantOperationKey,
  CvGlobalAssistantOperationScope,
} from '@/lib/cvGlobalAssistant';

function normalizeChatConversationResponse(
  raw: unknown,
): ChatConversationResponse {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const complete =
    body.type === 'complete' ||
    body.done === true ||
    body.status === 'complete' ||
    body.phase === 'complete';
  const message = String(body.message ?? body.content ?? body.text ?? '');
  if (complete) {
    let extracted: Record<string, unknown> = {};
    if (
      body.extractedData !== null &&
      typeof body.extractedData === 'object' &&
      !Array.isArray(body.extractedData)
    ) {
      extracted = body.extractedData as Record<string, unknown>;
    } else if (
      body.payload !== null &&
      typeof body.payload === 'object' &&
      !Array.isArray(body.payload)
    ) {
      extracted = body.payload as Record<string, unknown>;
    }
    return {
      type: 'complete',
      message,
      extractedData: extracted as ChatCreateCVPayload,
    };
  }
  return { type: 'message', message };
}

/** POST /cv/parse-text — structured CV from pasted text. */
export type ParseTextCvResult = {
  profile: CVProfile;
  profileId: string;
  importSummary: CvParseImportSummary | null;
};

function normalizeParseTextCvResult(raw: unknown): ParseTextCvResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const profile = mapBodyToCvProfile(body);
  const profileId = resolveCvProfileId(body, profile);
  if (!profileId) {
    throw new Error('CV parse-text response missing profile id');
  }
  return {
    profile: { ...profile, id: profileId },
    profileId,
    importSummary: extractCvParseImportSummary(body),
  };
}

export type AnalyticsCvProfileRow = {
  id: string;
  name: string;
  score: number | null;
  isDefault: boolean;
};

export type AnalyticsOverview = {
  jobsAnalyzed: number;
  averageMatchScore: number;
  applicationsSent: number;
  /** When backend sends multi-CV summary on analytics overview */
  cvProfiles?: AnalyticsCvProfileRow[];
  cvUploaded?: boolean;
  aiUsesToday?: number;
  aiDailyLimit?: number | null;
  aiUsesRemaining?: number | null;
  aiUsageResetsAt?: string;
  aiUsageTimezone?: string;
};

function normalizeAnalyticsCvProfileRow(
  raw: unknown,
): AnalyticsCvProfileRow | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? o.cvProfileId ?? '').trim();
  if (!id) return null;
  const scoreRaw = o.score;
  const score =
    typeof scoreRaw === 'number' && Number.isFinite(scoreRaw)
      ? scoreRaw
      : scoreRaw === null
        ? null
        : null;
  return {
    id,
    name: String(o.name ?? 'CV'),
    score,
    isDefault: o.isDefault === true,
  };
}

function normalizeAnalyticsOverview(raw: unknown): AnalyticsOverview {
  const body = unwrapApiDataEnvelope(raw);
  const aiDailyLimit = pickNullableNumber(body.aiDailyLimit);
  const aiUsesRemaining = pickNullableNumber(body.aiUsesRemaining);
  const rawProfiles = body.cvProfiles;
  const cvProfiles =
    Array.isArray(rawProfiles) && rawProfiles.length
      ? (rawProfiles
          .map(normalizeAnalyticsCvProfileRow)
          .filter(Boolean) as AnalyticsCvProfileRow[])
      : undefined;
  return {
    jobsAnalyzed: Number(body.totalJobsAnalyzed ?? body.jobsAnalyzed ?? 0),
    averageMatchScore: Number(body.averageMatchScore ?? 0),
    applicationsSent: Number(
      body.totalApplications ?? body.applicationsSent ?? 0,
    ),
    cvProfiles,
    cvUploaded:
      typeof body.cvUploaded === 'boolean' ? body.cvUploaded : undefined,
    aiUsesToday:
      typeof body.aiUsesToday === 'number' && Number.isFinite(body.aiUsesToday)
        ? body.aiUsesToday
        : undefined,
    aiDailyLimit: aiDailyLimit === undefined ? undefined : aiDailyLimit,
    aiUsesRemaining:
      aiUsesRemaining === undefined ? undefined : aiUsesRemaining,
    aiUsageResetsAt:
      typeof body.aiUsageResetsAt === 'string'
        ? body.aiUsageResetsAt
        : undefined,
    aiUsageTimezone:
      typeof body.aiUsageTimezone === 'string'
        ? body.aiUsageTimezone
        : undefined,
  };
}

function parseApplicationStatus(v: unknown): ApplicationTrackerStatus {
  const raw = String(v ?? 'applied').trim();
  const s = raw.toLowerCase().replace(/-/g, '_');
  const map: ApplicationTrackerStatus[] = [
    'draft',
    'researching',
    'ready_to_apply',
    'applied',
    'interview_scheduled',
    'interviewed',
    'offer_received',
    'negotiating',
    'accepted',
    'rejected',
    'withdrawn',
    'ghosted',
  ];
  if (map.includes(s as ApplicationTrackerStatus))
    return s as ApplicationTrackerStatus;
  const u = raw.toUpperCase();
  if (u === 'INTERVIEW' || u === 'INTERVIEW_SCHEDULED')
    return 'interview_scheduled';
  if (u === 'OFFER' || u === 'OFFER_RECEIVED') return 'offer_received';
  if (u === 'REJECTED') return 'rejected';
  if (u === 'WITHDRAWN') return 'withdrawn';
  if (u === 'GHOSTED') return 'ghosted';
  if (u === 'INTERVIEWED') return 'interviewed';
  if (u === 'APPLIED') return 'applied';
  return 'applied';
}

function normalizeApplicationItem(raw: unknown): ApplicationItem {
  const body = unwrapApiDataEnvelope(raw);
  const o = body as Record<string, unknown>;
  const jobAnalysisId =
    typeof o.jobAnalysisId === 'string'
      ? o.jobAnalysisId
      : typeof o.job_analysis_id === 'string'
        ? o.job_analysis_id
        : undefined;
  const interviewPrepAvailable =
    o.interviewPrepAvailable === true || o.interview_prep_available === true;
  const applicationAssist = parseApplicationAssist(
    o.applicationAssist ?? o.application_assist,
  );
  return {
    id: String(o.id ?? ''),
    title: String(o.title ?? 'Untitled role'),
    company: String(o.company ?? 'Unknown company'),
    url: typeof o.url === 'string' ? o.url : undefined,
    matchScore:
      typeof o.matchScore === 'number' && Number.isFinite(o.matchScore)
        ? o.matchScore
        : undefined,
    status: parseApplicationStatus(o.status),
    notes: typeof o.notes === 'string' ? o.notes : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
    jobAnalysisId,
    interviewPrepAvailable: interviewPrepAvailable ? true : undefined,
    origin: typeof o.origin === 'string' ? o.origin : undefined,
    state: typeof o.state === 'string' ? o.state : undefined,
    isApplied: o.isApplied === true || o.is_applied === true ? true : undefined,
    lastActivityAt:
      typeof o.lastActivityAt === 'string'
        ? o.lastActivityAt
        : typeof o.last_activity_at === 'string'
          ? o.last_activity_at
          : undefined,
    nextRecommendedAction:
      typeof o.nextRecommendedAction === 'string'
        ? o.nextRecommendedAction
        : typeof o.next_recommended_action === 'string'
          ? o.next_recommended_action
          : undefined,
    reasonText:
      typeof o.reasonText === 'string'
        ? o.reasonText
        : typeof o.reason_text === 'string'
          ? o.reason_text
          : undefined,
    ...(applicationAssist ? { applicationAssist } : {}),
  };
}

function normalizeNotificationItem(raw: unknown): NotificationItem {
  const o = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const meta = o.metadata;
  let metadata: NotificationItem['metadata'];
  if (meta !== null && typeof meta === 'object' && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    const pickString = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const v = m[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return undefined;
    };
    const applicationId = pickString(
      'applicationId',
      'application_id',
      'appId',
      'jobApplicationId',
      'job_application_id',
    );
    const jobAnalysisId = pickString(
      'jobAnalysisId',
      'job_analysis_id',
      'jobId',
      'job_id',
    );
    const bookmarkId = pickString(
      'bookmarkId',
      'bookmark_id',
      'hubBookmarkId',
      'hub_bookmark_id',
    );
    const href = pickString('href', 'deepLink', 'url', 'route');
    const ctaHref = pickString('ctaHref', 'cta_href');
    const focus = pickString('focus');
    if (applicationId || jobAnalysisId || bookmarkId || href || ctaHref) {
      metadata = {
        ...(applicationId ? { applicationId } : {}),
        ...(jobAnalysisId ? { jobAnalysisId, jobId: jobAnalysisId } : {}),
        ...(bookmarkId ? { bookmarkId } : {}),
        ...(href ? { href } : {}),
        ...(ctaHref ? { ctaHref } : {}),
        ...(focus ? { focus } : {}),
      };
    }
  }
  const message =
    typeof o.message === 'string' && o.message.trim()
      ? o.message
      : typeof o.title === 'string' && o.title.trim()
        ? o.title
        : typeof o.body === 'string'
          ? o.body
          : '';
  return {
    id: String(o.id ?? ''),
    message,
    read: o.read === true || o.isRead === true || o.is_read === true,
    createdAt:
      typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    metadata,
  };
}

function normalizeDiscoverJobsResponse(raw: unknown): DiscoverJobsResponse {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const qualityRaw =
    body.qualityState !== null &&
    typeof body.qualityState === 'object' &&
    !Array.isArray(body.qualityState)
      ? (body.qualityState as Record<string, unknown>)
      : body.quality_state !== null &&
          typeof body.quality_state === 'object' &&
          !Array.isArray(body.quality_state)
        ? (body.quality_state as Record<string, unknown>)
        : null;
  const base = body as unknown as DiscoverJobsResponse;
  const rawItems = Array.isArray(base.items) ? base.items : [];
  const items = rawItems.map((item) => normalizeJobListingDto(item));
  return {
    ...base,
    items,
    total: typeof base.total === 'number' ? base.total : items.length,
    page: typeof base.page === 'number' ? base.page : 1,
    pageSize: typeof base.pageSize === 'number' ? base.pageSize : 20,
    locationFallback:
      body.locationFallback === true || body.location_fallback === true,
    remoteFirst: body.remoteFirst === true || body.remote_first === true,
    ...(body.freshness !== null &&
    typeof body.freshness === 'object' &&
    !Array.isArray(body.freshness)
      ? {
          freshness: {
            newSinceLastVisitCount:
              typeof (body.freshness as Record<string, unknown>)
                .newSinceLastVisitCount === 'number'
                ? ((body.freshness as Record<string, unknown>)
                    .newSinceLastVisitCount as number)
                : typeof (body.freshness as Record<string, unknown>)
                      .new_since_last_visit_count === 'number'
                  ? Number(
                      (body.freshness as Record<string, unknown>)
                        .new_since_last_visit_count,
                    )
                  : 0,
            updatedSinceLastVisitCount:
              typeof (body.freshness as Record<string, unknown>)
                .updatedSinceLastVisitCount === 'number'
                ? ((body.freshness as Record<string, unknown>)
                    .updatedSinceLastVisitCount as number)
                : typeof (body.freshness as Record<string, unknown>)
                      .updated_since_last_visit_count === 'number'
                  ? Number(
                      (body.freshness as Record<string, unknown>)
                        .updated_since_last_visit_count,
                    )
                  : 0,
            lastSeenAt:
              typeof (body.freshness as Record<string, unknown>).lastSeenAt ===
              'string'
                ? String((body.freshness as Record<string, unknown>).lastSeenAt)
                : typeof (body.freshness as Record<string, unknown>)
                      .last_seen_at === 'string'
                  ? String(
                      (body.freshness as Record<string, unknown>).last_seen_at,
                    )
                  : null,
          },
        }
      : {}),
    ...(qualityRaw
      ? {
          qualityState: {
            mode: (() => {
              const s = String(qualityRaw.mode ?? '')
                .trim()
                .toLowerCase();
              return s === 'healthy' || s === 'low_quality' || s === 'empty'
                ? s
                : 'healthy';
            })(),
            reasonCodes: Array.isArray(qualityRaw.reasonCodes)
              ? (qualityRaw.reasonCodes as unknown[]).filter(
                  (x): x is string => typeof x === 'string',
                )
              : [],
            suggestedActions: Array.isArray(qualityRaw.suggestedActions)
              ? (qualityRaw.suggestedActions as unknown[])
                  .filter(
                    (x): x is Record<string, unknown> =>
                      x !== null && typeof x === 'object' && !Array.isArray(x),
                  )
                  .map((x) => ({
                    type: String(x.type ?? '').trim() as
                      | 'improve_cv'
                      | 'expand_location'
                      | 'adjust_filters'
                      | 'refresh_preferences',
                    label:
                      typeof x.label === 'string' ? x.label : 'Take action',
                    route:
                      typeof x.route === 'string'
                        ? x.route
                        : '/dashboard/job-board',
                    impactHint:
                      typeof x.impactHint === 'string' ? x.impactHint : null,
                  }))
              : [],
          },
        }
      : {}),
    ...(body.searchContext !== null &&
    typeof body.searchContext === 'object' &&
    !Array.isArray(body.searchContext)
      ? {
          searchContext: {
            locationLabel: String(
              (body.searchContext as Record<string, unknown>).locationLabel ??
                '',
            ),
            locationSource: String(
              (body.searchContext as Record<string, unknown>).locationSource ??
                '',
            ),
            countryCode: String(
              (body.searchContext as Record<string, unknown>).countryCode ??
                'US',
            ),
            roleQuery: String(
              (body.searchContext as Record<string, unknown>).roleQuery ?? '',
            ),
          },
        }
      : body.search_context !== null &&
          typeof body.search_context === 'object' &&
          !Array.isArray(body.search_context)
        ? {
            searchContext: {
              locationLabel: String(
                (body.search_context as Record<string, unknown>)
                  .locationLabel ?? '',
              ),
              locationSource: String(
                (body.search_context as Record<string, unknown>)
                  .locationSource ?? '',
              ),
              countryCode: String(
                (body.search_context as Record<string, unknown>).countryCode ??
                  'US',
              ),
              roleQuery: String(
                (body.search_context as Record<string, unknown>).roleQuery ??
                  '',
              ),
            },
          }
        : {}),
  };
}

function parseOnboardingStep(v: unknown): number | undefined {
  if (typeof v === 'number' && v >= 1 && v <= 3 && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 3) return n;
  }
  return undefined;
}

function parseJobSearchUrgency(
  raw: unknown,
): JobSearchUrgency | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (raw === 'asap' || raw === 'few_months' || raw === 'exploring') return raw;
  return undefined;
}

function normalizeTargetRolesField(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = (raw as unknown[])
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function normalizeOnboardingStatus(raw: unknown): OnboardingStatus {
  const body = unwrapApiDataEnvelope(raw);
  const o = body as Record<string, unknown>;
  const focusGetHired = o.focusGetHired ?? o.focus_get_hired;
  const focusStudentLaunchpad =
    o.focusStudentLaunchpad ?? o.focus_student_launchpad;
  const jobUrgencyRaw = o.jobSearchUrgency ?? o.job_search_urgency;
  const targetRolesRaw = o.targetRoles ?? o.target_roles;
  const referralSourceRaw = o.referralSource ?? o.referral_source;
  const referralOtherRaw = o.referralOther ?? o.referral_other;
  return {
    completed: o.completed === true,
    step: parseOnboardingStep(o.step ?? o.currentStep),
    selectedFeatures: Array.isArray(o.selectedFeatures)
      ? (o.selectedFeatures as unknown[]).filter(
          (x): x is string => typeof x === 'string',
        )
      : undefined,
    primaryGoal: typeof o.primaryGoal === 'string' ? o.primaryGoal : undefined,
    hasCV: typeof o.hasCV === 'boolean' ? o.hasCV : undefined,
    focusGetHired:
      typeof focusGetHired === 'boolean' ? focusGetHired : undefined,
    focusStudentLaunchpad:
      typeof focusStudentLaunchpad === 'boolean'
        ? focusStudentLaunchpad
        : undefined,
    jobSearchUrgency: parseJobSearchUrgency(jobUrgencyRaw),
    targetRoles: normalizeTargetRolesField(targetRolesRaw),
    referralSource:
      referralSourceRaw === null
        ? null
        : typeof referralSourceRaw === 'string'
          ? referralSourceRaw
          : undefined,
    referralOther:
      referralOtherRaw === null
        ? null
        : typeof referralOtherRaw === 'string'
          ? referralOtherRaw
          : undefined,
  };
}

/** UUID v4-ish (loose) — used only to recover a row id when the API nests it under unusual keys. */
const CV_SECTION_ROW_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function findIdLikeUuidInRecord(
  o: Record<string, unknown>,
  depth: number,
): string {
  if (depth > 3) return '';
  for (const [k, v] of Object.entries(o)) {
    const kl = k.toLowerCase();
    if (typeof v === 'string') {
      const t = v.trim();
      if (
        t &&
        CV_SECTION_ROW_UUID_RE.test(t) &&
        (kl.includes('id') || kl === 'uuid')
      )
        return t;
    }
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      (kl === 'data' || kl === 'meta' || kl === 'section')
    ) {
      const inner = findIdLikeUuidInRecord(
        v as Record<string, unknown>,
        depth + 1,
      );
      if (inner) return inner;
    }
  }
  return '';
}

/** Flatten common Nest/Prisma shapes where the row id sits on the root, under `data`, or under `section`. */
function cvSectionRecordLayers(
  body: Record<string, unknown>,
): Record<string, unknown>[] {
  const layers: Record<string, unknown>[] = [body];
  const data = body.data;
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    layers.push(data as Record<string, unknown>);
  }
  const sec = body.section;
  if (sec !== null && typeof sec === 'object' && !Array.isArray(sec)) {
    layers.push(sec as Record<string, unknown>);
  }
  return layers;
}

/** Prisma / Nest may expose the row primary key under several names or nested objects. */
function resolveCvSectionRowId(body: Record<string, unknown>): string {
  const keys = [
    'id',
    'sectionId',
    'section_id',
    'cvSectionId',
    'cv_section_id',
    'uuid',
    'pk',
  ] as const;
  for (const layer of cvSectionRecordLayers(body)) {
    for (const k of keys) {
      const c = layer[k];
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (typeof c === 'number' && Number.isFinite(c)) return String(c);
    }
  }
  const scraped = findIdLikeUuidInRecord(body, 0);
  if (scraped) return scraped;
  return '';
}

function normalizeCVSection(raw: unknown): CVSectionRecord {
  /** Rare list shape: array of section row UUID strings from the API. */
  if (typeof raw === 'string') {
    const id = raw.trim();
    return {
      id,
      type: 'custom',
      order: 0,
      hidden: false,
      data: undefined,
    };
  }
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const hidden =
    typeof body.visible === 'boolean'
      ? body.visible !== true
      : body.hidden === true;
  const orderRaw = body.order;
  const orderNum =
    typeof orderRaw === 'number' && Number.isFinite(orderRaw)
      ? orderRaw
      : typeof orderRaw === 'string' && /^\d+$/.test(orderRaw.trim())
        ? parseInt(orderRaw.trim(), 10)
        : 0;

  return {
    id: resolveCvSectionRowId(body),
    type: String(body.type ?? 'custom'),
    order: orderNum,
    hidden,
    data:
      body.data !== null &&
      typeof body.data === 'object' &&
      !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : undefined,
  };
}

function normalizeCvProfileDetail(raw: unknown): CvProfileDetail {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const profileNested =
    body.profile !== null &&
    typeof body.profile === 'object' &&
    !Array.isArray(body.profile)
      ? (body.profile as Record<string, unknown>)
      : null;
  const sectionsSource = profileNested ?? body;
  const sectionsRaw = sectionsSource.sections ?? body.sections;
  let sectionsArr: unknown[] = [];
  if (Array.isArray(sectionsRaw)) {
    sectionsArr = sectionsRaw as unknown[];
  } else if (sectionsRaw !== null && typeof sectionsRaw === 'object') {
    sectionsArr = extractCvSectionRowList({ sections: sectionsRaw } as Record<
      string,
      unknown
    >);
  }
  const sections = sectionsArr.map(normalizeCVSection);
  const profileBody: Record<string, unknown> = profileNested
    ? { ...profileNested }
    : { ...body };
  delete profileBody.sections;
  return {
    profile: mapBodyToCvProfile(profileBody),
    sections,
  };
}

/** Parse assistant commit success envelope (tests + client helpers). */
export function parseCvAssistantCommitResponse(
  raw: unknown,
): CvAssistantCommitResult {
  return normalizeCvAssistantCommitResult(raw);
}

function normalizeCvAssistantCommitResult(raw: unknown): CvAssistantCommitResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const { profile, sections } = normalizeCvProfileDetail(raw);
  const profileId = resolveCvProfileId(body, profile);
  if (!profileId) {
    throw new Error('Assistant commit response missing profile id');
  }
  const messageRaw = body.message;
  const message =
    typeof messageRaw === 'string' && messageRaw.trim()
      ? messageRaw.trim()
      : 'Changes saved to your CV.';
  const targetSectionRaw = body.targetSection ?? body.target_section;
  const targetSection =
    typeof targetSectionRaw === 'string' && targetSectionRaw.trim()
      ? targetSectionRaw.trim()
      : undefined;
  const cvRevisionIdRaw = body.cvRevisionId ?? body.cv_revision_id;
  const cvRevisionId =
    cvRevisionIdRaw === null
      ? null
      : typeof cvRevisionIdRaw === 'string' && cvRevisionIdRaw.trim()
        ? cvRevisionIdRaw.trim()
        : undefined;
  return {
    success: body.success !== false,
    message,
    targetSection,
    sectionsSynced:
      body.sectionsSynced === true || body.sections_synced === true,
    profileId,
    profile: { ...profile, id: profileId },
    sections,
    cvRevisionId,
  };
}

function normalizeCvReorderSectionsResult(
  raw: unknown,
): CvReorderSectionsResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const sectionsRaw = body.sections;
  const sections = Array.isArray(sectionsRaw)
    ? (sectionsRaw as unknown[]).map(normalizeCVSection)
    : [];
  return { sections };
}

function normalizeCvBatchUpsertSectionsResult(
  raw: unknown,
): CvBatchUpsertSectionsResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const sectionsRaw = body.sections;
  const sections = Array.isArray(sectionsRaw)
    ? (sectionsRaw as unknown[]).map(normalizeCVSection)
    : [];
  return {
    success: body.success === true,
    updated:
      typeof body.updated === 'number' && Number.isFinite(body.updated)
        ? Math.max(0, body.updated)
        : 0,
    unchanged:
      typeof body.unchanged === 'number' && Number.isFinite(body.unchanged)
        ? Math.max(0, body.unchanged)
        : 0,
    sections,
  };
}

function pickCvScoreBreakdown(o: Record<string, unknown>): Record<string, unknown> | undefined {
        if (
          o.breakdown !== null &&
          typeof o.breakdown === 'object' &&
    typeof (o.breakdown as Record<string, unknown>).sections === 'object' &&
          (o.breakdown as Record<string, unknown>).sections !== null
        ) {
          return o.breakdown as Record<string, unknown>;
        }
        if (
          o.evaluation !== null &&
          typeof o.evaluation === 'object' &&
    typeof (o.evaluation as Record<string, unknown>).sections === 'object' &&
          (o.evaluation as Record<string, unknown>).sections !== null
        ) {
          return o.evaluation as Record<string, unknown>;
        }
        if (o.breakdown !== null && typeof o.breakdown === 'object') {
          return o.breakdown as Record<string, unknown>;
        }
        return undefined;
}

function hybridFieldsForCvScore(
  o: Record<string, unknown>,
  breakdown?: Record<string, unknown>,
): Pick<
  CVScorePayload,
  | 'scoringMethod'
  | 'structuralScore'
  | 'aiScore'
  | 'aiCached'
  | 'aiEvaluatedAt'
  | 'aiAssessment'
  | 'scoringTransparency'
> {
  const hybrid =
    parseCvHybridScoring(o) ??
    (breakdown ? parseCvHybridScoring(breakdown) : null);
  if (!hybrid) return {};
  return {
    scoringMethod: hybrid.scoringMethod,
    structuralScore: hybrid.structuralScore,
    aiScore: hybrid.aiScore,
    aiCached: hybrid.aiCached,
    aiEvaluatedAt: hybrid.aiEvaluatedAt,
    aiAssessment: hybrid.aiAssessment,
    scoringTransparency: hybrid.scoringTransparency,
  };
}

function normalizeCVScore(raw: unknown): CVScorePayload {
  const body = unwrapApiDataEnvelope(raw);
  const o = body as Record<string, unknown>;
  const rawScore = o.score ?? o.overallScore ?? o.cvScore ?? o.value ?? o.overall;
  const breakdown = pickCvScoreBreakdown(o);
  const hybridFields = hybridFieldsForCvScore(o, breakdown);
  if (rawScore === null || rawScore === undefined) {
    const improvements = normalizeCVImprovementsFromDetailedEnvelope(raw);
    return {
      score: null,
      lastScoredAt:
        typeof o.lastScoredAt === 'string' ? o.lastScoredAt : undefined,
      breakdown,
      improvements: improvements.length > 0 ? improvements : undefined,
      ...hybridFields,
    };
  }
  const n =
    typeof rawScore === 'number'
      ? rawScore
      : typeof rawScore === 'string'
        ? parseFloat(rawScore)
        : NaN;
  const improvements = normalizeCVImprovementsFromDetailedEnvelope(raw);
  return {
    score: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null,
    lastScoredAt:
      typeof o.lastScoredAt === 'string' ? o.lastScoredAt : undefined,
    breakdown,
    improvements: improvements.length > 0 ? improvements : undefined,
    ...hybridFields,
  };
}

function normalizeCVImprovements(raw: unknown): CVImprovementItem[] {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const list: unknown =
    (Array.isArray(body.items) && body.items) ||
    (Array.isArray(body.improvements) && body.improvements) ||
    (Array.isArray(body.suggestions) && body.suggestions) ||
    (Array.isArray(body.feedback) && body.feedback) ||
    (Array.isArray(body.tips) && body.tips) ||
    ensureArray<unknown>(body);
  if (!Array.isArray(list)) return [];
  const rows = list.map((item) => {
    if (!item || typeof item !== 'object') return {};
    const x = item as Record<string, unknown>;
    const suggestionRaw =
      typeof x.suggestion === 'string'
        ? x.suggestion
        : typeof x.recommendation === 'string'
          ? x.recommendation
          : typeof x.action === 'string'
            ? x.action
            : typeof x.fix === 'string'
              ? x.fix
              : undefined;
    const issueRaw =
      typeof x.issue === 'string'
        ? x.issue
        : typeof x.problem === 'string'
          ? x.problem
          : undefined;
    const messageRaw =
      typeof x.message === 'string'
        ? x.message
        : typeof x.text === 'string'
          ? x.text
          : typeof x.description === 'string'
            ? x.description
            : typeof x.title === 'string'
              ? x.title
              : typeof x.feedback === 'string'
                ? x.feedback
                : typeof x.tip === 'string'
                  ? x.tip
                  : suggestionRaw;
    const exampleRaw =
      typeof x.example === 'string'
        ? x.example
        : typeof x.sample === 'string'
          ? x.sample
          : undefined;
    const priorityNum =
      typeof x.priority === 'number' && Number.isFinite(x.priority)
        ? x.priority
        : x.severity === 'HIGH'
          ? 1
          : x.severity === 'MEDIUM'
            ? 2
            : x.severity === 'LOW'
              ? 3
              : undefined;
    const primaryMsg = issueRaw ?? messageRaw;
    const acceptedFieldPaths = Array.isArray(x.acceptedFieldPaths)
      ? x.acceptedFieldPaths.filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        )
      : Array.isArray(x.accepted_field_paths)
        ? x.accepted_field_paths.filter(
            (v): v is string => typeof v === 'string' && v.trim().length > 0,
          )
        : [];
    const pendingFieldPaths = Array.isArray(x.pendingFieldPaths)
      ? x.pendingFieldPaths.filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        )
      : Array.isArray(x.pending_field_paths)
        ? x.pending_field_paths.filter(
            (v): v is string => typeof v === 'string' && v.trim().length > 0,
          )
        : [];
    const statusRaw =
      typeof x.status === 'string' ? x.status.trim().toLowerCase() : '';
    const legacyResolved =
      x.resolved === true || x.isResolved === true || x.is_resolved === true;
    let normalizedStatus: NonNullable<CVImprovementItem['status']>;
    if (
      statusRaw === 'pending' ||
      statusRaw === 'accepted' ||
      statusRaw === 'rejected' ||
      statusRaw === 'applying' ||
      statusRaw === 'failed' ||
      statusRaw === 'in_progress' ||
      statusRaw === 'in progress'
    ) {
      normalizedStatus =
        statusRaw === 'in progress'
          ? 'in_progress'
          : (statusRaw as NonNullable<CVImprovementItem['status']>);
    } else if (statusRaw === 'resolved') {
      normalizedStatus = 'accepted';
    } else if (legacyResolved) {
      normalizedStatus = 'accepted';
    } else {
      normalizedStatus = 'pending';
    }
    const resolvedAt =
      typeof x.resolvedAt === 'string'
        ? x.resolvedAt
        : typeof x.resolved_at === 'string'
          ? x.resolved_at
          : undefined;
    const resolutionRaw =
      typeof x.resolution === 'string' ? x.resolution.trim().toLowerCase() : '';
    const resolution: CVImprovementItem['resolution'] =
      resolutionRaw === 'already_applied'
        ? 'already_applied'
        : resolutionRaw === 'accepted' || resolutionRaw === 'rejected'
          ? (resolutionRaw as 'accepted' | 'rejected')
          : undefined;
    const resolvedCompat =
      legacyResolved ||
      normalizedStatus === 'accepted' ||
      normalizedStatus === 'rejected';
    return {
      id: typeof x.id === 'string' ? x.id : undefined,
      status: normalizedStatus,
      resolvedAt,
      resolution,
      section:
        typeof x.section === 'string'
          ? x.section
          : typeof x.category === 'string'
            ? x.category
            : typeof x.area === 'string'
              ? x.area
              : undefined,
      message: primaryMsg,
      issue: issueRaw,
      severity: x.severity as CVImprovementItem['severity'],
      suggestion: suggestionRaw !== primaryMsg ? suggestionRaw : undefined,
      example: exampleRaw,
      priority: priorityNum,
      acceptedFieldPaths,
      pendingFieldPaths,
      resolved: resolvedCompat,
    };
  });
  return rows.filter(
    (row) => (row.message ?? row.suggestion ?? '').trim().length > 0,
  );
}

export function normalizeCvImprovementsGetResponse(
  raw: unknown,
): CvImprovementsPayload {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const needsScoring = body.needsScoring === true;
  const pendingSuggestionsCount =
    typeof body.pendingSuggestionsCount === 'number' &&
    Number.isFinite(body.pendingSuggestionsCount)
      ? body.pendingSuggestionsCount
      : undefined;
  const score =
    body.score === null
      ? null
      : typeof body.score === 'number' && Number.isFinite(body.score)
        ? Math.max(0, Math.min(100, body.score))
        : undefined;
  const lastScoredAt =
    typeof body.lastScoredAt === 'string' ? body.lastScoredAt : undefined;
  const cvRevisionId =
    body.cvRevisionId === null
      ? null
      : typeof body.cvRevisionId === 'string'
        ? body.cvRevisionId
        : undefined;
  return {
    improvements: normalizeCVImprovements(raw),
    needsScoring,
    pendingSuggestionsCount,
    score,
    lastScoredAt,
    cvRevisionId,
    acceptAllQuota: parseAcceptAllQuota(body.acceptAllQuota ?? body.accept_all_quota),
  };
}

async function fetchCvSuggestionsList(
  cvProfileId?: string,
  includeResolved?: boolean,
): Promise<CvImprovementsPayload> {
  const res = await axiosClient.get<unknown>('/cv/suggestions', {
    params: {
      ...(cvProfileId ? { cvProfileId } : {}),
      ...(includeResolved ? { includeResolved: true } : {}),
    },
  });
  throwIfApiFailureResponse(res.data, res.status);
  return normalizeCvImprovementsGetResponse(res.data);
}

function parseTruthfulnessFields(
  body: Record<string, unknown>,
): CvTruthfulnessMeta {
  const factualityValidated =
    body.factualityValidated === true
      ? true
      : body.factualityValidated === false
        ? false
        : undefined;
  const unsupportedChangesDetected =
    typeof body.unsupportedChangesDetected === 'number' &&
    Number.isFinite(body.unsupportedChangesDetected)
      ? body.unsupportedChangesDetected
      : undefined;
  const tw = body.truthfulnessWarnings;
  const truthfulnessWarnings = Array.isArray(tw)
    ? tw
        .map((x) => (typeof x === 'string' ? x.trim() : String(x)))
        .filter((s) => s.length > 0)
    : undefined;
  return {
    factualityValidated,
    unsupportedChangesDetected,
    truthfulnessWarnings,
  };
}

function parseAcceptAllSummary(
  src: Record<string, unknown>,
): CvAcceptAllSummary | undefined {
  const raw = src.acceptAllSummary ?? src.accept_all_summary;
  if (
    raw === null ||
    raw === undefined ||
    typeof raw !== 'object' ||
    Array.isArray(raw)
  )
    return undefined;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.max(0, Math.floor(v))
      : undefined;
  const out: CvAcceptAllSummary = {};
  const applied = num(o.applied);
  if (applied !== undefined) out.applied = applied;
  const skippedDuplicate = num(o.skippedDuplicate ?? o.skipped_duplicate);
  if (skippedDuplicate !== undefined) out.skippedDuplicate = skippedDuplicate;
  const skippedNoop = num(o.skippedNoop ?? o.skipped_noop);
  if (skippedNoop !== undefined) out.skippedNoop = skippedNoop;
  const failedTruthfulness = num(o.failedTruthfulness ?? o.failed_truthfulness);
  if (failedTruthfulness !== undefined)
    out.failedTruthfulness = failedTruthfulness;
  const skippedAiBudget = num(o.skippedAiBudget ?? o.skipped_ai_budget);
  if (skippedAiBudget !== undefined) out.skippedAiBudget = skippedAiBudget;
  const leftPending = num(o.leftPending ?? o.left_pending);
  if (leftPending !== undefined) out.leftPending = leftPending;
  if (o.queueOverflow === true || o.queue_overflow === true)
    out.queueOverflow = true;
  return Object.keys(out).length > 0 ? out : undefined;
}

function parsePerformanceFields(
  body: Record<string, unknown>,
): CvPerformanceMeta {
  const cacheHit =
    body.cacheHit === true ? true : body.cacheHit === false ? false : undefined;
  const usedSectionScopedPrompt =
    body.usedSectionScopedPrompt === true
      ? true
      : body.usedSectionScopedPrompt === false
        ? false
        : undefined;
  const usedFallback =
    body.usedFallback === true
      ? true
      : body.usedFallback === false
        ? false
        : undefined;
  const latencyMs =
    typeof body.latencyMs === 'number' && Number.isFinite(body.latencyMs)
      ? body.latencyMs
      : undefined;
  const inputCharacters =
    typeof body.inputCharacters === 'number' &&
    Number.isFinite(body.inputCharacters)
      ? body.inputCharacters
      : typeof body.input_characters === 'number' &&
          Number.isFinite(body.input_characters)
        ? body.input_characters
        : undefined;
  const outputCharacters =
    typeof body.outputCharacters === 'number' &&
    Number.isFinite(body.outputCharacters)
      ? body.outputCharacters
      : typeof body.output_characters === 'number' &&
          Number.isFinite(body.output_characters)
        ? body.output_characters
        : undefined;
  const promptTokenCount =
    typeof body.promptTokenCount === 'number' &&
    Number.isFinite(body.promptTokenCount)
      ? body.promptTokenCount
      : typeof body.prompt_tokens === 'number' &&
          Number.isFinite(body.prompt_tokens)
        ? body.prompt_tokens
        : typeof body.promptTokens === 'number' &&
            Number.isFinite(body.promptTokens)
          ? body.promptTokens
          : undefined;
  const completionTokenCount =
    typeof body.completionTokenCount === 'number' &&
    Number.isFinite(body.completionTokenCount)
      ? body.completionTokenCount
      : typeof body.completion_tokens === 'number' &&
          Number.isFinite(body.completion_tokens)
        ? body.completion_tokens
        : typeof body.completionTokens === 'number' &&
            Number.isFinite(body.completionTokens)
          ? body.completionTokens
          : undefined;
  const totalTokenCount =
    typeof body.totalTokenCount === 'number' &&
    Number.isFinite(body.totalTokenCount)
      ? body.totalTokenCount
      : typeof body.total_tokens === 'number' &&
          Number.isFinite(body.total_tokens)
        ? body.total_tokens
        : typeof body.totalTokens === 'number' &&
            Number.isFinite(body.totalTokens)
          ? body.totalTokens
          : undefined;
  return {
    cacheHit,
    usedSectionScopedPrompt,
    usedFallback,
    latencyMs,
    inputCharacters,
    outputCharacters,
    ...(promptTokenCount !== undefined ? { promptTokenCount } : {}),
    ...(completionTokenCount !== undefined ? { completionTokenCount } : {}),
    ...(totalTokenCount !== undefined ? { totalTokenCount } : {}),
  };
}

function parseOptionalStringIdArray(
  body: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string[] | undefined {
  const raw = body[camelKey] ?? body[snakeKey];
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : String(x)))
    .filter((s) => s.length > 0);
}

function parseMutationCommitMeta(
  body: Record<string, unknown>,
): CvMutationCommitMeta {
  const backgroundTasksScheduled =
    body.backgroundTasksScheduled === true
      ? true
      : body.backgroundTasksScheduled === false
        ? false
        : body.background_tasks_scheduled === true
          ? true
          : body.background_tasks_scheduled === false
            ? false
            : undefined;
  const transactionLatencyMs =
    typeof body.transactionLatencyMs === 'number' &&
    Number.isFinite(body.transactionLatencyMs)
      ? body.transactionLatencyMs
      : typeof body.transaction_latency_ms === 'number' &&
          Number.isFinite(body.transaction_latency_ms)
        ? body.transaction_latency_ms
        : undefined;
  const acceptedSuggestionIds = parseOptionalStringIdArray(
    body,
    'acceptedSuggestionIds',
    'accepted_suggestion_ids',
  );
  const rejectedSuggestionIds = parseOptionalStringIdArray(
    body,
    'rejectedSuggestionIds',
    'rejected_suggestion_ids',
  );
  const scoringTriggered =
    body.scoringTriggered === true
      ? true
      : body.scoringTriggered === false
        ? false
        : undefined;
  const structuredRevisionHashRaw =
    body.structuredRevisionHash ?? body.structured_revision_hash;
  const structuredRevisionHash =
    structuredRevisionHashRaw === null
      ? null
      : typeof structuredRevisionHashRaw === 'string'
        ? structuredRevisionHashRaw
        : undefined;
  return {
    backgroundTasksScheduled,
    transactionLatencyMs,
    acceptedSuggestionIds,
    rejectedSuggestionIds,
    scoringTriggered,
    structuredRevisionHash,
  };
}

function parseCvSuggestionMutationEnvelope(
  raw: unknown,
): CvSuggestionMutationResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const nestedData =
    body.data !== null &&
    typeof body.data === 'object' &&
    !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : null;
  const src: Record<string, unknown> = nestedData
    ? { ...body, ...nestedData }
    : body;
  const pendingSuggestionsCount =
    typeof src.pendingSuggestionsCount === 'number' &&
    Number.isFinite(src.pendingSuggestionsCount)
      ? src.pendingSuggestionsCount
      : 0;
  const cvRevisionId =
    typeof src.cvRevisionId === 'string' ? src.cvRevisionId : null;
  const idempotent = src.idempotent === true;
  const alreadyApplied = src.alreadyApplied === true;
  const duplicateSuppressed = src.duplicateSuppressed === true;
  const legacy =
    src.legacy !== null && typeof src.legacy === 'object'
      ? (src.legacy as Record<string, unknown>)
      : undefined;
  const suggestionRow = src.suggestion;
  const suggestion =
    suggestionRow !== null && typeof suggestionRow === 'object'
      ? normalizeCVImprovements({
          suggestions: [suggestionRow as Record<string, unknown>],
        })[0]
      : undefined;
  const remainingDraftPreviews =
    typeof src.remainingDraftPreviews === 'number' &&
    Number.isFinite(src.remainingDraftPreviews)
      ? src.remainingDraftPreviews
      : undefined;
  return {
    suggestion,
    pendingSuggestionsCount,
    cvRevisionId,
    legacy,
    idempotent,
    alreadyApplied,
    duplicateSuppressed,
    ...(remainingDraftPreviews !== undefined ? { remainingDraftPreviews } : {}),
    ...parseTruthfulnessFields(src),
    ...parsePerformanceFields(src),
    ...parseMutationCommitMeta(src),
  };
}

function parseCvSuggestionsBulkEnvelope(
  raw: unknown,
): CvSuggestionsBulkMutationResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const nested =
    body.data !== null &&
    typeof body.data === 'object' &&
    !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : null;
  const src = nested ? { ...body, ...nested } : body;
  const acceptAllSummary = parseAcceptAllSummary(src);
  return {
    acceptedCount:
      typeof src.acceptedCount === 'number' &&
      Number.isFinite(src.acceptedCount)
        ? src.acceptedCount
        : undefined,
    rejectedCount:
      typeof src.rejectedCount === 'number' &&
      Number.isFinite(src.rejectedCount)
        ? src.rejectedCount
        : undefined,
    remainingPendingCount:
      typeof src.remainingPendingCount === 'number' &&
      Number.isFinite(src.remainingPendingCount)
        ? src.remainingPendingCount
        : undefined,
    pendingSuggestionsCount:
      typeof src.pendingSuggestionsCount === 'number' &&
      Number.isFinite(src.pendingSuggestionsCount)
        ? src.pendingSuggestionsCount
        : undefined,
    cvRevisionId:
      src.cvRevisionId === null
        ? null
        : typeof src.cvRevisionId === 'string'
          ? src.cvRevisionId
          : undefined,
    idempotent: src.idempotent === true,
    duplicateSuppressed: src.duplicateSuppressed === true,
    alreadyApplied: src.alreadyApplied === true,
    failedTruthfulnessCount:
      typeof src.failedTruthfulnessCount === 'number' &&
      Number.isFinite(src.failedTruthfulnessCount)
        ? src.failedTruthfulnessCount
        : undefined,
    message:
      typeof src.message === 'string' && src.message.trim()
        ? src.message.trim()
        : undefined,
    acceptAllQueueOverflow: src.acceptAllQueueOverflow === true,
    acceptAllSkippedForAiLimit: src.acceptAllSkippedForAiLimit === true,
    acceptAllDraftReuseCount:
      typeof src.acceptAllDraftReuseCount === 'number' &&
      Number.isFinite(src.acceptAllDraftReuseCount)
        ? src.acceptAllDraftReuseCount
        : undefined,
    acceptAllMaxSuggestions:
      typeof src.acceptAllMaxSuggestions === 'number' &&
      Number.isFinite(src.acceptAllMaxSuggestions)
        ? src.acceptAllMaxSuggestions
        : undefined,
    acceptAllMaxAiCalls:
      typeof src.acceptAllMaxAiCalls === 'number' &&
      Number.isFinite(src.acceptAllMaxAiCalls)
        ? src.acceptAllMaxAiCalls
        : undefined,
    acceptAllAiCalls:
      typeof src.acceptAllAiCalls === 'number' &&
      Number.isFinite(src.acceptAllAiCalls)
        ? src.acceptAllAiCalls
        : typeof src.accept_all_ai_calls === 'number' &&
            Number.isFinite(src.accept_all_ai_calls)
          ? src.accept_all_ai_calls
        : undefined,
    cacheHit: src.cacheHit === true,
    ...parseTruthfulnessFields(src),
    ...parsePerformanceFields(src),
    ...parseMutationCommitMeta(src),
    ...(acceptAllSummary ? { acceptAllSummary } : {}),
  };
}

/** Pull improvement rows from detailed score response (path-scoped or legacy global POST) when not on GET /cv/improvements yet. */
function normalizeCVImprovementsFromDetailedEnvelope(
  raw: unknown,
): CVImprovementItem[] {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const direct = normalizeCVImprovements(raw);
  if (direct.length > 0) return direct;
  const nested = body.score;
  if (nested !== null && typeof nested === 'object') {
    const n = normalizeCVImprovements(nested);
    if (n.length > 0) return n;
  }
  const dataNested = body.data;
  if (dataNested !== null && typeof dataNested === 'object') {
    const n = normalizeCVImprovements(dataNested);
    if (n.length > 0) return n;
  }
  return [];
}

function tryPickJobAnalysisFromMutationBody(
  o: Record<string, unknown>,
): unknown | null {
  const direct = o.jobAnalysis ?? o.job_analysis;
  if (
    direct !== null &&
    direct !== undefined &&
    typeof direct === 'object' &&
    !Array.isArray(direct)
  ) {
    return direct;
  }
  const nested = o.analysis;
  if (
    nested !== null &&
    nested !== undefined &&
    typeof nested === 'object' &&
    !Array.isArray(nested)
  ) {
    const a = nested as Record<string, unknown>;
    if (
      typeof a.matchScore === 'number' ||
      Array.isArray(a.missingSkills) ||
      Array.isArray(a.strengths)
    ) {
      return nested;
    }
  }
  return null;
}

function tryPickDraftPayloadFromMutationBody(
  o: Record<string, unknown>,
): unknown {
  const nested =
    o.tailorDraft ??
    o.tailor_draft ??
    o.draft ??
    o.cvTailorDraft ??
    o.cv_tailor_draft;
  if (
    nested !== null &&
    nested !== undefined &&
    typeof nested === 'object' &&
    !Array.isArray(nested)
  ) {
    return nested;
  }
  if (
    Array.isArray(o.drafts) &&
    (typeof o.id === 'string' || typeof o.id === 'number')
  ) {
    return o;
  }
  return o;
}

export function normalizeTailorMutationResponse(
  raw: unknown,
): TailorMutationResponse {
  const body = unwrapApiDataEnvelope(raw);
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const jobRaw = tryPickJobAnalysisFromMutationBody(o);
    const draftRaw = tryPickDraftPayloadFromMutationBody(o);
    return {
      draft: normalizeCvTailorDraft(draftRaw),
      jobAnalysis: jobRaw ? normalizeJobAnalysis(jobRaw) : null,
    };
  }
  return {
    draft: normalizeCvTailorDraft(raw),
    jobAnalysis: null,
  };
}

function normalizeCvTailorDraft(raw: unknown): CvTailorDraft {
  const body = unwrapApiDataEnvelope(raw);
  /** Some stacks double-wrap `{ success, data: { data: draft } }` after a proxy. */
  let row = body;
  const maybeNested = row.data;
  if (
    maybeNested !== null &&
    typeof maybeNested === 'object' &&
    !Array.isArray(maybeNested) &&
    typeof (maybeNested as Record<string, unknown>).id === 'string' &&
    Array.isArray((maybeNested as Record<string, unknown>).drafts)
  ) {
    row = maybeNested as Record<string, unknown>;
  }

  const draftsRaw = Array.isArray(row.drafts) ? row.drafts : [];
  const drafts: CvTailorDraftEntry[] = draftsRaw
    .filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === 'object' && !Array.isArray(x),
    )
    .map((d) => {
      const cfRaw = d.changedFields ?? d.changed_fields;
      const cf = Array.isArray(cfRaw)
        ? cfRaw.filter((x): x is string => typeof x === 'string')
        : [];
      const st = d.status;
      const status: CvTailorDraftSectionStatus =
        st === 'accepted' || st === 'rejected' || st === 'pending'
          ? st
          : 'pending';
      const patchIdRaw = d.patchId ?? d.patch_id;
      const patchId =
        typeof patchIdRaw === 'string' && patchIdRaw.trim()
          ? patchIdRaw.trim()
          : null;
      const sectionId = String(d.sectionId ?? d.section_id ?? '').trim();
      const sectionType = String(d.sectionType ?? d.section_type ?? '').trim();
      return {
        sectionId,
        sectionType,
        before: coerceAiPatchSectionBlob(d.before, sectionType),
        after: coerceAiPatchSectionBlob(d.after, sectionType),
        status,
        changedFields: cf,
        patchId,
      };
    });
  const top = row.status;
  const status: CvTailorDraftStatus =
    top === 'pending' || top === 'partially_accepted' || top === 'completed'
      ? top
      : 'pending';
  const skillsRaw = row.selectedSkills ?? row.selected_skills;
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.filter((x): x is string => typeof x === 'string')
    : [];
  const tailoredCvNameRaw = row.tailoredCvName ?? row.tailored_cv_name;
  const tailoredCvName =
    typeof tailoredCvNameRaw === 'string' ? tailoredCvNameRaw : null;

  return {
    id: String(row.id ?? '').trim(),
    cvProfileId: String(row.cvProfileId ?? row.cv_profile_id ?? '').trim(),
    jobAnalysisId: String(
      row.jobAnalysisId ?? row.job_analysis_id ?? '',
    ).trim(),
    selectedSkills: skills,
    status,
    drafts,
    tailoredCvName,
  };
}

/** Optional tailor draft on GET /jobs/:id (several plausible Nest DTO shapes). */
function tryPickTailorDraftPayload(raw: unknown): unknown | null {
  const body = unwrapApiDataEnvelope(raw);
  if (body === null || typeof body !== 'object' || Array.isArray(body))
    return null;
  const o = body as Record<string, unknown>;
  const direct =
    o.tailorDraft ??
    o.tailor_draft ??
    o.cvTailorDraft ??
    o.cv_tailor_draft ??
    o.tailoringDraft ??
    o.tailoring_draft;
  if (
    direct !== null &&
    direct !== undefined &&
    typeof direct === 'object' &&
    !Array.isArray(direct)
  ) {
    return direct;
  }
  const job = o.job;
  if (job !== null && typeof job === 'object' && !Array.isArray(job)) {
    const j = job as Record<string, unknown>;
    const nested =
      j.tailorDraft ??
      j.tailor_draft ??
      j.cvTailorDraft ??
      j.activeTailorDraft ??
      j.active_tailor_draft;
    if (
      nested !== null &&
      nested !== undefined &&
      typeof nested === 'object' &&
      !Array.isArray(nested)
    ) {
      return nested;
    }
  }
  const analysis = o.analysis;
  if (
    analysis !== null &&
    typeof analysis === 'object' &&
    !Array.isArray(analysis)
  ) {
    const a = analysis as Record<string, unknown>;
    const nested = a.tailorDraft ?? a.tailor_draft ?? a.cvTailorDraft;
    if (
      nested !== null &&
      nested !== undefined &&
      typeof nested === 'object' &&
      !Array.isArray(nested)
    ) {
      return nested;
    }
  }
  return null;
}

function mergeJobDetailWithTailorDraft(
  detail: JobDetailForForm,
  rawResponse: unknown,
): JobDetailForForm {
  const draftRaw = tryPickTailorDraftPayload(rawResponse);
  if (!draftRaw) return detail;
  const tailorDraft = normalizeCvTailorDraft(draftRaw);
  if (!tailorDraft.id.trim()) return detail;
  const analysisId =
    (detail.analysis.id ?? '').trim() || tailorDraft.jobAnalysisId;
  return {
    ...detail,
    tailorDraft: { ...tailorDraft, jobAnalysisId: analysisId },
  };
}

const auth = {
  /** Backend DTO allows only email + password (extra fields return 400). */
  register: async (payload: { email: string; password: string }) =>
    (await axiosClient.post<{ user?: AuthUser }>('/auth/register', payload))
      .data,
  login: async (payload: { email: string; password: string }) => {
    const res = await axiosClient.post<unknown>('/auth/login', payload);
    throwIfApiFailureResponse(res.data, res.status);
    const normalized = normalizeAuthResponse(res.data, payload.email);
    return {
      accessToken: normalized.accessToken,
      refreshToken: normalized.refreshToken,
      user: mapNormalizedUserToAuthUser(normalized.user) as AuthUser,
    };
  },
  logout: async () => (await axiosClient.post('/auth/logout')).data,
  refresh: async (payload: { refreshToken: string }) => {
    const res = await axiosClient.post<unknown>('/auth/refresh', payload, {
      skipAuthRefresh: true,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const normalized = normalizeRefreshResponse(res.data);
    return {
      accessToken: normalized.accessToken,
      refreshToken: normalized.refreshToken,
      user: mapNormalizedUserToAuthUser(normalized.user) as AuthUser,
    };
  },
  /** Google OAuth — same response shape as login; creates user on first sign-in. */
  google: async (payload: {
    idToken: string;
    name?: string;
    image?: string;
  }) => {
    const res = await axiosClient.post<unknown>('/auth/google', payload);
    throwIfApiFailureResponse(res.data, res.status);
    const normalized = normalizeAuthResponse(res.data);
    return {
      accessToken: normalized.accessToken,
      refreshToken: normalized.refreshToken,
      user: mapNormalizedUserToAuthUser(normalized.user, {
        name: payload.name,
        image: payload.image,
      }) as AuthUser,
    };
  },
};

const users = {
  me: async () => {
    const res = await axiosClient.get<unknown>('/users/me');
    return normalizeUserMe(res.data);
  },
  updateMe: async (payload: UsersPatchMePayload) => {
    const res = await axiosClient.patch<unknown>('/users/me', payload);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeUserMe(res.data);
  },
  updateFeatures: async (selectedFeatures: string[]) => {
    const res = await axiosClient.patch<unknown>('/users/me/features', {
      selectedFeatures,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    const arr = Array.isArray(body.selectedFeatures)
      ? (body.selectedFeatures as unknown[]).filter(
          (x): x is string => typeof x === 'string',
        )
      : [];
    return { selectedFeatures: arr.includes('cv') ? arr : [...arr, 'cv'] };
  },
  /**
   * Opt-in cloud reminder from Job Hub (local-first UI). Call only when the user enables sync.
   * POST /users/me/local-reminders — 201; body per SyncLocalReminderDto.
   */
  syncLocalReminder: async (
    payload: SyncLocalReminderPayload,
  ): Promise<SyncLocalReminderResponse> => {
    const res = await axiosClient.post<unknown>(
      '/users/me/local-reminders',
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return {
      id: typeof raw.id === 'string' ? raw.id : '',
      applicationId:
        typeof raw.applicationId === 'string' ? raw.applicationId : '',
    };
  },
  /**
   * GET /users/me/reminders — cross-application reminders in [from, to] on remindAt.
   * Backend returns 400 if from > to or invalid dates.
   */
  listMyReminders: async (params: {
    from: string;
    to: string;
    page?: number;
    pageSize?: number;
  }): Promise<UserRemindersListResponse> => {
    const res = await axiosClient.get<unknown>('/users/me/reminders', {
      params: {
        from: params.from,
        to: params.to,
        page: params.page,
        pageSize: params.pageSize,
      },
    });
    throwIfApiFailureResponse(res.data, res.status);
    const unwrapped = unwrapApiDataEnvelope(res.data);
    const raw =
      unwrapped !== null &&
      typeof unwrapped === 'object' &&
      !Array.isArray(unwrapped)
        ? (unwrapped as Record<string, unknown>)
        : {};
    const itemsRaw = Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.rows)
        ? raw.rows
        : [];
    const items = ensureArray<unknown>(itemsRaw)
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((x) => normalizeUserReminderItem(x));
    const page =
      typeof raw.page === 'number' && Number.isFinite(raw.page) ? raw.page : 1;
    const pageSize =
      typeof raw.pageSize === 'number' && Number.isFinite(raw.pageSize)
        ? raw.pageSize
        : typeof raw.page_size === 'number' && Number.isFinite(raw.page_size)
          ? raw.page_size
          : 20;
    const total =
      typeof raw.total === 'number' && Number.isFinite(raw.total)
        ? raw.total
        : items.length;
    return { items, page, pageSize, total };
  },
  /**
   * GET /users/me/hub-notes — global note feed (cursor pagination).
   */
  listHubNotes: async (params?: {
    limit?: number;
    cursor?: string | null;
  }): Promise<HubNotesGlobalPage> => {
    const res = await axiosClient.get<unknown>('/users/me/hub-notes', {
      params: {
        limit: params?.limit,
        cursor: params?.cursor ?? undefined,
      },
    });
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const itemsRaw = Array.isArray(o.items)
      ? o.items
      : Array.isArray(o.rows)
        ? o.rows
        : [];
    const items = ensureArray<unknown>(itemsRaw)
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((x) => {
        const n = normalizeHubNoteEntry(x);
        return {
          id: n.id,
          snippet: n.snippet || n.body.slice(0, 120),
          body: n.body,
          createdAt: n.createdAt,
          jobTitle:
            typeof x.jobTitle === 'string'
              ? x.jobTitle
              : typeof x.job_title === 'string'
                ? x.job_title
                : null,
          jobCompany:
            typeof x.jobCompany === 'string'
              ? x.jobCompany
              : typeof x.job_company === 'string'
                ? x.job_company
                : null,
          applicationId:
            typeof x.applicationId === 'string'
              ? x.applicationId
              : typeof x.application_id === 'string'
                ? x.application_id
                : null,
          jobAnalysisId:
            typeof x.jobAnalysisId === 'string'
              ? x.jobAnalysisId
              : typeof x.job_analysis_id === 'string'
                ? x.job_analysis_id
                : null,
          bookmarkId:
            typeof x.bookmarkId === 'string'
              ? x.bookmarkId
              : typeof x.bookmark_id === 'string'
                ? x.bookmark_id
                : null,
        } satisfies HubGlobalNoteItem;
      });
    const nextCursor =
      typeof o.nextCursor === 'string'
        ? o.nextCursor
        : typeof o.next_cursor === 'string'
          ? o.next_cursor
          : null;
    return { items, nextCursor };
  },
  /** PATCH /users/me/hub-bookmarks/:bookmarkId — same body as `jobDiscovery.patchBookmark`. */
  patchHubBookmark: async (
    bookmarkId: string,
    payload: {
      jobAnalysisId?: string | null;
      applicationId?: string | null;
      hubPipelineStage?: HubPipelineStage;
    },
  ): Promise<HubBookmarkItem> => {
    const res = await axiosClient.patch<unknown>(
      `/users/me/hub-bookmarks/${encodeURIComponent(bookmarkId)}`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubBookmarkItem(o);
  },
};

function mapCvSpellcheckIssue(
  x: Record<string, unknown>,
  ctx: { sectionId: string; fieldPath: string; defaultSourceTextHash?: string },
): CvSpellIssue {
  const issueIdStr =
    typeof x.issueId === 'string' && x.issueId.trim()
      ? x.issueId
      : typeof x.id === 'string' && x.id.trim()
        ? x.id
        : undefined;
  const typ =
    x.type === 'spelling' || x.type === 'grammar' || x.type === 'style'
      ? x.type
      : undefined;
  const sev =
    x.severity === 'high' || x.severity === 'medium' || x.severity === 'low'
      ? x.severity
      : undefined;
  const origText =
    typeof x.originalText === 'string'
      ? x.originalText
      : typeof x.original === 'string'
        ? x.original
        : undefined;
  const srcHash =
    typeof x.sourceTextHash === 'string'
      ? x.sourceTextHash
      : typeof ctx.defaultSourceTextHash === 'string'
        ? ctx.defaultSourceTextHash
        : undefined;
  return {
    sectionId: ctx.sectionId,
    fieldPath: ctx.fieldPath,
    issueId: issueIdStr,
    id: issueIdStr,
    start: typeof x.start === 'number' ? x.start : undefined,
    end: typeof x.end === 'number' ? x.end : undefined,
    type: typ,
    severity: sev,
    suggestions: Array.isArray(x.suggestions)
      ? x.suggestions.filter((s): s is string => typeof s === 'string')
      : undefined,
    confidence: typeof x.confidence === 'number' ? x.confidence : undefined,
    original: typeof x.original === 'string' ? x.original : origText,
    originalText:
      typeof x.originalText === 'string'
        ? x.originalText
        : typeof x.original === 'string'
          ? x.original
          : undefined,
    suggestion: typeof x.suggestion === 'string' ? x.suggestion : undefined,
    sourceTextHash: srcHash,
    message:
      typeof x.message === 'string' && x.message.trim().length > 0
        ? x.message
        : typ === 'grammar' || typ === 'style'
          ? 'Potential grammar/style issue'
          : 'Potential spelling issue',
  };
}

/** Unwrap common `{ sections: [...] }`, `{ sections: { rows: [...] } }`, or Relay-style `edges[].node` shapes. */
function extractCvSectionRowList(rawEnvelope: unknown): unknown[] {
  if (Array.isArray(rawEnvelope)) return rawEnvelope;
  if (!rawEnvelope || typeof rawEnvelope !== 'object') return [];
  const envelope = rawEnvelope as Record<string, unknown>;
  const top = ensureArray<unknown>(envelope.sections ?? envelope);
  if (top.length > 0) return top;
  const sec = envelope.sections;
  if (sec !== null && typeof sec === 'object' && !Array.isArray(sec)) {
    const o = sec as Record<string, unknown>;
    const nested = ensureArray<unknown>(
      o.rows ?? o.items ?? o.records ?? o.list ?? o.data ?? o,
    );
    if (nested.length > 0) return nested;
    const edges = o.edges;
    if (Array.isArray(edges)) {
      const nodes: unknown[] = [];
      for (const e of edges) {
        if (
          e &&
          typeof e === 'object' &&
          !Array.isArray(e) &&
          'node' in (e as Record<string, unknown>)
        ) {
          nodes.push((e as Record<string, unknown>).node);
        }
      }
      if (nodes.length > 0) return nodes;
    }
  }
  return [];
}

/** Trim paths and drop blanks for POST …/cv/improvements/:id/accept|reject (use `changedFields[].fieldPath` from apply preview). */
function sanitizeCvImprovementFieldPaths(
  fields?: string[] | null,
): string[] | undefined {
  if (fields == null || !Array.isArray(fields)) return undefined;
  const out: string[] = [];
  for (const f of fields) {
    if (typeof f !== 'string') continue;
    const t = f.trim();
    if (t.length > 0) out.push(t);
  }
  return out.length > 0 ? out : undefined;
}

const cv = {
  /**
   * POST /cv/parse or POST /cv/profiles/:id/parse (multipart).
   * Pass `rebuildSections: true` on every file upload so core sections match `structured` (backend `rebuildSections=1`).
   */
  parse: async (
    formData: FormData,
    opts?: { rebuildSections?: boolean; cvProfileId?: string },
  ) => {
    const id = opts?.cvProfileId?.trim();
    const url = id
      ? `/cv/profiles/${encodeURIComponent(id)}/parse`
      : '/cv/parse';
    const res = await axiosClient.post<unknown>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...(opts?.rebuildSections === true
        ? { params: { rebuildSections: 1 } }
        : {}),
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvParseResponse(res.data);
  },
  /**
   * POST /cv/profiles/:id/sync-sections-from-structured — rebuild four core sections from stored `structured` (no file).
   * After success, invalidate/refetch `queryKeys.cv.profile(cvProfileId)` and improvements so client state matches merged `structured`.
   */
  syncCoreSectionsFromStructured: async (
    cvProfileId: string,
  ): Promise<void> => {
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/sync-sections-from-structured`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },

  chatConversation: async (data: {
    message: string;
    history: ChatConversationHistoryItem[];
  }): Promise<ChatConversationResponse> => {
    const res = await axiosClient.post<unknown>('/cv/chat-conversation', {
      message: prepareCvChatTextForAi(data.message),
      history: data.history.map((item) => ({
        ...item,
        content: prepareCvChatTextForAi(item.content),
      })),
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeChatConversationResponse(res.data);
  },

  chatCreateCV: async (data: ChatCreateCVPayload): Promise<CvPersistResult> => {
    const res = await axiosClient.post<unknown>('/cv/chat-create', data);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvPersistResult(res.data);
  },
  assistantCommand: async (
    cvProfileId: string,
    payload: {
      command: string;
      targetSection: string;
      cvData?: Record<string, unknown>;
      clarifications?: Array<{ question: string; answer: string }>;
    },
  ): Promise<CvAssistantCommandResponse> => {
    const { cvData: _cvDataOmit, ...assistantPayload } = payload;
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/assistant/command`,
      {
        ...assistantPayload,
        targetSection: payload.targetSection.trim(),
        command: prepareCvChatTextForAi(payload.command),
        ...(payload.clarifications?.length
          ? {
              clarifications: payload.clarifications.map((c) => ({
                question: prepareCvSectionTextForAi(c.question),
                answer: prepareCvChatTextForAi(c.answer),
              })),
            }
          : {}),
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    if (body.type === 'clarify') {
      return {
        type: 'clarify',
        commandId: String(body.commandId ?? body.command_id ?? ''),
        question: sanitizeAssistantClarificationQuestion(
          String(body.question ?? 'Could you clarify your request?'),
        ),
      };
    }
    return normalizeCvAssistantSectionCommandResponse(body);
  },
  /** GET /cv/assistant/global/operations — preset global CV assistant catalog. */
  assistantGlobalOperations: async (): Promise<CvGlobalAssistantOperation[]> => {
    const res = await axiosClient.get<unknown>('/cv/assistant/global/operations');
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvGlobalAssistantOperations(unwrapApiDataEnvelope(res.data));
  },
  assistantGlobalCommand: async (
    cvProfileId: string,
    payload: {
      command: string;
      operation?: CvGlobalAssistantOperationKey;
      cvData?: Record<string, unknown>;
      clarifications?: Array<{ question: string; answer: string }>;
      /** Bullet list from recruiter scan — used with `apply_recruiter_findings`. */
      findings?: string[];
      /** Scan `commandId` for correlation when applying findings. */
      scanCommandId?: string;
    },
  ): Promise<CvGlobalAssistantCommandResponse> => {
    const { cvData: _cvDataOmit, ...globalPayload } = payload;
    const findings =
      payload.findings
        ?.map((f) => prepareCvChatTextForAi(f))
        .filter((f) => f.length > 0) ?? undefined;
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/assistant/global/command`,
      {
        ...globalPayload,
        command: prepareCvChatTextForAi(payload.command),
        ...(findings?.length ? { findings } : {}),
        ...(payload.scanCommandId?.trim()
          ? { scanCommandId: payload.scanCommandId.trim() }
          : {}),
        ...(payload.clarifications?.length
          ? {
              clarifications: payload.clarifications.map((c) => ({
                question: prepareCvSectionTextForAi(c.question),
                answer: prepareCvChatTextForAi(c.answer),
              })),
            }
          : {}),
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvGlobalAssistantCommandResponse(unwrapApiDataEnvelope(res.data));
  },
  /** POST /cv/profiles/:id/recruiter-scan — comprehensive first-impression simulation. */
  recruiterScan: async (
    cvProfileId: string,
    body?: {
      targetRole?: string;
      clarifications?: Array<{ question: string; answer: string }>;
    },
  ): Promise<import('@/lib/cvRecruiterScan').CvRecruiterScanResponse> => {
    const id = cvProfileId.trim();
    if (!id) throw new Error('CV profile id is required');
    const { normalizeCvRecruiterScanResponse } = await import('@/lib/cvRecruiterScan');
    const payload: Record<string, unknown> = {};
    const role = body?.targetRole?.trim();
    if (role) payload.targetRole = role;
    if (body?.clarifications?.length) {
      payload.clarifications = body.clarifications.map((c) => ({
        question: prepareCvSectionTextForAi(c.question),
        answer: prepareCvChatTextForAi(c.answer),
      }));
    }
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(id)}/recruiter-scan`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvRecruiterScanResponse(unwrapApiDataEnvelope(res.data));
  },
  /**
   * POST /cv/profiles/:id/assistant/commit — persist assistant patch to structured CV.
   * May respond with **422** and `error.code === 'CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY'` when the merged patch
   * is rejected for factuality / structural safety; use `getApiErrorMessage` from `@/lib/axios` for user-facing copy.
   */
  assistantCommit: async (
    cvProfileId: string,
    body: { patch: Record<string, unknown>; commandId?: string },
  ): Promise<CvAssistantCommitResult> => {
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/assistant/commit`,
      body,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvAssistantCommitResult(res.data);
  },
  /** POST /cv/profiles/:id/generators/summary/accept — persist chosen summary text. */
  acceptGeneratorSummary: async (
    cvProfileId: string,
    body: { text: string },
  ): Promise<void> => {
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/generators/summary/accept`,
      body,
    );
    throwIfApiFailureResponse(res.data, res.status);
    unwrapApiDataEnvelope(res.data);
  },
  /** POST /cv/profiles/:id/generators/bullet/accept — persist bullet text at canonical fieldPath. */
  acceptGeneratorBullet: async (
    cvProfileId: string,
    body: { fieldPath: string; text: string },
  ): Promise<void> => {
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/generators/bullet/accept`,
      body,
    );
    throwIfApiFailureResponse(res.data, res.status);
    unwrapApiDataEnvelope(res.data);
  },
  checkSpellingField: async (
    cvProfileId: string,
    payload: {
      sectionId: string;
      fieldPath: string;
      text: string;
      language?: string;
    },
  ): Promise<CvSpellcheckFieldResult> => {
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/spellcheck/field`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const rawIssues = Array.isArray(body.issues) ? body.issues : [];
    const sectionId = String(body.sectionId ?? payload.sectionId);
    const fieldPath = String(body.fieldPath ?? payload.fieldPath);
    const sourceTextHash =
      typeof body.sourceTextHash === 'string' ? body.sourceTextHash : undefined;
    const issues = rawIssues
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object',
      )
      .map((x) =>
        mapCvSpellcheckIssue(x, {
          sectionId,
          fieldPath,
          defaultSourceTextHash: sourceTextHash,
        }),
      );
    return {
      sectionId,
      fieldPath,
      sourceTextHash,
      issues,
    };
  },
  checkSpellingBulk: async (
    cvProfileId: string,
    payload?: { language?: string },
  ): Promise<CvSpellcheckBulkResult> => {
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/spellcheck`,
      payload ?? {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const rawResults =
      body.results &&
      typeof body.results === 'object' &&
      !Array.isArray(body.results)
        ? (body.results as Record<string, unknown>)
        : {};
    const results: CvSpellcheckBulkResult['results'] = {};
    for (const [sectionId, rows] of Object.entries(rawResults)) {
      const list = Array.isArray(rows) ? rows : [];
      results[sectionId] = list
        .filter(
          (row): row is Record<string, unknown> =>
            row !== null && typeof row === 'object',
        )
        .map((row) => {
          const fieldPath =
            typeof row.fieldPath === 'string' ? row.fieldPath : 'text';
          const rowSourceTextHash =
            typeof row.sourceTextHash === 'string'
              ? row.sourceTextHash
              : undefined;
          const rawIssues = Array.isArray(row.issues) ? row.issues : [];
          const issues = rawIssues
            .filter(
              (x): x is Record<string, unknown> =>
                x !== null && typeof x === 'object',
            )
            .map((x) =>
              mapCvSpellcheckIssue(x, {
                sectionId,
                fieldPath,
                defaultSourceTextHash: rowSourceTextHash,
              }),
            );
          return { fieldPath, sourceTextHash: rowSourceTextHash, issues };
        });
    }
    return { results };
  },
  applySpellcheck: async (
    cvProfileId: string,
    payload: CvSpellcheckApplyPayload,
  ): Promise<CvSpellcheckApplyResult> => {
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/spellcheck/apply`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const rawIssues = Array.isArray(body.issues) ? body.issues : [];
    const sectionId = String(body.sectionId ?? payload.sectionId);
    const fieldPath = String(body.fieldPath ?? payload.fieldPath);
    const sourceTextHash =
      typeof body.sourceTextHash === 'string'
        ? String(body.sourceTextHash)
        : '';
    const issues = rawIssues
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object',
      )
      .map((x) =>
        mapCvSpellcheckIssue(x, {
          sectionId,
          fieldPath,
          defaultSourceTextHash: sourceTextHash || undefined,
        }),
      );
    return {
      issues,
      sourceTextHash,
      applied:
        body.applied === true
          ? true
          : body.applied === false
            ? false
            : undefined,
      alreadyApplied: body.alreadyApplied === true,
      text: typeof body.text === 'string' ? body.text : undefined,
    };
  },
  getCompleteness: async (
    cvProfileId: string,
  ): Promise<CvCompletenessResult> => {
    const res = await axiosClient.get<unknown>(
      `/cv/profiles/${encodeURIComponent(cvProfileId)}/completeness`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const rawSections = Array.isArray(body.sections) ? body.sections : [];
    return {
      score: typeof body.score === 'number' ? body.score : 0,
      totalFields: typeof body.totalFields === 'number' ? body.totalFields : 0,
      filledFields:
        typeof body.filledFields === 'number' ? body.filledFields : 0,
      sections: rawSections
        .filter(
          (s): s is Record<string, unknown> =>
            s !== null && typeof s === 'object',
        )
        .map((s) => ({
          sectionId: String(s.sectionId ?? ''),
          sectionType: String(s.sectionType ?? ''),
          label: String(s.label ?? s.sectionType ?? 'Section'),
          missingFields: Array.isArray(s.missingFields)
            ? s.missingFields
                .filter(
                  (f): f is Record<string, unknown> =>
                    f !== null && typeof f === 'object',
                )
                .map((f) => ({
                  fieldPath: String(f.fieldPath ?? ''),
                  label: String(f.label ?? 'Missing field'),
                  required: f.required === true,
                }))
            : [],
        })),
    };
  },

  parseTextCV: async (data: {
    rawText: string;
    template?: string;
  }): Promise<ParseTextCvResult> => {
    const res = await axiosClient.post<unknown>('/cv/parse-text', {
      ...data,
      rawText: prepareCvChatTextForAi(data.rawText),
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeParseTextCvResult(res.data);
  },

  getProfile: async () => {
    const res = await axiosClient.get<unknown>('/cv/profile');
    return normalizeCvProfileResponse(res.data);
  },
  updateProfile: async (payload: {
    structured?: CVProfile['structured'];
    rawText?: string;
  }) => (await axiosClient.patch<CVProfile>('/cv/profile', payload)).data,
  /** PATCH /cv/profile — matches UpdateCvProfileDto (Nest). */
  patchProfile: async (payload: {
    structured?: CVProfile['structured'];
    rawText?: string;
    headline?: string;
    location?: string;
    phone?: string;
    website?: string;
    template?: 'classic' | 'modern' | 'creative' | string;
  }) => {
    const res = await axiosClient.patch<unknown>('/cv/profile', payload);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvProfileResponse(res.data);
  },
  deleteProfile: async () => (await axiosClient.delete('/cv/profile')).data,

  listProfiles: async (): Promise<CvProfileSummary[]> => {
    const res = await axiosClient.get<unknown>('/cv/profiles');
    throwIfApiFailureResponse(res.data, res.status);
    const envelope = res.data;
    /** TransformInterceptor: `{ success, data: CvProfile[] }` — `data` is the array itself. */
    const rawList =
      envelope !== null &&
      typeof envelope === 'object' &&
      !Array.isArray(envelope) &&
      'data' in envelope &&
      Array.isArray((envelope as { data: unknown }).data)
        ? ((envelope as { data: unknown[] }).data as unknown[])
        : ensureArray<unknown>(envelope);
    const mapped = rawList
      .map(normalizeCvProfileSummary)
      .filter((p) => p.id !== '');
    /** Dedupe by id if the API ever returns duplicates (should not after client-side upload fix). */
    const byId = new Map<string, (typeof mapped)[0]>();
    for (const p of mapped) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return [...byId.values()];
  },
  createProfile: async (data: {
    name?: string;
    template?: string;
  }): Promise<CvProfileSummary> => {
    const res = await axiosClient.post<unknown>('/cv/profiles', data);
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    return normalizeCvProfileSummary(body);
  },
  getProfileById: async (id: string): Promise<CvProfileDetail> => {
    const res = await axiosClient.get<unknown>(`/cv/profiles/${id}`);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvProfileDetail(res.data);
  },
  updateProfileName: async (
    id: string,
    name: string,
  ): Promise<CvProfileSummary> => {
    const res = await axiosClient.patch<unknown>(`/cv/profiles/${id}`, {
      name,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    return normalizeCvProfileSummary(body);
  },
  /** PATCH /cv/profiles/:id — same body shape as PATCH /cv/profile (UpdateCvProfileDto). */
  patchProfilesEntry: async (
    id: string,
    payload: {
      name?: string;
      headline?: string | null;
      location?: string | null;
      phone?: string | null;
      website?: string | null;
      structured?: CVProfile['structured'];
      rawText?: string;
      template?: 'classic' | 'modern' | 'creative' | string;
    },
  ) => {
    const res = await axiosClient.patch<unknown>(`/cv/profiles/${id}`, payload);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvProfileResponse(res.data);
  },
  deleteCvProfileById: async (id: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(`/cv/profiles/${id}`);
    if (res.data !== undefined && res.data !== null && res.data !== '') {
      throwIfApiFailureResponse(res.data, res.status);
    }
  },
  duplicateCvProfile: async (id: string): Promise<CvProfileSummary> => {
    const res = await axiosClient.post<unknown>(`/cv/profiles/${id}/duplicate`);
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    return normalizeCvProfileSummary(body);
  },
  /** POST /cv/profiles/merge — AI merge preview or create new profile from sources. */
  mergeProfiles: async (payload: {
    profileIds: string[];
    instructions?: string;
    mode?: CvMergeMode;
    name?: string;
    structured?: Record<string, unknown>;
    template?: string;
  }): Promise<CvMergePreviewResult | CvMergeCreatedResult> => {
    const profileIds = payload.profileIds.map((id) => id.trim()).filter(Boolean);
    const mode: CvMergeMode = payload.mode ?? 'preview';
    const res = await axiosClient.post<unknown>('/cv/profiles/merge', {
      profileIds,
      mode,
      ...(payload.instructions?.trim()
        ? { instructions: prepareCvChatTextForAi(payload.instructions) }
        : {}),
      ...(mode === 'create' && payload.name?.trim()
        ? { name: payload.name.trim().slice(0, 100) }
        : {}),
      ...(mode === 'create' && payload.structured
        ? { structured: payload.structured }
        : {}),
      ...(payload.template?.trim() ? { template: payload.template.trim() } : {}),
    });
    throwIfApiFailureResponse(res.data, res.status);
    const parsed = normalizeCvMergeProfilesResponse(unwrapApiDataEnvelope(res.data));
    if (mode === 'create' && parsed.type !== 'created') {
      throw new Error('Merge create did not return a created profile');
    }
    if (mode === 'preview' && parsed.type !== 'preview') {
      throw new Error('Merge preview did not return preview data');
    }
    return parsed;
  },
  setDefaultCvProfile: async (id: string): Promise<void> => {
    const res = await axiosClient.patch<unknown>(`/cv/profiles/${id}/default`);
    if (res.data !== undefined && res.data !== null && res.data !== '') {
      throwIfApiFailureResponse(res.data, res.status);
    }
  },

  /** PATCH /cv/profiles/:id/restore-template — resets `template` to `originalTemplate`. */
  restoreOriginalTemplate: async (profileId: string) => {
    const res = await axiosClient.patch<unknown>(
      `/cv/profiles/${encodeURIComponent(profileId)}/restore-template`,
      {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return {
      template: String(body.template ?? ''),
      originalTemplate: String(body.originalTemplate ?? ''),
      alreadyOnOriginal: body.alreadyOnOriginal === true,
    };
  },

  create: async (data: {
    headline?: string;
    location?: string;
    phone?: string;
    website?: string;
    template?: string;
  }) => {
    const res = await axiosClient.post<unknown>('/cv/create', data);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvProfileResponse(res.data);
  },
  /**
   * POST /cv/create, or on 409 (profile already exists) PATCH /cv/template with the same template.
   * Use when re-entering “pick template → editor” during onboarding or similar flows.
   */
  createOrSyncTemplate: async (data: {
    headline?: string;
    location?: string;
    phone?: string;
    website?: string;
    template?: string;
  }) => {
    try {
      const res = await axiosClient.post<unknown>('/cv/create', data);
      throwIfApiFailureResponse(res.data, res.status);
      return normalizeCvProfileResponse(res.data);
    } catch (e) {
      if (
        axios.isAxiosError(e) &&
        e.response?.status === 409 &&
        data.template != null
      ) {
        const res = await axiosClient.patch<unknown>('/cv/template', {
          template: data.template,
        });
        throwIfApiFailureResponse(res.data, res.status);
        return normalizeCvProfileResponse(res.data);
      }
      throw e;
    }
  },
  /** PATCH /cv/template — backend may accept `cvProfileId` query for multi-profile accounts. */
  updateTemplate: async (template: string, cvProfileId?: string) => {
    const res = await axiosClient.patch<unknown>(
      '/cv/template',
      { template },
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvProfileResponse(res.data);
  },
  getScore: async (cvProfileId?: string, jobCtx?: CvScoreJobContextParams) => {
    const params: Record<string, string> = {};
    if (cvProfileId?.trim()) params.cvProfileId = cvProfileId.trim();
    if (jobCtx?.jobDescription?.trim())
      params.jobDescription = prepareJobDescriptionForAi(jobCtx.jobDescription);
    if (jobCtx?.targetRole?.trim())
      params.targetRole = jobCtx.targetRole.trim();
    const res = await axiosClient.get<unknown>('/cv/score', {
      params: Object.keys(params).length ? params : undefined,
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCVScore(res.data);
  },
  /** GET /cv/profiles/:id/score — optional job context as query params (short JDs). */
  getProfileScore: async (
    profileId: string,
    jobCtx?: CvScoreJobContextParams,
  ) => {
    const params: Record<string, string> = {};
    if (jobCtx?.jobDescription?.trim())
      params.jobDescription = prepareJobDescriptionForAi(jobCtx.jobDescription);
    if (jobCtx?.targetRole?.trim())
      params.targetRole = jobCtx.targetRole.trim();
    const res = await axiosClient.get<unknown>(
      `/cv/profiles/${encodeURIComponent(profileId)}/score`,
      {
        params: Object.keys(params).length ? params : undefined,
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCVScore(res.data);
  },
  /**
   * Legacy **global** detailed score: `POST /cv/score/detailed`.
   * Body supports only optional `{ jobDescription, targetRole }` — there is **no** supported
   * `cvProfileId` / `profileId` on this route. For a specific CV, use {@link getProfileScoreDetailed}
   * (`POST /cv/profiles/:cvProfileId/score/detailed`) with the same optional body fields.
   */
  getScoreDetailed: async (
    _legacyUnusedProfileId?: string,
    config?: {
      signal?: AbortSignal;
      jobDescription?: string;
      targetRole?: string;
    },
  ) => {
    const body: Record<string, unknown> = { ...aiWaitForResultBody };
    if (config?.jobDescription?.trim())
      body.jobDescription = prepareJobDescriptionForAi(config.jobDescription);
    if (config?.targetRole?.trim()) body.targetRole = config.targetRole.trim();
    const res = await axiosClient.post<unknown>('/cv/score/detailed', body, {
      signal: config?.signal,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const resolved = await resolveMaybeQueuedAiResponse(res.data, {
      signal: config?.signal,
    });
    return normalizeCVScore(resolved);
  },
  /** Scoped detailed score: `POST /cv/profiles/:cvProfileId/score/detailed` with optional `{ jobDescription, targetRole }` in the body (canonical for a specific CV). */
  getProfileScoreDetailed: async (
    profileId: string,
    config?: {
      signal?: AbortSignal;
      jobDescription?: string;
      targetRole?: string;
    },
  ) => {
    const body: Record<string, unknown> = { ...aiWaitForResultBody };
    if (config?.jobDescription?.trim())
      body.jobDescription = prepareJobDescriptionForAi(config.jobDescription);
    if (config?.targetRole?.trim()) body.targetRole = config.targetRole.trim();
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(profileId)}/score/detailed`,
      body,
      { signal: config?.signal },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const resolved = await resolveMaybeQueuedAiResponse(res.data, {
      signal: config?.signal,
    });
    return normalizeCVScore(resolved);
  },
  /** GET /cv/suggestions — default: pending queue only; pass includeResolved for history. */
  getSuggestions: async (
    cvProfileId?: string,
    includeResolved?: boolean,
  ): Promise<CvImprovementsPayload> =>
    fetchCvSuggestionsList(cvProfileId, Boolean(includeResolved)),
  /** @alias {@link fetchCvSuggestionsList} pending-only — same as {@link getSuggestions}(cvProfileId, false). */
  getImprovements: async (
    cvProfileId?: string,
  ): Promise<CvImprovementsPayload> =>
    fetchCvSuggestionsList(cvProfileId, false),
  /** POST /cv/suggestions/:suggestionId/accept — full suggestion (no per-field body). */
  acceptSuggestion: async (
    suggestionId: string,
    cvProfileId?: string,
  ): Promise<CvSuggestionMutationResult> => {
    const ref = encodeURIComponent(String(suggestionId));
    const res = await axiosClient.post<unknown>(
      `/cv/suggestions/${ref}/accept`,
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return parseCvSuggestionMutationEnvelope(res.data);
  },
  /** POST /cv/suggestions/:suggestionId/reject — discard / reject full suggestion. */
  rejectSuggestion: async (
    suggestionId: string,
    cvProfileId?: string,
  ): Promise<CvSuggestionMutationResult> => {
    const ref = encodeURIComponent(String(suggestionId));
    const res = await axiosClient.post<unknown>(
      `/cv/suggestions/${ref}/reject`,
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return parseCvSuggestionMutationEnvelope(res.data);
  },
  /**
   * POST /cv/suggestions/:suggestionId/self-fix — user will fix manually; removes from pending queue
   * and marks in progress (backend credits section on save / rescoring).
   */
  selfFixSuggestion: async (
    suggestionId: string,
    cvProfileId?: string,
  ): Promise<CvSuggestionMutationResult> => {
    const ref = encodeURIComponent(String(suggestionId));
    const res = await axiosClient.post<unknown>(
      `/cv/suggestions/${ref}/self-fix`,
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return parseCvSuggestionMutationEnvelope(res.data);
  },
  /**
   * POST /cv/suggestions/:suggestionId/reopen — bring a resolved suggestion back to pending.
   * Used as the undo hook after an accepted AI fix is reverted in the editor.
   */
  reopenSuggestion: async (
    suggestionId: string,
    cvProfileId?: string,
  ): Promise<CvSuggestionMutationResult> => {
    const ref = encodeURIComponent(String(suggestionId));
    const res = await axiosClient.post<unknown>(
      `/cv/suggestions/${ref}/reopen`,
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return parseCvSuggestionMutationEnvelope(res.data);
  },
  /** POST /cv/suggestions/accept-all */
  acceptAllSuggestions: async (
    cvProfileId?: string,
  ): Promise<CvSuggestionsBulkMutationResult> => {
    const res = await axiosClient.post<unknown>(
      '/cv/suggestions/accept-all',
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return parseCvSuggestionsBulkEnvelope(res.data);
  },
  /** POST /cv/suggestions/reject-all */
  rejectAllSuggestions: async (
    cvProfileId?: string,
  ): Promise<CvSuggestionsBulkMutationResult> => {
    const res = await axiosClient.post<unknown>(
      '/cv/suggestions/reject-all',
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return parseCvSuggestionsBulkEnvelope(res.data);
  },
  markImprovementResolved: async (
    pointer: string | number,
    cvProfileId?: string,
  ) => {
    const ref = encodeURIComponent(String(pointer));
    const res = await axiosClient.patch<unknown>(
      `/cv/improvements/${ref}`,
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    return res.data;
  },
  applyImprovement: async (
    pointer: string | number,
    cvProfileId?: string,
  ): Promise<CvApplyImprovementResult> => {
    const ref = encodeURIComponent(String(pointer));
    const res = await axiosClient.post<unknown>(
      `/cv/improvements/${ref}/apply`,
      {},
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const nestedData =
      body.data !== null &&
      typeof body.data === 'object' &&
      !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : null;
    const src: Record<string, unknown> = nestedData
      ? { ...body, ...nestedData }
      : body;
    const rawChanged = Array.isArray(src.changedFields)
      ? src.changedFields
      : [];
    const changedFields = rawChanged
      .filter(
        (f): f is Record<string, unknown> =>
          f !== null && typeof f === 'object',
      )
      .map((f) => {
        const fieldPathCandidates = [
          f.fieldPath,
          f.field_path,
          f.path,
          f.changedPath,
          f.changed_path,
          f.key,
          f.fieldKey,
          f.field_key,
          f.id,
          f.field,
        ];
        const fieldPathRaw =
          fieldPathCandidates.find(
            (x): x is string => typeof x === 'string' && x.trim().length > 0,
          ) ?? '';
        const fieldPath = fieldPathRaw.trim();
        const fieldLabel =
          typeof f.fieldLabel === 'string'
            ? f.fieldLabel
            : typeof f.field_label === 'string'
              ? f.field_label
              : typeof f.field === 'string'
                ? f.field
                : fieldPath;
        const sectionHint =
          typeof src.section === 'string' ? src.section : '';
        return {
          field: fieldLabel,
          fieldPath,
          fieldLabel,
          before: coerceAiPatchToDisplayString(f.before, sectionHint, fieldPath),
          after: coerceAiPatchToDisplayString(f.after, sectionHint, fieldPath),
          type: (f.type === 'added' ||
          f.type === 'removed' ||
          f.type === 'changed'
            ? f.type
            : 'changed') as 'added' | 'removed' | 'changed',
        };
      });
    return {
      success: src.success !== false,
      pointer:
        typeof src.id === 'string' && src.id.trim() ? src.id : String(pointer),
      improvementId:
        typeof src.improvementId === 'string'
          ? src.improvementId
          : typeof src.improvement_id === 'string'
            ? (src.improvement_id as string)
            : typeof src.id === 'string'
              ? src.id
              : null,
      suggestionId:
        typeof src.suggestionId === 'string'
          ? src.suggestionId
          : typeof src.suggestion_id === 'string'
            ? (src.suggestion_id as string)
            : null,
      section: typeof src.section === 'string' ? src.section : '',
      before: src.before ?? null,
      after: src.after ?? null,
      changedFields,
      draftHash: typeof src.draftHash === 'string' ? src.draftHash : null,
      message: typeof src.message === 'string' ? src.message : '',
      duplicateSuppressed:
        src.duplicateSuppressed === true || src.duplicateSuppressed === 1,
      alreadyApplied: src.alreadyApplied === true,
      autoResolved: src.autoResolved === true || src.auto_resolved === true,
      idempotent: src.idempotent === true,
      pendingSuggestionsCount:
        typeof src.pendingSuggestionsCount === 'number'
          ? src.pendingSuggestionsCount
          : undefined,
      cvRevisionId:
        src.cvRevisionId === null
          ? null
          : typeof src.cvRevisionId === 'string'
            ? src.cvRevisionId
            : undefined,
      remainingDraftPreviews:
        typeof src.remainingDraftPreviews === 'number'
          ? src.remainingDraftPreviews
          : undefined,
      ...parseTruthfulnessFields(src),
      ...parsePerformanceFields(src),
    };
  },
  acceptImprovement: async (
    pointer: string | number,
    cvProfileId?: string,
    options?: {
      /** Paths from apply preview (`changedFields[].fieldPath`). Omit, `[]`, or omit blank strings for accept-all. */
      acceptedFields?: string[];
      draftHash?: string;
    },
  ): Promise<CvImprovementPartialMutationResult> => {
    const ref = encodeURIComponent(String(pointer));
    const acceptedFields = sanitizeCvImprovementFieldPaths(
      options?.acceptedFields,
    );
    const res = await axiosClient.post<unknown>(
      `/cv/improvements/${ref}/accept`,
      {
        ...(acceptedFields ? { acceptedFields } : {}),
        ...(options?.draftHash ? { draftHash: options.draftHash } : {}),
      },
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const remainingRaw = Array.isArray(body.remainingChangedFields)
      ? body.remainingChangedFields
      : Array.isArray(body.pendingChangedFields)
        ? body.pendingChangedFields
        : [];
    const remainingChangedFields = remainingRaw
      .map((x) => {
        if (typeof x === 'string') return x;
        if (
          x &&
          typeof x === 'object' &&
          typeof (x as Record<string, unknown>).fieldPath === 'string'
        ) {
          return (x as Record<string, unknown>).fieldPath as string;
        }
        if (
          x &&
          typeof x === 'object' &&
          typeof (x as Record<string, unknown>).field === 'string'
        ) {
          return (x as Record<string, unknown>).field as string;
        }
        return '';
      })
      .filter((x) => x.trim().length > 0);
    const appliedRaw = Array.isArray(body.appliedChangedFields)
      ? body.appliedChangedFields
      : Array.isArray(body.applied_changed_fields)
        ? body.applied_changed_fields
        : [];
    const appliedChangedFields = appliedRaw
      .map((x) => (typeof x === 'string' ? x : ''))
      .filter((x) => x.trim().length > 0);
    return {
      partial: body.partial === true,
      draftHash: typeof body.draftHash === 'string' ? body.draftHash : null,
      remainingChangedFields,
      improvementId:
        typeof body.improvementId === 'string'
          ? body.improvementId
          : typeof body.improvement_id === 'string'
            ? (body.improvement_id as string)
            : null,
      appliedChangedFields,
      pendingSuggestionsCount:
        typeof body.pendingSuggestionsCount === 'number' &&
        Number.isFinite(body.pendingSuggestionsCount)
          ? body.pendingSuggestionsCount
          : undefined,
      cvRevisionId:
        body.cvRevisionId === null
          ? null
          : typeof body.cvRevisionId === 'string'
            ? body.cvRevisionId
            : undefined,
      idempotent: body.idempotent === true,
      alreadyApplied: body.alreadyApplied === true,
      duplicateSuppressed: body.duplicateSuppressed === true,
      ...parseTruthfulnessFields(body),
      ...parsePerformanceFields(body),
      ...parseMutationCommitMeta(body),
    };
  },
  rejectImprovement: async (
    pointer: string | number,
    cvProfileId?: string,
    options?: {
      /** Paths from apply preview (`changedFields[].fieldPath`). Omit, `[]`, or omit blank strings for reject-all / discard draft. */
      rejectedFields?: string[];
      draftHash?: string;
    },
  ): Promise<CvImprovementPartialMutationResult> => {
    const ref = encodeURIComponent(String(pointer));
    const rejectedFields = sanitizeCvImprovementFieldPaths(
      options?.rejectedFields,
    );
    const res = await axiosClient.post<unknown>(
      `/cv/improvements/${ref}/reject`,
      {
        ...(rejectedFields ? { rejectedFields } : {}),
        ...(options?.draftHash ? { draftHash: options.draftHash } : {}),
      },
      { params: cvProfileId ? { cvProfileId } : {} },
    );
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const remainingRaw = Array.isArray(body.remainingChangedFields)
      ? body.remainingChangedFields
      : Array.isArray(body.pendingChangedFields)
        ? body.pendingChangedFields
        : [];
    const remainingChangedFields = remainingRaw
      .map((x) => {
        if (typeof x === 'string') return x;
        if (
          x &&
          typeof x === 'object' &&
          typeof (x as Record<string, unknown>).fieldPath === 'string'
        ) {
          return (x as Record<string, unknown>).fieldPath as string;
        }
        if (
          x &&
          typeof x === 'object' &&
          typeof (x as Record<string, unknown>).field === 'string'
        ) {
          return (x as Record<string, unknown>).field as string;
        }
        return '';
      })
      .filter((x) => x.trim().length > 0);
    return {
      partial: body.partial === true,
      draftHash: typeof body.draftHash === 'string' ? body.draftHash : null,
      remainingChangedFields,
      improvementId:
        typeof body.improvementId === 'string'
          ? body.improvementId
          : typeof body.improvement_id === 'string'
            ? (body.improvement_id as string)
            : null,
      pendingSuggestionsCount:
        typeof body.pendingSuggestionsCount === 'number' &&
        Number.isFinite(body.pendingSuggestionsCount)
          ? body.pendingSuggestionsCount
          : undefined,
      cvRevisionId:
        body.cvRevisionId === null
          ? null
          : typeof body.cvRevisionId === 'string'
            ? body.cvRevisionId
            : undefined,
      idempotent: body.idempotent === true,
      alreadyApplied: body.alreadyApplied === true,
      duplicateSuppressed: body.duplicateSuppressed === true,
      ...parseTruthfulnessFields(body),
      ...parsePerformanceFields(body),
      ...parseMutationCommitMeta(body),
    };
  },

  createTailorDraft: async (payload: {
    cvProfileId: string;
    jobAnalysisId: string;
    selectedSkills: string[];
  }): Promise<TailorMutationResponse> => {
    const res = await axiosClient.post<unknown>('/cv/tailor-draft', payload);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeTailorMutationResponse(res.data);
  },
  acceptTailorSection: async (
    draftId: string,
    sectionId: string,
  ): Promise<TailorMutationResponse> => {
    const res = await axiosClient.post<unknown>(
      `/cv/tailor-draft/${encodeURIComponent(draftId)}/accept-section`,
      { sectionId },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeTailorMutationResponse(res.data);
  },
  rejectTailorSection: async (
    draftId: string,
    sectionId: string,
  ): Promise<TailorMutationResponse> => {
    const res = await axiosClient.post<unknown>(
      `/cv/tailor-draft/${encodeURIComponent(draftId)}/reject-section`,
      { sectionId },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeTailorMutationResponse(res.data);
  },
  acceptAllTailorSections: async (
    draftId: string,
  ): Promise<TailorMutationResponse> => {
    const res = await axiosClient.post<unknown>(
      `/cv/tailor-draft/${encodeURIComponent(draftId)}/accept-all`,
      {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeTailorMutationResponse(res.data);
  },

  listPatches: async (profileId: string): Promise<CvPatchRecord[]> => {
    const res = await axiosClient.get<unknown>('/cv/patches', {
      params: { profileId: profileId.trim() },
    });
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    const rows = Array.isArray(body)
      ? body
      : Array.isArray(body.patches)
        ? body.patches
        : [];
    return rows
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((row): CvPatchRecord => {
        const rawStatus = row.status;
        let status: CvPatchRecord['status'] = 'pending';
        if (
          rawStatus === 'accepted' ||
          rawStatus === 'rejected' ||
          rawStatus === 'pending'
        ) {
          status = rawStatus;
        }
        return {
          patchId: String(row.patchId ?? row.patch_id ?? ''),
          sectionId: String(row.sectionId ?? row.section_id ?? ''),
          sectionType: String(row.sectionType ?? row.section_type ?? ''),
          status,
          createdAt:
            typeof row.createdAt === 'string' ? row.createdAt : undefined,
        };
      })
      .filter((p) => p.patchId.trim().length > 0);
  },

  revertPatch: async (patchId: string): Promise<TailorMutationResponse> => {
    const res = await axiosClient.post<unknown>(
      `/cv/patches/${encodeURIComponent(patchId)}/revert`,
      {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeTailorMutationResponse(res.data);
  },

  rewriteBullet: async (payload: { bullet: string; context?: string }) => {
    const bullet = prepareCvSectionTextForAi(payload.bullet).trim().slice(0, 500);
    const context = payload.context?.trim().slice(0, 100);
    const res = await axiosClient.post<unknown>('/cv/improve/bullet', {
      bullet,
      context,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    const raw = body.suggestions ?? body.options ?? body.variants;
    if (Array.isArray(raw)) {
      return raw.filter(
        (x): x is string => typeof x === 'string' && x.trim() !== '',
      );
    }
    if (typeof body.improved === 'string') return [body.improved];
    if (typeof body.text === 'string') return [body.text];
    return [];
  },
  /** POST /cv/improve/summary — `summary` 20–2000 chars; `context` optional, max 100. */
  improveSummary: async (payload: { summary: string; context?: string }) => {
    const summary = prepareCvSectionTextForAi(payload.summary).trim();
    const context = payload.context?.trim().slice(0, 100);
    const res = await axiosClient.post<unknown>('/cv/improve/summary', {
      summary,
      context,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    const raw = body.suggestions ?? body.options ?? body.variants;
    if (Array.isArray(raw)) {
      const strings = raw.filter(
        (x): x is string => typeof x === 'string' && x.trim() !== '',
      );
      if (strings.length) return strings[0]!.trim();
    }
    const t = body.summary ?? body.text ?? body.improved;
    if (typeof t === 'string' && t.trim()) return t.trim();
    throw new Error('Invalid summary response');
  },
  getSections: async (includeHidden?: boolean, cvProfileId?: string) => {
    const id = cvProfileId?.trim();
    if (id) {
      try {
        const scoped = await axiosClient.get<unknown>(
          `/cv/profiles/${encodeURIComponent(id)}/sections`,
          {
            params: includeHidden ? { includeHidden: true } : undefined,
          },
        );
        throwIfApiFailureResponse(scoped.data, scoped.status);
        const scopedBody = unwrapApiDataEnvelope(scoped.data);
        const scopedArr = extractCvSectionRowList(scopedBody);
        return scopedArr.map(normalizeCVSection);
      } catch (e) {
        if (
          !axios.isAxiosError(e) ||
          (e.response?.status !== 404 && e.response?.status !== 405)
        )
          throw e;
      }
    }
    const res = await axiosClient.get<unknown>('/cv/sections', {
      params: {
        ...(includeHidden ? { includeHidden: true } : {}),
        ...(id ? { cvProfileId: id } : {}),
      },
    });
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data);
    const arr = extractCvSectionRowList(body);
    return arr.map(normalizeCVSection);
  },
  updateSection: async (
    sectionId: string,
    data: object,
    cvProfileId?: string,
  ) => {
    const id = cvProfileId?.trim();
    if (id) {
      try {
        const scoped = await axiosClient.patch<unknown>(
          `/cv/profiles/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`,
          data,
        );
        throwIfApiFailureResponse(scoped.data, scoped.status);
        return normalizeCVSection(scoped.data);
      } catch (e) {
        if (
          !axios.isAxiosError(e) ||
          (e.response?.status !== 404 && e.response?.status !== 405)
        )
          throw e;
      }
    }
    const res = await axiosClient.patch<unknown>(
      `/cv/sections/${sectionId}`,
      data,
      {
        params: id ? { cvProfileId: id } : {},
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCVSection(res.data);
  },
  /** POST /cv/profiles/:id/sections/batch-upsert — Phase 4 section autosave (single transaction). */
  batchUpsertProfileSections: async (
    cvProfileId: string,
    payload: { sections: CvBatchUpsertSectionInput[] },
  ): Promise<CvBatchUpsertSectionsResult> => {
    const id = cvProfileId.trim();
    const res = await axiosClient.post<unknown>(
      `/cv/profiles/${encodeURIComponent(id)}/sections/batch-upsert`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvBatchUpsertSectionsResult(res.data);
  },
  addSection: async (
    data: { type: string; order?: number; customTitle?: string },
    cvProfileId?: string,
  ) => {
    const id = cvProfileId?.trim();
    if (id) {
      try {
        const scoped = await axiosClient.post<unknown>(
          `/cv/profiles/${encodeURIComponent(id)}/sections`,
          data,
        );
        throwIfApiFailureResponse(scoped.data, scoped.status);
        return normalizeCVSection(scoped.data);
      } catch (e) {
        if (
          !axios.isAxiosError(e) ||
          (e.response?.status !== 404 && e.response?.status !== 405)
        )
          throw e;
      }
    }
    const res = await axiosClient.post<unknown>('/cv/sections', data, {
      params: id ? { cvProfileId: id } : {},
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCVSection(res.data);
  },
  removeSection: async (sectionId: string, cvProfileId?: string) => {
    const id = cvProfileId?.trim();
    if (id) {
      try {
        const scoped = await axiosClient.delete<unknown>(
          `/cv/profiles/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`,
        );
        if (
          scoped.data !== undefined &&
          scoped.data !== null &&
          scoped.data !== ''
        ) {
          throwIfApiFailureResponse(scoped.data, scoped.status);
        }
        return;
      } catch (e) {
        if (
          !axios.isAxiosError(e) ||
          (e.response?.status !== 404 && e.response?.status !== 405)
        )
          throw e;
      }
    }
    const res = await axiosClient.delete<unknown>(`/cv/sections/${sectionId}`, {
      params: id ? { cvProfileId: id } : {},
    });
    if (res.data !== undefined && res.data !== null && res.data !== '') {
      throwIfApiFailureResponse(res.data, res.status);
    }
  },
  /** POST …/sections/suggest-order — deterministic section order suggestion (does not save). */
  suggestSectionOrder: async (cvProfileId: string): Promise<import('@/lib/cvSectionOrderSuggest').CvSectionOrderSuggestResult> => {
    const id = cvProfileId.trim();
    if (!id) throw new Error('CV profile id is required');
    const { normalizeCvSectionOrderSuggestResult } = await import(
      '@/lib/cvSectionOrderSuggest'
    );
    try {
      const scoped = await axiosClient.post<unknown>(
        `/cv/profiles/${encodeURIComponent(id)}/sections/suggest-order`,
        {},
      );
      throwIfApiFailureResponse(scoped.data, scoped.status);
      const raw = unwrapApiDataEnvelope(scoped.data);
      return normalizeCvSectionOrderSuggestResult(raw);
    } catch (e) {
      if (
        !axios.isAxiosError(e) ||
        (e.response?.status !== 404 && e.response?.status !== 405)
      ) {
        throw e;
      }
    }
    const res = await axiosClient.post<unknown>(
      '/cv/sections/suggest-order',
      {},
      { params: { profileId: id } },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    return normalizeCvSectionOrderSuggestResult(raw);
  },
  reorderSections: async (
    sectionIds: string[],
    cvProfileId?: string,
  ): Promise<CvReorderSectionsResult> => {
    const id = cvProfileId?.trim();
    const ids = sectionIds.map((x) => x.trim()).filter((x) => x.length > 0);
    if (ids.length === 0) {
      throw new Error(
        'Section reorder had no valid row IDs. The server may have returned sections without a recognized id field — try refreshing the page.',
      );
    }
    /**
     * Nest `ReorderSectionsDto`: send **either** `sectionIds` **or** `sections`, never both with data.
     * Prefer `sectionIds` only — array order = top → bottom; server persists order 1…n.
     * Scoped route: `:cvProfileId` in path only; body `profileId` is ignored for targeting.
     * Legacy route: optional `profileId` in body to pick a non-default profile.
     */
    const scopedPayload = { sectionIds: ids };
    const legacyPayload = id
      ? { profileId: id, sectionIds: ids }
      : { sectionIds: ids };
    if (id) {
      try {
        const scoped = await axiosClient.patch<unknown>(
          `/cv/profiles/${encodeURIComponent(id)}/sections/reorder`,
          scopedPayload,
        );
        throwIfApiFailureResponse(scoped.data, scoped.status);
        return normalizeCvReorderSectionsResult(scoped.data);
      } catch (e) {
        if (
          !axios.isAxiosError(e) ||
          (e.response?.status !== 404 && e.response?.status !== 405)
        )
          throw e;
      }
    }
    const res = await axiosClient.patch<unknown>(
      '/cv/sections/reorder',
      legacyPayload,
      {
        params: id ? { cvProfileId: id } : {},
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCvReorderSectionsResult(res.data);
  },
  optimize: async (payload: { jobDescriptionHint: string }) =>
    (
      await axiosClient.post<{ optimizedText: string }>('/cv/optimize', {
        jobDescriptionHint: prepareJobDescriptionForAi(payload.jobDescriptionHint),
      })
    ).data,
  tailor: async (payload: { cvProfileId: string; jobDescription: string }) =>
    (
      await axiosClient.post<{ tailoredText: string }>('/cv/tailor', {
        cvProfileId: payload.cvProfileId,
        jobDescription: prepareJobDescriptionForAi(payload.jobDescription),
      })
    ).data,
};

export type CvExportRequestOpts = {
  template?: string;
  cvProfileId?: string;
  /** Ties export to a job analysis for tailored default filenames. */
  jobAnalysisId?: string;
};

export type CvExportDownload = {
  blob: Blob;
  /** From `X-Export-Filename` or Content-Disposition; server-generated. */
  filename: string;
};

function cvExportQueryParams(
  opts: CvExportRequestOpts,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (opts.template?.trim()) params.template = opts.template.trim();
  const jobId = opts.jobAnalysisId?.trim();
  if (jobId) params.jobAnalysisId = jobId;
  return params;
}

async function cvExportDownload(
  path: string,
  params: Record<string, string> | undefined,
  fallbackFilename: string,
): Promise<CvExportDownload> {
  const res = await axiosClient.get<Blob>(path, {
    params: Object.keys(params ?? {}).length ? params : undefined,
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    responseType: 'blob',
  });
  return {
    blob: res.data,
    filename: resolveExportFilename(res.headers, fallbackFilename),
  };
}

const cvExport = {
  /**
   * GET /cv/profiles/:id/export/pdf?jobAnalysisId=
   * Falls back to GET /cv/export/pdf?cvProfileId=… for older servers.
   */
  downloadPdf: async (opts: CvExportRequestOpts): Promise<CvExportDownload> => {
    const { cvProfileId } = opts;
    const id = cvProfileId?.trim();
    const params = cvExportQueryParams(opts);
    const fallback = 'CV.pdf';
    if (id) {
      try {
        const scoped = await cvExportDownload(
          `/cv/profiles/${encodeURIComponent(id)}/export/pdf`,
          params,
          fallback,
        );
        if (scoped.blob instanceof Blob) return scoped;
      } catch {
        /* 404 or pre-path API — use legacy */
      }
    }
    return cvExportDownload(
      '/cv/export/pdf',
      { ...params, ...(id ? { cvProfileId: id } : {}) },
      fallback,
    );
  },
  downloadDocx: async (
    opts: CvExportRequestOpts,
  ): Promise<CvExportDownload> => {
    const { cvProfileId } = opts;
    const id = cvProfileId?.trim();
    const params = cvExportQueryParams(opts);
    const fallback = 'CV.docx';
    if (id) {
      try {
        const scoped = await cvExportDownload(
          `/cv/profiles/${encodeURIComponent(id)}/export/docx`,
          params,
          fallback,
        );
        if (scoped.blob instanceof Blob) return scoped;
      } catch {
        /* fall through */
      }
    }
    return cvExportDownload(
      '/cv/export/docx',
      { ...params, ...(id ? { cvProfileId: id } : {}) },
      fallback,
    );
  },
};

export type SaveOnboardingProgressBody = {
  step: number;
  selectedFeatures?: string[];
  primaryGoal?: string;
  hasCV?: boolean;
  completed?: boolean;
  focusGetHired?: boolean;
  focusStudentLaunchpad?: boolean;
  jobSearchUrgency?: JobSearchUrgency;
  targetRoles?: string[] | string;
  referralSource?: string;
  referralOther?: string;
};

const onboarding = {
  /** Backend expects `step` on every call (400 if omitted). */
  saveProgress: async (data: SaveOnboardingProgressBody) => {
    const res = await axiosClient.post<unknown>('/onboarding', data);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeOnboardingStatus(res.data);
  },
  getStatus: async () => {
    const res = await axiosClient.get<unknown>('/onboarding/status');
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeOnboardingStatus(res.data);
  },
};

function normalizeJobHistoryItem(raw: unknown): JobHistoryItem {
  const o =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const id = typeof o.id === 'string' ? o.id : '';
  const jobTitle =
    (typeof o.jobTitle === 'string' && o.jobTitle.trim()) ||
    (typeof o.title === 'string' && o.title.trim()) ||
    '';
  const company = typeof o.company === 'string' ? o.company : '';
  const rawScore = o.matchScore ?? o.score ?? o.match_score;
  const n =
    typeof rawScore === 'number'
      ? rawScore
      : typeof rawScore === 'string'
        ? parseFloat(rawScore)
        : Number(rawScore);
  const matchScore = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const rec = o.recommendation;
  const recommendation =
    typeof rec === 'string'
      ? rec
      : rec != null && typeof rec === 'object'
        ? JSON.stringify(rec)
        : '';
  const createdAt =
    typeof o.createdAt === 'string'
      ? o.createdAt
      : typeof o.created_at === 'string'
        ? o.created_at
        : '';
  const scoreBeforeTailoring = parseOptionalNumberField(
    o.scoreBeforeTailoring ?? o.score_before_tailoring,
  );
  const tailoredCvProfileId =
    typeof o.tailoredCvProfileId === 'string'
      ? o.tailoredCvProfileId
      : typeof o.tailored_cv_profile_id === 'string'
        ? o.tailored_cv_profile_id
        : null;
  const tailoredCvName =
    typeof o.tailoredCvName === 'string'
      ? o.tailoredCvName
      : typeof o.tailored_cv_name === 'string'
        ? o.tailored_cv_name
        : null;
  const isTailored =
    typeof o.isTailored === 'boolean'
      ? o.isTailored
      : typeof o.is_tailored === 'boolean'
        ? o.is_tailored
        : false;
  const hasCoverLetter =
    typeof o.hasCoverLetter === 'boolean'
      ? o.hasCoverLetter
      : typeof o.has_cover_letter === 'boolean'
        ? o.has_cover_letter
        : false;
  const salaryEstimate = parseSalaryEstimateFromUnknown(
    o.salaryEstimate ?? o.salary_estimate,
  );
  const cvProfileIdRaw =
    o.cvProfileId ??
    o.cv_profile_id ??
    o.sourceCvProfileId ??
    o.source_cv_profile_id ??
    o.matchedCvProfileId ??
    o.matched_cv_profile_id;
  const cvProfileId =
    typeof cvProfileIdRaw === 'string' && cvProfileIdRaw.trim()
      ? cvProfileIdRaw.trim()
      : null;
  const sourceCvProfileIdRaw = o.sourceCvProfileId ?? o.source_cv_profile_id;
  const sourceCvProfileId =
    typeof sourceCvProfileIdRaw === 'string' && sourceCvProfileIdRaw.trim()
      ? sourceCvProfileIdRaw.trim()
      : cvProfileId;
  const analysisV2Hist = parseJobAnalysisV2(o.analysisV2 ?? o.analysis_v2);
  const jobListingIdHist =
    (typeof o.jobListingId === 'string' && o.jobListingId.trim()) ||
    (typeof o.job_listing_id === 'string' && o.job_listing_id.trim()) ||
    null;
  const jobListingSourceHashHist =
    (typeof o.jobListingSourceHash === 'string' &&
      o.jobListingSourceHash.trim()) ||
    (typeof o.job_listing_source_hash === 'string' &&
      o.job_listing_source_hash.trim()) ||
    null;
  const pipelineStatus = parseHubPipelineStage(o.status);
  const applicationAssist = parseApplicationAssist(
    o.applicationAssist ?? o.application_assist,
  );
  const applyUrlHist = pickApplyUrlFromRecord(o);
  const hasAnalysisRaw = o.hasAnalysis ?? o.has_analysis;
  const hasAnalysis =
    typeof hasAnalysisRaw === 'boolean'
      ? hasAnalysisRaw
      : typeof o.analyzeSource === 'string' && o.analyzeSource.trim()
        ? true
        : typeof o.analyze_source === 'string' && o.analyze_source.trim()
          ? true
          : undefined;
  const analyzeSource =
    typeof o.analyzeSource === 'string'
      ? o.analyzeSource
      : typeof o.analyze_source === 'string'
        ? o.analyze_source
        : null;
  const savedVia =
    typeof o.savedVia === 'string'
      ? o.savedVia
      : typeof o.saved_via === 'string'
        ? o.saved_via
        : null;
  return {
    id,
    jobTitle,
    company,
    matchScore,
    recommendation,
    createdAt,
    scoreBeforeTailoring,
    tailoredCvProfileId,
    tailoredCvName,
    isTailored,
    hasCoverLetter,
    ...(cvProfileId ? { cvProfileId } : {}),
    ...(sourceCvProfileId ? { sourceCvProfileId } : {}),
    ...(analysisV2Hist ? { analysisV2: analysisV2Hist } : {}),
    ...(jobListingIdHist ? { jobListingId: jobListingIdHist } : {}),
    ...(jobListingSourceHashHist
      ? { jobListingSourceHash: jobListingSourceHashHist }
      : {}),
    ...(applyUrlHist ? { applyUrl: applyUrlHist } : {}),
    ...(hasAnalysis !== undefined ? { hasAnalysis } : {}),
    ...(analyzeSource ? { analyzeSource } : {}),
    ...(savedVia ? { savedVia } : {}),
    ...(pipelineStatus ? { pipelineStatus } : {}),
    ...(typeof o.origin === 'string' ? { origin: o.origin } : {}),
    ...(typeof o.state === 'string' ? { state: o.state } : {}),
    ...(o.isApplied === true || o.is_applied === true
      ? { isApplied: true }
      : {}),
    ...(typeof o.lastActivityAt === 'string'
      ? { lastActivityAt: o.lastActivityAt }
      : typeof o.last_activity_at === 'string'
        ? { lastActivityAt: o.last_activity_at }
        : {}),
    ...(typeof o.nextRecommendedAction === 'string'
      ? { nextRecommendedAction: o.nextRecommendedAction }
      : typeof o.next_recommended_action === 'string'
        ? { nextRecommendedAction: o.next_recommended_action }
        : {}),
    ...(typeof o.reasonText === 'string'
      ? { reasonText: o.reasonText }
      : typeof o.reason_text === 'string'
        ? { reasonText: o.reason_text }
        : {}),
    ...(applicationAssist ? { applicationAssist } : {}),
    title: typeof o.title === 'string' ? o.title : undefined,
    description: typeof o.description === 'string' ? o.description : undefined,
    jobDescription:
      typeof o.jobDescription === 'string' ? o.jobDescription : undefined,
    salaryEstimate,
  };
}

function normalizeJobAnalysisSummary(raw: unknown): JobAnalysisSummary {
  const o = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const id = String(o.id ?? o.jobId ?? o.job_id ?? '').trim();
  const title =
    (typeof o.title === 'string' && o.title.trim()) ||
    (typeof o.jobTitle === 'string' && o.jobTitle.trim()) ||
    '';
  const company = typeof o.company === 'string' ? o.company : '';
  const rawScore = o.matchScore ?? o.score ?? o.match_score;
  const n =
    typeof rawScore === 'number'
      ? rawScore
      : typeof rawScore === 'string'
        ? parseFloat(rawScore)
        : Number(rawScore);
  const matchScore = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const isTailored =
    typeof o.isTailored === 'boolean'
      ? o.isTailored
      : typeof o.is_tailored === 'boolean'
        ? o.is_tailored
        : false;
  const createdAt =
    typeof o.createdAt === 'string'
      ? o.createdAt
      : typeof o.created_at === 'string'
        ? o.created_at
        : '';
  const updatedAt =
    typeof o.updatedAt === 'string'
      ? o.updatedAt
      : typeof o.updated_at === 'string'
        ? o.updated_at
        : createdAt;
  const cvProfileId =
    typeof o.cvProfileId === 'string'
      ? o.cvProfileId
      : typeof o.cv_profile_id === 'string'
        ? o.cv_profile_id
        : undefined;
  const rec = o.recommendation;
  const recommendation =
    typeof rec === 'string'
      ? rec
      : rec != null && typeof rec === 'object'
        ? JSON.stringify(rec)
        : undefined;
  const salaryEstimate = parseSalaryEstimateFromUnknown(
    o.salaryEstimate ?? o.salary_estimate,
  );
  const tailoredCvProfileId =
    typeof o.tailoredCvProfileId === 'string'
      ? o.tailoredCvProfileId.trim() || null
      : typeof o.tailored_cv_profile_id === 'string'
        ? o.tailored_cv_profile_id.trim() || null
        : null;
  const jobListingId =
    (typeof o.jobListingId === 'string' && o.jobListingId.trim()) ||
    (typeof o.job_listing_id === 'string' && o.job_listing_id.trim()) ||
    null;
  const jobListingSourceHash =
    (typeof o.jobListingSourceHash === 'string' &&
      o.jobListingSourceHash.trim()) ||
    (typeof o.job_listing_source_hash === 'string' &&
      o.job_listing_source_hash.trim()) ||
    null;
  const applyUrlSummary = pickApplyUrlFromRecord(o);
  return {
    id,
    title,
    company,
    matchScore,
    isTailored,
    salaryEstimate,
    createdAt,
    updatedAt,
    cvProfileId,
    ...(tailoredCvProfileId ? { tailoredCvProfileId } : {}),
    ...(jobListingId ? { jobListingId } : {}),
    ...(jobListingSourceHash ? { jobListingSourceHash } : {}),
    ...(applyUrlSummary ? { applyUrl: applyUrlSummary } : {}),
    recommendation,
  };
}

async function fetchJobHistoryPage(params?: {
  limit?: number;
  offset?: number;
  includeAccepted?: boolean;
}): Promise<JobHistoryPageResult> {
  const res = await axiosClient.get<unknown>('/jobs/history', {
    params: {
      ...(params?.limit != null ? { limit: params.limit } : {}),
      ...(params?.offset != null ? { offset: params.offset } : {}),
      ...(params?.includeAccepted === true ? { includeAccepted: true } : {}),
    },
  });
  throwIfApiFailureResponse(res.data, res.status);
  const normalized = unwrapApiDataEnvelope(res.data);
  const payload =
    normalized !== null &&
    typeof normalized === 'object' &&
    !Array.isArray(normalized)
      ? (normalized as Record<string, unknown>)
      : null;
  if (payload && Array.isArray(payload.items)) {
    const items = payload.items.map(normalizeJobHistoryItem);
    const total =
      typeof payload.total === 'number' && Number.isFinite(payload.total)
        ? payload.total
        : items.length;
    const limit =
      typeof payload.limit === 'number' && Number.isFinite(payload.limit)
        ? payload.limit
        : items.length;
    const offset =
      typeof payload.offset === 'number' && Number.isFinite(payload.offset)
        ? payload.offset
        : (params?.offset ?? 0);
    return { items, total, limit, offset };
  }
  const items = ensureArray<unknown>(normalized ?? res.data).map(
    normalizeJobHistoryItem,
  );
  return {
    items,
    total: items.length,
    limit: items.length,
    offset: params?.offset ?? 0,
  };
}

function strPrim(o: Record<string, unknown>, a: string, b?: string): string {
  const v = (b ? (o[a] ?? o[b]) : o[a]) as unknown;
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeJobArchiveListResponse(raw: unknown): JobArchiveListResponse {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const bm = Array.isArray(body.bookmarks)
    ? body.bookmarks
    : Array.isArray(body.Bookmarks)
      ? body.Bookmarks
      : [];
  const oa = Array.isArray(body.orphanJobAnalyses)
    ? body.orphanJobAnalyses
    : Array.isArray(body.orphan_job_analyses)
      ? body.orphan_job_analyses
      : [];
  const apps = Array.isArray(body.applications)
    ? body.applications
    : Array.isArray(body.Applications)
      ? body.Applications
      : [];

  const bookmarks: ArchivedBookmarkCard[] = bm
    .filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === 'object' && !Array.isArray(x),
    )
    .map((x) => ({
      kind: 'bookmark' as const,
      id: strPrim(x, 'id'),
      archivedAt: strPrim(x, 'archivedAt', 'archived_at'),
      restorePlacementHint:
        strPrim(x, 'restorePlacementHint', 'restore_placement_hint') ||
        'bookmarked',
      jobListingId: (() => {
        const s = strPrim(x, 'jobListingId', 'job_listing_id');
        return s || null;
      })(),
      jobAnalysisId: (() => {
        const s = strPrim(x, 'jobAnalysisId', 'job_analysis_id');
        return s || null;
      })(),
      applicationId: (() => {
        const s = strPrim(x, 'applicationId', 'application_id');
        return s || null;
      })(),
      hubPipelineStage:
        strPrim(x, 'hubPipelineStage', 'hub_pipeline_stage') || 'saved',
      title: strPrim(x, 'title') || '—',
      company: strPrim(x, 'company') || '—',
      descriptionSnippet:
        strPrim(x, 'descriptionSnippet', 'description_snippet') || undefined,
      url: typeof x.url === 'string' ? x.url : null,
    }))
    .filter((r) => Boolean(r.id));

  const orphanJobAnalyses: ArchivedJobAnalysisCard[] = oa
    .filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === 'object' && !Array.isArray(x),
    )
    .map((x) => {
      const sc = x.matchScore ?? x.match_score;
      const score =
        typeof sc === 'number' && Number.isFinite(sc)
          ? Math.round(sc)
          : typeof sc === 'string'
            ? parseInt(sc, 10)
            : null;
      return {
        kind: 'job_analysis' as const,
        id: strPrim(x, 'id'),
        archivedAt: strPrim(x, 'archivedAt', 'archived_at'),
        restorePlacementHint:
          strPrim(x, 'restorePlacementHint', 'restore_placement_hint') ||
          'analyzed',
        jobListingId: (() => {
          const s = strPrim(x, 'jobListingId', 'job_listing_id');
          return s || null;
        })(),
        title: strPrim(x, 'title') || '—',
        company: strPrim(x, 'company') || '—',
        status: strPrim(x, 'status') || 'saved',
        matchScore: score != null && Number.isFinite(score) ? score : null,
      };
    })
    .filter((r) => Boolean(r.id));

  const applications: ArchivedApplicationCard[] = apps
    .filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === 'object' && !Array.isArray(x),
    )
    .map((x) => {
      const sc = x.matchScore ?? x.match_score;
      const score =
        typeof sc === 'number' && Number.isFinite(sc)
          ? Math.round(sc)
          : typeof sc === 'string'
            ? parseInt(sc, 10)
            : null;
      return {
        kind: 'application' as const,
        id: strPrim(x, 'id'),
        archivedAt: strPrim(x, 'archivedAt', 'archived_at'),
        restorePlacementHint:
          strPrim(x, 'restorePlacementHint', 'restore_placement_hint') ||
          'application',
        jobAnalysisId: (() => {
          const s = strPrim(x, 'jobAnalysisId', 'job_analysis_id');
          return s || null;
        })(),
        title: strPrim(x, 'title') || '—',
        company: strPrim(x, 'company') || '—',
        status: strPrim(x, 'status') || 'applied',
        matchScore: score != null && Number.isFinite(score) ? score : null,
      };
    })
    .filter((r) => Boolean(r.id));
  return { bookmarks, orphanJobAnalyses, applications };
}

function normalizeJobArchiveMutationResult(
  raw: unknown,
): JobArchiveMutationResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const a =
    body.archived !== null &&
    typeof body.archived === 'object' &&
    !Array.isArray(body.archived)
      ? (body.archived as Record<string, unknown>)
      : {};
  const bid = Array.isArray(a.bookmarkIds)
    ? a.bookmarkIds
    : Array.isArray(a.bookmark_ids)
      ? a.bookmark_ids
      : [];
  const jid = Array.isArray(a.jobAnalysisIds)
    ? a.jobAnalysisIds
    : Array.isArray(a.job_analysis_ids)
      ? a.job_analysis_ids
      : [];
  const app = Array.isArray(a.applicationIds)
    ? a.applicationIds
    : Array.isArray(a.application_ids)
      ? a.application_ids
      : [];
  return {
    archived: {
      bookmarkIds: bid.map((x) => String(x).trim()).filter(Boolean),
      jobAnalysisIds: jid.map((x) => String(x).trim()).filter(Boolean),
      applicationIds: app.map((x) => String(x).trim()).filter(Boolean),
    },
    archivedAt:
      strPrim(body, 'archivedAt', 'archived_at') || new Date().toISOString(),
  };
}

function normalizeJobArchiveRestoreResult(
  raw: unknown,
): JobArchiveRestoreResult {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const r =
    body.restored !== null &&
    typeof body.restored === 'object' &&
    !Array.isArray(body.restored)
      ? (body.restored as Record<string, unknown>)
      : {};
  const bid = Array.isArray(r.bookmarkIds)
    ? r.bookmarkIds
    : Array.isArray(r.bookmark_ids)
      ? r.bookmark_ids
      : [];
  const jid = Array.isArray(r.jobAnalysisIds)
    ? r.jobAnalysisIds
    : Array.isArray(r.job_analysis_ids)
      ? r.job_analysis_ids
      : [];
  const app = Array.isArray(r.applicationIds)
    ? r.applicationIds
    : Array.isArray(r.application_ids)
      ? r.application_ids
      : [];
  return {
    restored: {
      bookmarkIds: bid.map((x) => String(x).trim()).filter(Boolean),
      jobAnalysisIds: jid.map((x) => String(x).trim()).filter(Boolean),
      applicationIds: app.map((x) => String(x).trim()).filter(Boolean),
    },
    restorePlacementHint:
      strPrim(body, 'restorePlacementHint', 'restore_placement_hint') ||
      'analyzed',
    message: strPrim(body, 'message') || 'Restored.',
  };
}

const jobs = {
  analyze: async (payload: {
    title?: string;
    company?: string;
    description: string;
    applicationQuestions?: string[];
    /** Scoped match — also sent in body when set (API accepts both patterns). */
    cvProfileId?: string;
    /** Internal discovery JobListing id — enables idempotent analyze + linkage. */
    jobListingId?: string;
    jobListingSourceHash?: string;
    /** Employer posting URL (validated server-side). */
    applyUrl?: string;
    /**
     * Persisted analyze (hub / analyzer / pipeline): omit or `true` = Gemini when quota/cache allow.
     * `false` = explicit opt-out: persist heuristic only (`analyzeSource: heuristic` server-side).
     */
    useAi?: boolean;
    /**
     * `false` = job board / card preview only — no pipeline row; response is heuristic-only;
     * `useAi` / `forceRefreshAnalyzeWithAi` are ignored (except DB reuse may still return saved AI rows).
     * Omit or `true` (default) = save to hub / normal flows.
     */
    persistAnalysis?: boolean;
    /**
     * Persisted flows only: bypass “reuse existing analysis” and force a new Gemini run
     * (e.g. Refresh analysis). Ignored when `persistAnalysis: false`.
     */
    forceRefreshAnalyzeWithAi?: boolean;
    /** Local market hint for AI salary fallback (not used when pay is in the posting). */
    candidateLocation?: string;
    candidateCountryCode?: string;
  }) => {
    const {
      cvProfileId,
      jobListingId,
      jobListingSourceHash,
      applyUrl,
      useAi,
      persistAnalysis,
      forceRefreshAnalyzeWithAi,
      ...body
    } = payload;
    const applyUrlTrimmed = pickApplyUrlFromRecord(
      applyUrl != null ? { applyUrl } : null,
    );
    const res = await axiosClient.post<unknown>(
      '/jobs/analyze',
      {
        ...aiWaitForResultBody,
        ...body,
        description: prepareJobDescriptionForAi(body.description),
        ...(Array.isArray(body.applicationQuestions)
          ? {
              applicationQuestions: body.applicationQuestions.map((q) =>
                typeof q === 'string' ? prepareCvSectionTextForAi(q) : q,
              ),
            }
          : {}),
        ...(useAi === true ? { useAi: true } : {}),
        ...(useAi === false ? { useAi: false } : {}),
        ...(persistAnalysis === false ? { persistAnalysis: false } : {}),
        ...(forceRefreshAnalyzeWithAi === true
          ? { forceRefreshAnalyzeWithAi: true }
          : {}),
        ...(cvProfileId?.trim() ? { cvProfileId: cvProfileId.trim() } : {}),
        ...(jobListingId?.trim() ? { jobListingId: jobListingId.trim() } : {}),
        ...(jobListingSourceHash?.trim()
          ? { jobListingSourceHash: jobListingSourceHash.trim() }
          : {}),
        ...(applyUrlTrimmed ? { applyUrl: applyUrlTrimmed } : {}),
      },
      {
        params: cvProfileId?.trim() ? { cvProfileId: cvProfileId.trim() } : {},
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const resolved = await resolveMaybeQueuedAiResponse(res.data);
    return normalizeJobAnalysis(resolved);
  },
  /**
   * POST /jobs/match-score — heuristic fit 0–100, no Gemini, no AI quota, no JobAnalysis row.
   * Use when daily analyze limit is reached or only a card estimate is needed.
   */
  matchScore: async (payload: {
    description: string;
    title?: string;
    company?: string;
    cvProfileId?: string;
  }): Promise<number> => {
    const res = await axiosClient.post<unknown>('/jobs/match-score', {
      description: prepareJobDescriptionForAi(payload.description),
      ...(payload.title?.trim() ? { title: payload.title.trim() } : {}),
      ...(payload.company?.trim() ? { company: payload.company.trim() } : {}),
      ...(payload.cvProfileId?.trim()
        ? { cvProfileId: payload.cvProfileId.trim() }
        : {}),
    });
    throwIfApiFailureResponse(res.data, res.status);
    const data = unwrapApiDataEnvelope(res.data);
    const raw =
      (data as Record<string, unknown>).matchScore ??
      (data as Record<string, unknown>).score;
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? parseInt(raw, 10)
          : Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  },
  /**
   * POST /jobs/generate — optional `jobAnalysisId` persists cover + answers on that analysis
   * so GET /jobs/generated/:jobAnalysisId returns them. Omit for legacy hash-based behavior.
   */
  generate: async (payload: {
    title?: string;
    company?: string;
    description: string;
    questions?: string[];
    jobAnalysisId?: string;
  }) => {
    const res = await axiosClient.post<unknown>('/jobs/generate', {
      ...aiWaitForResultBody,
      ...payload,
      description: prepareJobDescriptionForAi(payload.description),
      ...(Array.isArray(payload.questions)
        ? {
            questions: payload.questions.map((q) =>
              typeof q === 'string' ? prepareCvSectionTextForAi(q) : q,
            ),
          }
        : {}),
    });
    throwIfApiFailureResponse(res.data, res.status);
    const resolved = await resolveMaybeQueuedAiResponse(res.data);
    const body = unwrapApiDataEnvelope(resolved);
    return body as GeneratedContent;
  },
  /** Same as GET /jobs/history — returns items only (backward compatible with dashboards). */
  getHistory: async (params?: {
    limit?: number;
    offset?: number;
    includeAccepted?: boolean;
  }) => {
    const page = await fetchJobHistoryPage(params);
    return page.items;
  },
  /** Full pagination envelope from GET /jobs/history (total count for analyses list). */
  getHistoryPaginated: async (params?: {
    limit?: number;
    offset?: number;
    includeAccepted?: boolean;
  }): Promise<JobHistoryPageResult> => {
    return fetchJobHistoryPage(params);
  },
  listAnalyses: async (params?: {
    jobListingId?: string;
  }): Promise<JobAnalysisSummary[]> => {
    const res = await axiosClient.get<unknown>('/jobs/analyses', {
      params:
        params?.jobListingId?.trim() != null &&
        params.jobListingId.trim() !== ''
          ? { jobListingId: params.jobListingId.trim() }
          : undefined,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const arr = Array.isArray(raw) ? raw : ensureArray<unknown>(raw);
    return arr.map((row) => normalizeJobAnalysisSummary(row));
  },
  /** Full job row: title, company, description, match score, skills, optional tailor draft, etc. */
  getJob: async (jobId: string): Promise<JobDetailForForm> => {
    const res = await axiosClient.get<unknown>(`/jobs/${jobId}`);
    throwIfApiFailureResponse(res.data, res.status);
    const detail = normalizeJobDetailForForm(res.data, jobId);
    return mergeJobDetailWithTailorDraft(detail, res.data);
  },
  /**
   * Saved cover letter + application answers only (separate resource).
   * Backend may return 200 with null/empty body when nothing was generated yet.
   */
  getGenerated: async (jobId: string): Promise<GeneratedContent> => {
    const res = await axiosClient.get<unknown>(`/jobs/generated/${jobId}`);
    const raw = res.data;
    if (raw === null || raw === undefined) {
      return { jobId };
    }
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (o.success === true && o.data === null) {
        return { jobId };
      }
    }
    throwIfApiFailureResponse(raw, res.status);
    const body = unwrapApiDataEnvelope(raw);
    const partial = body as Partial<GeneratedContent>;
    const coverLetter =
      typeof partial.coverLetter === 'string' &&
      partial.coverLetter.trim() !== ''
        ? partial.coverLetter
        : undefined;
    const answers = Array.isArray(partial.answers)
      ? partial.answers
      : undefined;
    return {
      jobId: typeof partial.jobId === 'string' ? partial.jobId : jobId,
      coverLetter,
      answers,
    };
  },
  /** Persist edited cover letter text for a saved job analysis. */
  saveGeneratedCoverLetter: async (
    jobId: string,
    coverLetter: string,
    answers?: Record<string, unknown>,
  ): Promise<void> => {
    const id = jobId.trim();
    const text = coverLetter.trim();
    if (!id || !text) return;
    const res = await axiosClient.patch<unknown>(
      `/jobs/generated/${encodeURIComponent(id)}`,
      {
        coverLetter: text,
        ...(answers ? { answers } : {}),
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
  /** PATCH /jobs/:jobAnalysisId/pipeline — canonical Job Hub stage moves. */
  patchPipeline: async (
    jobAnalysisId: string,
    payload: { stage: HubPipelineStage },
  ): Promise<void> => {
    const res = await axiosClient.patch<unknown>(
      `/jobs/${encodeURIComponent(jobAnalysisId)}/pipeline`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
  /**
   * Optional: same contract as `applications.generateEmailTemplate` when there is no application row.
   * POST /jobs/:jobId/email-templates/generate
   */
  generateEmailTemplate: async (
    jobId: string,
    payload: { templateType: string; extraContext?: string },
  ): Promise<FollowUpEmailDraft> => {
    const res = await axiosClient.post<unknown>(
      `/jobs/${encodeURIComponent(jobId)}/email-templates/generate`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return {
      subject: typeof body.subject === 'string' ? body.subject : '',
      body:
        typeof body.body === 'string'
          ? body.body
          : typeof body.emailBody === 'string'
            ? body.emailBody
            : typeof body.message === 'string'
              ? body.message
              : '',
    };
  },
  /** GET /jobs/:jobId/notes — jobId is JobAnalysis id; newest first. */
  listNotes: async (jobId: string): Promise<HubNoteEntry[]> => {
    const res = await axiosClient.get<unknown>(
      `/jobs/${encodeURIComponent(jobId)}/notes`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const arr = extractHubNotesArrayFromResponse(res.data);
    return sortHubNotesNewestFirst(
      arr
        .filter(
          (x): x is Record<string, unknown> =>
            x !== null && typeof x === 'object' && !Array.isArray(x),
        )
        .map((x) => normalizeHubNoteEntry(x)),
    );
  },
  createNote: async (jobId: string, body: string): Promise<HubNoteEntry> => {
    const res = await axiosClient.post<unknown>(
      `/jobs/${encodeURIComponent(jobId)}/notes`,
      { body },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubNoteEntry(o);
  },
  updateNote: async (
    jobId: string,
    noteId: string,
    body: string,
  ): Promise<HubNoteEntry> => {
    const res = await axiosClient.patch<unknown>(
      `/jobs/${encodeURIComponent(jobId)}/notes/${encodeURIComponent(noteId)}`,
      { body },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubNoteEntry(o);
  },
  deleteNote: async (jobId: string, noteId: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/jobs/${encodeURIComponent(jobId)}/notes/${encodeURIComponent(noteId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
  /** PATCH /jobs/:jobId/status — Job Hub pipeline for saved analysis rows (no application). */
  updateAnalysisStatus: async (
    jobId: string,
    payload: { status: HubPipelineStage },
  ): Promise<void> => {
    const res = await axiosClient.patch<unknown>(
      `/jobs/${encodeURIComponent(jobId)}/status`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
  /** Phase 5 — user confirms offer accepted (job analysis id). */
  markAccepted: async (jobAnalysisId: string) => {
    const res = await axiosClient.post<unknown>(
      `/jobs/${encodeURIComponent(jobAnalysisId)}/mark-accepted`,
      {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    return parseMarkAcceptedResult(res.data);
  },
  /** GET /jobs/hub-reminders — CRM follow-ups (synced across devices). */
  listHubReminders: async (params?: {
    status?: HubReminderStatus;
    dueBefore?: string;
    jobBookmarkId?: string;
    jobAnalysisId?: string;
  }): Promise<HubReminderItem[]> => {
    const res = await axiosClient.get<unknown>('/jobs/hub-reminders', {
      params,
    });
    throwIfApiFailureResponse(res.data, res.status);
    const arr = extractHubNotesArrayFromResponse(res.data);
    return arr
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((x) => normalizeHubReminderItem(x));
  },
  createHubReminder: async (payload: {
    jobBookmarkId?: string;
    jobAnalysisId?: string;
    remindAt: string;
    title?: string;
    note?: string;
  }): Promise<HubReminderItem> => {
    const res = await axiosClient.post<unknown>('/jobs/hub-reminders', payload);
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubReminderItem(o);
  },
  patchHubReminder: async (
    reminderId: string,
    payload: {
      remindAt?: string;
      title?: string;
      note?: string;
      status?: HubReminderStatus;
    },
  ): Promise<HubReminderItem> => {
    const res = await axiosClient.patch<unknown>(
      `/jobs/hub-reminders/${encodeURIComponent(reminderId)}`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubReminderItem(o);
  },
  deleteHubReminder: async (reminderId: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/jobs/hub-reminders/${encodeURIComponent(reminderId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },

  archive: async (payload: {
    bookmarkId?: string;
    jobAnalysisId?: string;
    applicationId?: string;
  }): Promise<JobArchiveMutationResult> => {
    const res = await axiosClient.post<unknown>('/jobs/archive', payload);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeJobArchiveMutationResult(res.data);
  },

  restoreArchive: async (payload: {
    bookmarkId?: string;
    jobAnalysisId?: string;
    applicationId?: string;
  }): Promise<JobArchiveRestoreResult> => {
    const res = await axiosClient.post<unknown>(
      '/jobs/archive/restore',
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeJobArchiveRestoreResult(res.data);
  },

  listArchive: async (): Promise<JobArchiveListResponse> => {
    const res = await axiosClient.get<unknown>('/jobs/archive');
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeJobArchiveListResponse(res.data);
  },

  deleteArchivedBookmark: async (bookmarkId: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/jobs/archive/bookmark/${encodeURIComponent(bookmarkId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },

  deleteArchivedAnalysis: async (jobAnalysisId: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/jobs/archive/analysis/${encodeURIComponent(jobAnalysisId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },

  deleteArchivedApplication: async (applicationId: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/jobs/archive/application/${encodeURIComponent(applicationId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
};

/**
 * POST /job-discovery/:jobListingId/bookmark — axios `response.data` is the API envelope:
 * use `body.success` / HTTP status, not `body.data.success`. `body.data` is the bookmark row.
 */
function parseJobDiscoveryBookmarkCreateResponse(
  body: unknown,
  httpStatus: number,
  routeJobListingId: string,
): JobDiscoveryBookmarkResult {
  throwIfApiFailureResponse(body, httpStatus);
  const row = unwrapApiDataEnvelope(body) as Record<string, unknown>;
  const bookmarkId = String(row.id ?? row.bookmarkId ?? '').trim();
  const jobListingId = String(
    row.jobListingId ??
      row.job_listing_id ??
      row.jobListing_id ??
      routeJobListingId,
  ).trim();
  return {
    bookmarkId,
    jobListingId: jobListingId || routeJobListingId,
  };
}

const location = {
  resolve: async (): Promise<ResolvedGeoLocationDto> => {
    const res = await axiosClient.get<unknown>('/location/resolve');
    throwIfApiFailureResponse(res.data, res.status);
    const o = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const confRaw = String(o.confidence ?? 'low').toLowerCase();
    const confidence: ResolvedGeoLocationDto['confidence'] =
      confRaw === 'high' || confRaw === 'medium' ? confRaw : 'low';
    return {
      country: typeof o.country === 'string' ? o.country : null,
      countryCode: typeof o.countryCode === 'string' ? o.countryCode : null,
      city: typeof o.city === 'string' ? o.city : null,
      region: typeof o.region === 'string' ? o.region : null,
      timezone: typeof o.timezone === 'string' ? o.timezone : null,
      confidence,
    };
  },
};

const jobDiscovery = {
  discover: async (params: {
    q?: string;
    workMode?: string;
    employmentType?: string;
    location?: string;
    datePosted?: string;
    page?: number;
    pageSize?: number;
    cvProfileId?: string;
    remoteFirst?: boolean;
  }) => {
    const res = await axiosClient.get<unknown>('/job-discovery', { params });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeDiscoverJobsResponse(res.data);
  },
  getDetail: async (id: string) => {
    const res = await axiosClient.get<unknown>(
      `/job-discovery/${encodeURIComponent(id)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeJobListingDto(res.data);
  },
  bookmark: async (
    jobListingId: string,
  ): Promise<JobDiscoveryBookmarkResult> => {
    const res = await axiosClient.post<unknown>(
      `/job-discovery/${encodeURIComponent(jobListingId)}/bookmark`,
    );
    const body = res.data;
    return parseJobDiscoveryBookmarkCreateResponse(
      body,
      res.status,
      jobListingId,
    );
  },
  removeBookmark: async (jobListingId: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/job-discovery/${encodeURIComponent(jobListingId)}/bookmark`,
    );
    const body = res.data;
    throwIfApiFailureResponse(body, res.status);
  },
  markSeen: async (): Promise<void> => {
    const res = await axiosClient.post<unknown>('/job-discovery/mark-seen', {});
    throwIfApiFailureResponse(res.data, res.status);
  },
  focusResolve: async (
    focusToken: string,
  ): Promise<{
    jobListingId: string;
    indexHint: number | null;
    filtersContext: Record<string, unknown> | null;
    expiresAt: string | null;
  }> => {
    const res = await axiosClient.post<unknown>(
      '/job-discovery/focus-resolve',
      { focusToken },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return {
      jobListingId: String(o.jobListingId ?? o.job_listing_id ?? '').trim(),
      indexHint:
        typeof o.indexHint === 'number' && Number.isFinite(o.indexHint)
          ? o.indexHint
          : typeof o.index_hint === 'number' && Number.isFinite(o.index_hint)
            ? Number(o.index_hint)
            : null,
      filtersContext:
        o.filtersContext !== null &&
        typeof o.filtersContext === 'object' &&
        !Array.isArray(o.filtersContext)
          ? (o.filtersContext as Record<string, unknown>)
          : o.filters_context !== null &&
              typeof o.filters_context === 'object' &&
              !Array.isArray(o.filters_context)
            ? (o.filters_context as Record<string, unknown>)
            : null,
      expiresAt:
        typeof o.expiresAt === 'string'
          ? o.expiresAt
          : typeof o.expires_at === 'string'
            ? String(o.expires_at)
            : null,
    };
  },
  analyzeStart: async (
    jobListingId: string,
  ): Promise<JobDiscoveryQuickActionResult> => {
    const res = await axiosClient.post<unknown>(
      `/job-discovery/${encodeURIComponent(jobListingId)}/analyze-start`,
      {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const next =
      o.nextAction !== null &&
      typeof o.nextAction === 'object' &&
      !Array.isArray(o.nextAction)
        ? (o.nextAction as Record<string, unknown>)
        : null;
    return {
      ok: o.ok === true,
      nextAction: next
        ? {
            type: String(next.type ?? ''),
            route: String(next.route ?? ''),
            contextToken:
              typeof next.contextToken === 'string'
                ? next.contextToken
                : typeof next.context_token === 'string'
                  ? String(next.context_token)
                  : null,
          }
        : null,
      stateSnapshot:
        o.stateSnapshot !== null &&
        typeof o.stateSnapshot === 'object' &&
        !Array.isArray(o.stateSnapshot)
          ? (o.stateSnapshot as Record<string, unknown>)
          : o.state_snapshot !== null &&
              typeof o.state_snapshot === 'object' &&
              !Array.isArray(o.state_snapshot)
            ? (o.state_snapshot as Record<string, unknown>)
            : null,
    };
  },
  recordDecision: async (
    jobListingId: string,
    decision: 'APPLY' | 'MAYBE' | 'SKIP',
  ): Promise<{ id: string; decision: string }> => {
    const res = await axiosClient.post<unknown>(
      `/job-discovery/${encodeURIComponent(jobListingId)}/decision`,
      {
        decision,
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const o = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return {
      id: String(o.id ?? ''),
      decision: String(o.decision ?? decision),
    };
  },
  tailorStart: async (
    jobListingId: string,
  ): Promise<JobDiscoveryQuickActionResult> => {
    const res = await axiosClient.post<unknown>(
      `/job-discovery/${encodeURIComponent(jobListingId)}/tailor-start`,
      {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const next =
      o.nextAction !== null &&
      typeof o.nextAction === 'object' &&
      !Array.isArray(o.nextAction)
        ? (o.nextAction as Record<string, unknown>)
        : null;
    return {
      ok: o.ok === true,
      nextAction: next
        ? {
            type: String(next.type ?? ''),
            route: String(next.route ?? ''),
            contextToken:
              typeof next.contextToken === 'string'
                ? next.contextToken
                : typeof next.context_token === 'string'
                  ? String(next.context_token)
                  : null,
          }
        : null,
      stateSnapshot:
        o.stateSnapshot !== null &&
        typeof o.stateSnapshot === 'object' &&
        !Array.isArray(o.stateSnapshot)
          ? (o.stateSnapshot as Record<string, unknown>)
          : o.state_snapshot !== null &&
              typeof o.state_snapshot === 'object' &&
              !Array.isArray(o.state_snapshot)
            ? (o.state_snapshot as Record<string, unknown>)
            : null,
    };
  },
  /** GET /job-discovery/bookmarks — hub bookmark rows (alias: GET /users/me/hub-bookmarks on some stacks). */
  listBookmarks: async (): Promise<HubBookmarkItem[]> => {
    const res = await axiosClient.get<unknown>('/job-discovery/bookmarks');
    throwIfApiFailureResponse(res.data, res.status);
    const arr = extractHubNotesArrayFromResponse(res.data);
    return arr
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((x) => normalizeHubBookmarkItem(x));
  },
  /**
   * PATCH /job-discovery/bookmarks/:bookmarkId — link bookmark to analysis / application (no auto-create).
   * Omit keys to leave unchanged; pass null to clear jobAnalysisId or applicationId.
   */
  patchBookmark: async (
    bookmarkId: string,
    payload: {
      jobAnalysisId?: string | null;
      applicationId?: string | null;
      hubPipelineStage?: HubPipelineStage;
    },
  ): Promise<HubBookmarkItem> => {
    const res = await axiosClient.patch<unknown>(
      `/job-discovery/bookmarks/${encodeURIComponent(bookmarkId)}`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubBookmarkItem(o);
  },
  listBookmarkNotes: async (bookmarkId: string): Promise<HubNoteEntry[]> => {
    const res = await axiosClient.get<unknown>(
      `/job-discovery/bookmarks/${encodeURIComponent(bookmarkId)}/notes`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const arr = extractHubNotesArrayFromResponse(res.data);
    return sortHubNotesNewestFirst(
      arr
        .filter(
          (x): x is Record<string, unknown> =>
            x !== null && typeof x === 'object' && !Array.isArray(x),
        )
        .map((x) => normalizeHubNoteEntry(x)),
    );
  },
  createBookmarkNote: async (
    bookmarkId: string,
    body: string,
  ): Promise<HubNoteEntry> => {
    const res = await axiosClient.post<unknown>(
      `/job-discovery/bookmarks/${encodeURIComponent(bookmarkId)}/notes`,
      { body },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubNoteEntry(o);
  },
  updateBookmarkNote: async (
    bookmarkId: string,
    noteId: string,
    body: string,
  ): Promise<HubNoteEntry> => {
    const res = await axiosClient.patch<unknown>(
      `/job-discovery/bookmarks/${encodeURIComponent(bookmarkId)}/notes/${encodeURIComponent(noteId)}`,
      { body },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubNoteEntry(o);
  },
  deleteBookmarkNote: async (
    bookmarkId: string,
    noteId: string,
  ): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/job-discovery/bookmarks/${encodeURIComponent(bookmarkId)}/notes/${encodeURIComponent(noteId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
};

function coerceApplicationReminderStatus(
  x: unknown,
): ApplicationReminderStatus {
  const s = typeof x === 'string' ? x : '';
  if (
    s === 'pending' ||
    s === 'processing' ||
    s === 'sent' ||
    s === 'cancelled' ||
    s === 'failed'
  ) {
    return s;
  }
  return 'pending';
}

function normalizeApplicationReminderItem(
  raw: Record<string, unknown>,
): ApplicationReminderItem {
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    applicationId:
      typeof raw.applicationId === 'string' ? raw.applicationId : '',
    remindAt: typeof raw.remindAt === 'string' ? raw.remindAt : '',
    message: typeof raw.message === 'string' ? raw.message : '',
    status: coerceApplicationReminderStatus(raw.status),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    sentAt: typeof raw.sentAt === 'string' ? raw.sentAt : null,
    failedAt: typeof raw.failedAt === 'string' ? raw.failedAt : null,
    failureReason:
      typeof raw.failureReason === 'string' ? raw.failureReason : null,
  };
}

function normalizeUserReminderItem(
  raw: Record<string, unknown>,
): UserReminderItem {
  const base = normalizeApplicationReminderItem(raw);
  return {
    ...base,
    jobTitle: typeof raw.jobTitle === 'string' ? raw.jobTitle : null,
    jobCompany: typeof raw.jobCompany === 'string' ? raw.jobCompany : null,
  };
}

const applications = {
  create: async (payload: {
    title: string;
    company: string;
    url?: string;
    matchScore?: number;
    status?: ApplicationTrackerStatus | ApplicationStatus | string;
    notes?: string;
    /** Links the tracker row to JobAnalysis — required for dashboard proactive interview prep. */
    jobAnalysisId?: string;
  }) => {
    const res = await axiosClient.post<unknown>('/applications', payload);
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeApplicationItem(res.data);
  },
  getAll: async () => {
    const res = await axiosClient.get<unknown>('/applications');
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    return ensureArray<unknown>(raw).map(normalizeApplicationItem);
  },
  updateStatus: async (
    id: string,
    status: ApplicationTrackerStatus | ApplicationStatus | string,
  ) => {
    const res = await axiosClient.patch<unknown>(`/applications/${id}/status`, {
      status,
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeApplicationItem(res.data);
  },
  getFollowUpDraft: async (id: string): Promise<FollowUpEmailDraft> => {
    const res = await axiosClient.post<unknown>(
      `/applications/${id}/follow-up-draft`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return {
      subject: typeof body.subject === 'string' ? body.subject : '',
      body:
        typeof body.body === 'string'
          ? body.body
          : typeof body.emailBody === 'string'
            ? body.emailBody
            : typeof body.message === 'string'
              ? body.message
              : '',
    };
  },
  updateNotes: async (id: string, notes: string) => {
    const res = await axiosClient.patch<unknown>(`/applications/${id}/notes`, {
      notes,
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeApplicationItem(res.data);
  },
  listNotes: async (applicationId: string): Promise<HubNoteEntry[]> => {
    const res = await axiosClient.get<unknown>(
      `/applications/${encodeURIComponent(applicationId)}/notes`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const arr = extractHubNotesArrayFromResponse(res.data);
    return sortHubNotesNewestFirst(
      arr
        .filter(
          (x): x is Record<string, unknown> =>
            x !== null && typeof x === 'object' && !Array.isArray(x),
        )
        .map((x) => normalizeHubNoteEntry(x)),
    );
  },
  createNote: async (
    applicationId: string,
    body: string,
  ): Promise<HubNoteEntry> => {
    const res = await axiosClient.post<unknown>(
      `/applications/${encodeURIComponent(applicationId)}/notes`,
      {
        body,
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubNoteEntry(o);
  },
  updateNote: async (
    applicationId: string,
    noteId: string,
    body: string,
  ): Promise<HubNoteEntry> => {
    const res = await axiosClient.patch<unknown>(
      `/applications/${encodeURIComponent(applicationId)}/notes/${encodeURIComponent(noteId)}`,
      { body },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const o =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return normalizeHubNoteEntry(o);
  },
  deleteNote: async (applicationId: string, noteId: string): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/applications/${encodeURIComponent(applicationId)}/notes/${encodeURIComponent(noteId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
  /**
   * Tailored outreach / template drafts for a tracked application.
   * POST /applications/:id/email-templates/generate
   */
  generateEmailTemplate: async (
    id: string,
    payload: {
      templateType: string;
      jobAnalysisId?: string | null;
      extraContext?: string;
    },
  ): Promise<FollowUpEmailDraft> => {
    const res = await axiosClient.post<unknown>(
      `/applications/${encodeURIComponent(id)}/email-templates/generate`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return {
      subject: typeof body.subject === 'string' ? body.subject : '',
      body:
        typeof body.body === 'string'
          ? body.body
          : typeof body.emailBody === 'string'
            ? body.emailBody
            : typeof body.message === 'string'
              ? body.message
              : '',
    };
  },
  /**
   * Schedule a reminder (email + in-app notification at remindAt).
   * POST /applications/:id/reminders
   */
  createReminder: async (
    id: string,
    payload: { remindAt: string; message: string },
  ) => {
    const res = await axiosClient.post<unknown>(
      `/applications/${encodeURIComponent(id)}/reminders`,
      payload,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return { id: typeof raw.id === 'string' ? raw.id : undefined };
  },
  /** GET /applications/:applicationId/reminders — ascending remindAt. */
  listReminders: async (
    applicationId: string,
  ): Promise<ApplicationReminderItem[]> => {
    const res = await axiosClient.get<unknown>(
      `/applications/${encodeURIComponent(applicationId)}/reminders`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    const arr = Array.isArray(raw)
      ? raw
      : raw !== null &&
          typeof raw === 'object' &&
          Array.isArray((raw as Record<string, unknown>).reminders)
        ? ((raw as Record<string, unknown>).reminders as unknown[])
        : [];
    return arr
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((x) => normalizeApplicationReminderItem(x));
  },
  /** DELETE /applications/:applicationId/reminders/:reminderId — idempotent on backend. */
  deleteReminder: async (
    applicationId: string,
    reminderId: string,
  ): Promise<void> => {
    const res = await axiosClient.delete<unknown>(
      `/applications/${encodeURIComponent(applicationId)}/reminders/${encodeURIComponent(reminderId)}`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
};

const notifications = {
  list: async (): Promise<NotificationItem[]> => {
    const res = await axiosClient.get<unknown>('/notifications');
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data);
    if (Array.isArray(raw)) {
      return raw.map((x) => normalizeNotificationItem(x));
    }
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as Record<string, unknown>).notifications)
    ) {
      return ((raw as Record<string, unknown>).notifications as unknown[]).map(
        (x) => normalizeNotificationItem(x),
      );
    }
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as Record<string, unknown>).rows)
    ) {
      return ((raw as Record<string, unknown>).rows as unknown[]).map((x) =>
        normalizeNotificationItem(x),
      );
    }
    return [];
  },
  getUnreadCount: async (): Promise<number> => {
    const res = await axiosClient.get<unknown>('/notifications/unread-count');
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const n = body.count ?? body.unreadCount ?? body.unread_count;
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  },
  markRead: async (id: string) => {
    const res = await axiosClient.patch<unknown>(
      `/notifications/${encodeURIComponent(id)}/read`,
    );
    throwIfApiFailureResponse(res.data, res.status);
  },
  markAllRead: async () => {
    const res = await axiosClient.patch<unknown>('/notifications/read-all');
    throwIfApiFailureResponse(res.data, res.status);
  },
};

/** GET/PUT /career-goals — structured job-search preferences (Phase 19A). */
export type CareerGoalsRemotePreference =
  | 'remote'
  | 'hybrid'
  | 'onsite'
  | 'any';

export type CareerGoalsWorkspace = {
  targetRoles: string[];
  targetCompanies: string[];
  targetLocations: string[];
  targetIndustries: string[];
  targetSkills: string[];
  employmentTypes: string[];
  salaryMin?: number | null;
  salaryCurrency?: string | null;
  remotePreference?: CareerGoalsRemotePreference | null;
  updatedAt?: string | null;
};

function strArrayFromCareerGoalsBody(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
}

function normalizeCareerGoalsWorkspace(
  body: Record<string, unknown>,
): CareerGoalsWorkspace {
  const remoteRaw = String(
    body.remotePreference ?? body.remote_preference ?? '',
  )
    .trim()
    .toLowerCase();
  const allowed = new Set<CareerGoalsRemotePreference>([
    'remote',
    'hybrid',
    'onsite',
    'any',
  ]);
  const remote: CareerGoalsRemotePreference | null = allowed.has(
    remoteRaw as CareerGoalsRemotePreference,
  )
    ? (remoteRaw as CareerGoalsRemotePreference)
    : null;
  const salaryMinRaw = body.salaryMin ?? body.salary_min;
  const salaryMin =
    typeof salaryMinRaw === 'number' && Number.isFinite(salaryMinRaw)
      ? Math.max(0, salaryMinRaw)
      : typeof salaryMinRaw === 'string' &&
          salaryMinRaw.trim() &&
          Number.isFinite(Number(salaryMinRaw))
        ? Math.max(0, Number(salaryMinRaw))
        : null;
  return {
    targetRoles: strArrayFromCareerGoalsBody(
      body.targetRoles ?? body.target_roles,
    ),
    targetCompanies: strArrayFromCareerGoalsBody(
      body.targetCompanies ?? body.target_companies,
    ),
    targetLocations: strArrayFromCareerGoalsBody(
      body.targetLocations ?? body.target_locations,
    ),
    targetIndustries: strArrayFromCareerGoalsBody(
      body.targetIndustries ?? body.target_industries,
    ),
    targetSkills: strArrayFromCareerGoalsBody(
      body.targetSkills ?? body.target_skills,
    ),
    employmentTypes: strArrayFromCareerGoalsBody(
      body.employmentTypes ?? body.employment_types,
    ),
    salaryMin,
    salaryCurrency:
      body.salaryCurrency != null && typeof body.salaryCurrency === 'string'
        ? body.salaryCurrency.trim() || null
        : body.salary_currency != null &&
            typeof body.salary_currency === 'string'
          ? String(body.salary_currency).trim() || null
          : null,
    remotePreference: remote,
    updatedAt:
      typeof body.updatedAt === 'string'
        ? body.updatedAt
        : typeof body.updated_at === 'string'
          ? body.updated_at
          : null,
  };
}

const careerGoals = {
  get: async (): Promise<CareerGoalsWorkspace> => {
    const res = await axiosClient.get<unknown>('/career-goals');
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCareerGoalsWorkspace(unwrapApiDataEnvelope(res.data));
  },
  put: async (body: CareerGoalsWorkspace): Promise<CareerGoalsWorkspace> => {
    const res = await axiosClient.put<unknown>('/career-goals', {
      targetRoles: body.targetRoles,
      targetCompanies: body.targetCompanies,
      targetLocations: body.targetLocations,
      targetIndustries: body.targetIndustries,
      targetSkills: body.targetSkills,
      employmentTypes: body.employmentTypes,
      salaryMin: body.salaryMin ?? null,
      salaryCurrency: body.salaryCurrency ?? null,
      remotePreference: body.remotePreference ?? null,
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCareerGoalsWorkspace(unwrapApiDataEnvelope(res.data));
  },
};

const dashboard = {
  getTodayPlan: async (params?: {
    cvProfileId?: string;
    timezone?: string;
    locale?: string;
    /** Phase 14 QA: return full computed payloads even when normally omitted for hidden cards */
    includeHiddenDashboardCards?: boolean;
    /** Phase 17A: cap focus feed length on today-plan (1–100). */
    focusFeedMaxItems?: number;
  }) => {
    const ffm =
      typeof params?.focusFeedMaxItems === 'number' &&
      Number.isFinite(params.focusFeedMaxItems) &&
      params.focusFeedMaxItems >= 1 &&
      params.focusFeedMaxItems <= 100
        ? Math.round(params.focusFeedMaxItems)
        : undefined;
    const res = await axiosClient.get<unknown>('/dashboard/today-plan', {
      params: {
        ...(params?.cvProfileId ? { cvProfileId: params.cvProfileId } : {}),
        ...(params?.timezone ? { timezone: params.timezone } : {}),
        ...(params?.locale ? { locale: params.locale } : {}),
        ...(params?.includeHiddenDashboardCards
          ? { includeHiddenDashboardCards: true }
          : {}),
        ...(ffm != null ? { focusFeedMaxItems: ffm } : {}),
      },
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeTodayPlan(res.data);
  },
  getDashboardFocus: async (params?: {
    cvProfileId?: string;
    timezone?: string;
    locale?: string;
  }) => {
    const res = await axiosClient.get<unknown>('/dashboard/focus', {
      params: {
        ...(params?.cvProfileId ? { cvProfileId: params.cvProfileId } : {}),
        ...(params?.timezone ? { timezone: params.timezone } : {}),
        ...(params?.locale ? { locale: params.locale } : {}),
      },
    });
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeDashboardFocus(res.data);
  },
  getWeeklyStallSummary: async (params?: { limit?: number }) => {
    const limit = clampWeeklyStallLimit(params?.limit);
    const res = await axiosClient.get<unknown>(
      '/dashboard/weekly-stall-summary',
      {
        params: { limit },
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeWeeklyStallSummary(res.data);
  },
  getChangesSinceLastVisit: async () => {
    const res = await axiosClient.get<unknown>(
      '/dashboard/changes-since-last-visit',
    );
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeSinceLastVisit(res.data);
  },
  markSeen: async () => {
    const res = await axiosClient.post<unknown>('/dashboard/mark-seen', {});
    throwIfApiFailureResponse(res.data, res.status);
  },
  behaviorEvent: async (body: {
    eventName: string;
    context: Record<string, unknown>;
    occurredAt?: string;
    sessionId?: string;
  }): Promise<void> => {
    const res = await axiosClient.post<unknown>('/dashboard/behavior-event', {
      eventName: body.eventName,
      context: body.context,
      ...(body.occurredAt != null && body.occurredAt !== ''
        ? { occurredAt: body.occurredAt }
        : {}),
      ...(body.sessionId != null && body.sessionId !== ''
        ? { sessionId: body.sessionId }
        : {}),
    });
    throwIfApiFailureResponse(res.data, res.status);
  },
  prefetchNextActions: async (args: {
    priorityIds?: string[];
    jobAnalysisIds?: string[];
    jobListingIds?: string[];
  }) => {
    const priorityIds = (args.priorityIds ?? [])
      .map((x) => x.trim())
      .filter(Boolean);
    const jobAnalysisIds = (args.jobAnalysisIds ?? [])
      .map((x) => x.trim())
      .filter(Boolean);
    const jobListingIds = (args.jobListingIds ?? [])
      .map((x) => x.trim())
      .filter(Boolean);
    if (
      priorityIds.length === 0 &&
      jobAnalysisIds.length === 0 &&
      jobListingIds.length === 0
    )
      return null;
    const res = await axiosClient.post<unknown>(
      '/dashboard/next-action-prefetch',
      {
        ...(priorityIds.length > 0 ? { priorityIds } : {}),
        ...(jobAnalysisIds.length > 0 ? { jobAnalysisIds } : {}),
        ...(jobListingIds.length > 0 ? { jobListingIds } : {}),
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data);
  },
};

const execution = {
  checkpoint: async (body: {
    workflowEntityId: string;
    workflowEntityType: string;
    executionType: string;
    component: string;
    stepKey: string;
    percentComplete?: number;
    estimatedRemainingMinutes?: number | null;
    resumeConfidence?: number | null;
    hydrationConsistencyKey?: string | null;
    snapshot?: Record<string, unknown> | null;
  }): Promise<{ sessionId: string; checkpointId: string }> => {
    const res = await axiosClient.post<unknown>('/execution/checkpoint', body);
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    return {
      sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : '',
      checkpointId:
        typeof raw.checkpointId === 'string' ? raw.checkpointId : '',
    };
  },
  complete: async (body: {
    workflowEntityId: string;
    executionType: string;
  }): Promise<void> => {
    const res = await axiosClient.post<unknown>('/execution/complete', body);
    throwIfApiFailureResponse(res.data, res.status);
  },
};

const growth = {
  getDailyDirection: async (): Promise<GrowthDailyDirection> => {
    const res = await axiosClient.get<unknown>('/growth/daily-direction');
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const dailyDirectionRaw =
      raw.dailyDirection !== null && typeof raw.dailyDirection === 'object'
        ? (raw.dailyDirection as Record<string, unknown>)
        : {};
    const continuationStateRaw =
      raw.continuationState !== null &&
      typeof raw.continuationState === 'object'
        ? (raw.continuationState as Record<string, unknown>)
        : {};
    return {
      generatedAt:
        typeof raw.generatedAt === 'string'
          ? raw.generatedAt
          : new Date().toISOString(),
      identitySignal:
        typeof raw.identitySignal === 'string' && raw.identitySignal.trim()
          ? raw.identitySignal
          : 'You are actively moving toward getting hired today.',
      dailyDirection: {
        primaryPriorityId:
          typeof dailyDirectionRaw.primaryPriorityId === 'string'
            ? dailyDirectionRaw.primaryPriorityId
            : null,
        recommendedPriorityIds: ensureArray<unknown>(
          dailyDirectionRaw.recommendedPriorityIds,
        ).filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        ),
        progressContext:
          typeof dailyDirectionRaw.progressContext === 'string'
            ? dailyDirectionRaw.progressContext
            : null,
        impactLabel:
          typeof dailyDirectionRaw.impactLabel === 'string'
            ? dailyDirectionRaw.impactLabel
            : null,
      },
      continuationState: {
        hasNew: continuationStateRaw.hasNew === true,
        message:
          typeof continuationStateRaw.message === 'string'
            ? continuationStateRaw.message
            : null,
        suggestedPriorityId:
          typeof continuationStateRaw.suggestedPriorityId === 'string'
            ? continuationStateRaw.suggestedPriorityId
            : null,
        specificTaskLabel:
          typeof continuationStateRaw.specificTaskLabel === 'string'
            ? continuationStateRaw.specificTaskLabel
            : null,
        estimatedMinutesLeft:
          typeof continuationStateRaw.estimatedMinutesLeft === 'number' &&
          Number.isFinite(continuationStateRaw.estimatedMinutesLeft)
            ? continuationStateRaw.estimatedMinutesLeft
            : null,
        urgencyLabel:
          typeof continuationStateRaw.urgencyLabel === 'string'
            ? continuationStateRaw.urgencyLabel
            : null,
      },
    };
  },
  getProgress: async (
    window: GrowthProgressWindow = 'weekly',
  ): Promise<GrowthProgress> => {
    const res = await axiosClient.get<unknown>('/growth/progress', {
      params: { window },
    });
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const metrics =
      raw.metrics !== null && typeof raw.metrics === 'object'
        ? (raw.metrics as Record<string, unknown>)
        : {};
    const resolvedWindow =
      raw.window === 'daily' ||
      raw.window === 'weekly' ||
      raw.window === 'monthly'
        ? raw.window
        : window;
    return {
      window: resolvedWindow,
      from: typeof raw.from === 'string' ? raw.from : '',
      to: typeof raw.to === 'string' ? raw.to : '',
      metrics: {
        jobsProgressed:
          typeof metrics.jobsProgressed === 'number'
            ? metrics.jobsProgressed
            : 0,
        followUpsCompleted:
          typeof metrics.followUpsCompleted === 'number'
            ? metrics.followUpsCompleted
            : 0,
        matchQualityAvg:
          typeof metrics.matchQualityAvg === 'number'
            ? metrics.matchQualityAvg
            : 0,
        matchQualityDelta:
          typeof metrics.matchQualityDelta === 'number'
            ? metrics.matchQualityDelta
            : 0,
      },
    };
  },
  getMomentumNudges: async (): Promise<{ items: GrowthMomentumNudge[] }> => {
    const res = await axiosClient.get<unknown>('/growth/momentum-nudges');
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const items = ensureArray<unknown>(raw.items)
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        title:
          typeof item.title === 'string' ? item.title : 'Continue progress',
        message: typeof item.message === 'string' ? item.message : '',
        actionLabel:
          typeof item.actionLabel === 'string' ? item.actionLabel : 'Continue',
        route: typeof item.route === 'string' ? item.route : '/dashboard',
        relevanceScore:
          typeof item.relevanceScore === 'number' &&
          Number.isFinite(item.relevanceScore)
            ? item.relevanceScore
            : 0,
        updatedAt:
          typeof item.updatedAt === 'string'
            ? item.updatedAt
            : new Date().toISOString(),
      }))
      .filter((item) => item.id.trim().length > 0);
    return { items };
  },
  getImmediateFeedback: async (): Promise<{
    feedback: GrowthImmediateFeedback | null;
  }> => {
    const res = await axiosClient.get<unknown>('/growth/immediate-feedback');
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const f = raw.feedback;
    if (f === null || typeof f !== 'object') return { feedback: null };
    const feedback = f as Record<string, unknown>;
    return {
      feedback: {
        id: typeof feedback.id === 'string' ? feedback.id : '',
        message: typeof feedback.message === 'string' ? feedback.message : '',
        createdAt:
          typeof feedback.createdAt === 'string'
            ? feedback.createdAt
            : new Date().toISOString(),
        metadata:
          feedback.metadata !== null &&
          typeof feedback.metadata === 'object' &&
          !Array.isArray(feedback.metadata)
            ? (feedback.metadata as Record<string, unknown>)
            : {},
      },
    };
  },
  getAchievements: async (): Promise<{ items: GrowthAchievement[] }> => {
    const res = await axiosClient.get<unknown>('/growth/achievements');
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapApiDataEnvelope(res.data) as Record<string, unknown>;
    const items = ensureArray<unknown>(raw.items)
      .filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === 'object' && !Array.isArray(x),
      )
      .map((item) => {
        const sharePayload =
          item.sharePayload !== null && typeof item.sharePayload === 'object'
            ? (item.sharePayload as Record<string, unknown>)
            : {};
        return {
          id: typeof item.id === 'string' ? item.id : '',
          type:
            item.type === 'high_match_reached' ||
            item.type === 'cv_improvement_completed' ||
            item.type === 'momentum_streak' ||
            item.type === 'pipeline_progress'
              ? item.type
              : 'pipeline_progress',
          title:
            typeof item.title === 'string'
              ? item.title
              : 'Achievement unlocked',
          subtitle: typeof item.subtitle === 'string' ? item.subtitle : '',
          metricValue:
            typeof item.metricValue === 'number' &&
            Number.isFinite(item.metricValue)
              ? item.metricValue
              : null,
          sharePayload: {
            badge:
              typeof sharePayload.badge === 'string'
                ? sharePayload.badge
                : 'Achievement',
            value:
              typeof sharePayload.value === 'number' &&
              Number.isFinite(sharePayload.value)
                ? sharePayload.value
                : null,
            note:
              typeof sharePayload.note === 'string' ? sharePayload.note : '',
          },
          createdAt:
            typeof item.createdAt === 'string'
              ? item.createdAt
              : new Date().toISOString(),
        } satisfies GrowthAchievement;
      })
      .filter((item) => item.id.trim().length > 0);
    return { items };
  },
  trackEvent: async (payload: {
    eventName: GrowthEventName;
    context?: Record<string, unknown>;
  }) => {
    try {
      const res = await axiosClient.post<unknown>('/growth/events', payload);
      throwIfApiFailureResponse(res.data, res.status);
      return unwrapApiDataEnvelope(res.data);
    } catch {
      // Growth tracking should never break the primary user flow.
      return null;
    }
  },
  getOutboundHealth: async () => {
    const res = await axiosClient.get<unknown>('/growth/outbound-health');
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data);
  },
};

const analytics = {
  getOverview: async () => {
    const res = await axiosClient.get<unknown>('/analytics/overview');
    return normalizeAnalyticsOverview(res.data);
  },
  trackEvent: async (payload: {
    eventName:
      | 'dashboard_cta_clicked'
      | 'analyze_completed'
      | 'apply_completed'
      | 'jobhub_row_prefetched'
      | 'jobboard_card_prefetched'
      | 'topmatch_prefetched'
      | 'jobboard_quick_action_clicked'
      | 'jobboard_refined_score_ready'
      | 'jobboard_focus_opened'
      | 'jobboard_empty_guidance_clicked'
      /** Backend Phase 1 product analytics */
      | 'mission_completed'
      | 'recommendation_clicked'
      | 'recommendation_dismissed'
      | 'recommendation_completed'
      | 'followup_started'
      | 'followup_sent'
      | 'followup_ignored'
      | 'stale_action_blocked'
      | 'execution_started'
      | 'execution_completed'
      | 'execution_failed'
      | 'execution_abandoned'
      | 'modal_opened'
      | 'modal_closed'
      | 'stale_execution_detected'
      | 'degraded_execution_opened'
      | 'degraded_route_opened'
      | 'fallback_route_used'
      | 'missing_context_detected'
      | 'stalled_recovery_success'
      | 'continuation_resumed'
      | 'continuation_abandoned'
      | 'fast_path_used'
      | 'interview_started'
      | 'interview_answer_submitted'
      | 'interview_followup_triggered'
      | 'interview_completed'
      | 'interview_weakness_detected';
    context?: Record<string, unknown>;
    occurredAt?: string;
    sessionId?: string;
  }) => {
    try {
      const res = await axiosClient.post<unknown>('/analytics/events', payload);
      throwIfApiFailureResponse(res.data, res.status);
      return unwrapApiDataEnvelope(res.data);
    } catch {
      return null;
    }
  },
  getFunnels: async (action: 'apply' | 'jobboard_discovery' = 'apply') => {
    const res = await axiosClient.get<unknown>('/analytics/funnels', {
      params: { action },
    });
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data);
  },
};

const interviews = {
  create: async (payload: {
    cvProfileId?: string;
    jobAnalysisId?: string;
    jobTitle?: string;
    company?: string;
    jobDescription?: string;
    interviewType?: InterviewType;
    personality?: InterviewPersonality;
    totalQuestions?: number;
    interviewMode?: 'job_based' | 'role_based';
    roleTitle?: string;
    coachPersonality?: 'friendly' | 'professional' | 'strict' | 'fast_paced';
    interviewerPersonality?: string;
    interviewPersona?: import('@/lib/interviewPersonas').InterviewPersonaId;
    speakingSpeed?: number;
    adaptiveDifficulty?: boolean;
    prepMode?: 'standard' | 'hr_simulation' | 'senior_interviewer_simulation';
    stressLevel?: number;
    stressMode?: boolean;
    questionTimeLimitSec?: number;
    coachingEnabled?: boolean;
    coachingIntensity?: 'light' | 'standard' | 'intensive';
    coachingMode?: 'real_time' | 'on_demand';
  }): Promise<InterviewSession> => {
    const res = await axiosClient.post<unknown>('/interviews', payload);
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data) as unknown as InterviewSession;
  },
  list: async (): Promise<InterviewSession[]> => {
    const res = await axiosClient.get<unknown>('/interviews');
    throwIfApiFailureResponse(res.data, res.status);
    const raw = res.data;
    if (Array.isArray(raw)) return raw as InterviewSession[];
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o.data)) return o.data as InterviewSession[];
    }
    return [];
  },
  get: async (sessionId: string): Promise<InterviewSession> => {
    const res = await axiosClient.get<unknown>(`/interviews/${sessionId}`);
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data) as unknown as InterviewSession;
  },
  submitAnswers: async (
    sessionId: string,
    answers: Array<{
      questionId: string;
      answerText: string;
      durationSeconds: number;
    }>,
    options?: { idempotencyKey?: string },
  ): Promise<{
    message: string;
    sessionId: string;
    evaluationStatus?: 'queued' | 'processing' | 'completed' | 'failed';
  }> => {
    const res = await axiosClient.post<unknown>(
      `/interviews/${sessionId}/submit`,
      {
        answers,
        ...(options?.idempotencyKey
          ? { idempotencyKey: options.idempotencyKey }
          : {}),
      },
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data) as unknown as {
      message: string;
      sessionId: string;
      evaluationStatus?: 'queued' | 'processing' | 'completed' | 'failed';
    };
  },
  getResult: async (
    sessionId: string,
  ): Promise<InterviewEvaluationPollState> => {
    const res = await axiosClient.get<unknown>(
      `/interviews/${sessionId}/result`,
      {
        validateStatus: (s) => s === 200 || s === 202 || s === 404,
      },
    );
    const raw = unwrapApiDataEnvelope(res.data);
    return parseInterviewResultPoll(res.status, raw ?? res.data);
  },
  /** Re-queues evaluation; poll GET .../result until completed or failed. */
  retryEvaluation: async (
    sessionId: string,
  ): Promise<{
    evaluationStatus: 'queued' | 'processing';
    sessionId: string;
    message: string;
  }> => {
    const res = await axiosClient.post<unknown>(
      `/interviews/${sessionId}/retry-evaluation`,
      {},
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data) as unknown as {
      evaluationStatus: 'queued' | 'processing';
      sessionId: string;
      message: string;
    };
  },
};

const career = {
  getDashboard: async () => {
    const res = await axiosClient.get<unknown>('/career/dashboard');
    throwIfApiFailureResponse(res.data, res.status);
    return normalizeCareerDashboard(res.data);
  },
  submitVerification: async (payload: {
    jobId?: string;
    linkedinPostUrl: string;
    screenshotUrl?: string;
    screenshotFile?: File;
  }) => {
    if (payload.screenshotFile) {
      const form = new FormData();
      form.append('linkedinPostUrl', payload.linkedinPostUrl);
      if (payload.jobId?.trim()) form.append('jobId', payload.jobId.trim());
      if (payload.screenshotUrl?.trim())
        form.append('screenshotUrl', payload.screenshotUrl.trim());
      form.append('screenshot', payload.screenshotFile);
      const res = await axiosClient.post<unknown>(
        '/career/verification/submit',
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      throwIfApiFailureResponse(res.data, res.status);
      return parseVerificationSubmitResult(res.data);
    }
    const res = await axiosClient.post<unknown>('/career/verification/submit', {
      jobId: payload.jobId,
      linkedinPostUrl: payload.linkedinPostUrl,
      screenshotUrl: payload.screenshotUrl,
    });
    throwIfApiFailureResponse(res.data, res.status);
    return parseVerificationSubmitResult(res.data);
  },
};

export const api = {
  auth,
  users,
  location,
  onboarding,
  cv,
  cvExport,
  jobs,
  jobDiscovery,
  applications,
  notifications,
  dashboard,
  execution,
  growth,
  analytics,
  interviews,
  interviewPrep: interviewPrepApiClient,
  careerGoals,
  career,
};
