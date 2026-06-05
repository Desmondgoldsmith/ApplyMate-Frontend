import { normalizeDashboardRoute } from '@/lib/dashboardCanonicalRoutes';
import { normalizeTodayPlanRoute, resolveTodayPlanHref, type TodayPlanCta } from '@/lib/today-plan';

type ResolutionState = 'resolved' | 'degraded' | 'missing_context' | null | undefined;

export type ExecutionResolutionInput = {
  cta?: TodayPlanCta | null;
  kind?: string | null;
  reasonCodes?: string[];
  actionType?: string | null;
  executionContext?: {
    canonicalRoute?: string | null;
    deepLink?: string | null;
    fallbackRoute?: string | null;
    resolutionState?: ResolutionState;
    applicationId?: string | null;
    canonicalJobId?: string | null;
    cvProfileId?: string | null;
  } | null;
  executionPayload?: {
    canonicalRoute?: string | null;
    deepLink?: string | null;
    fallbackRoute?: string | null;
    resolutionState?: ResolutionState;
    recommendationState?: string | null;
    applicationId?: string | null;
    canonicalJobId?: string | null;
    cvProfileId?: string | null;
  } | null;
  journeyNextRoute?: string | null;
  ids?: {
    applicationId?: string | null;
    jobAnalysisId?: string | null;
    jobListingId?: string | null;
    cvProfileId?: string | null;
  } | null;
  defaultCvProfileId?: string | null;
  safeFallback?: string;
  /**
   * Orchestration v1 — wins first for route resolution when set (backend canonical execution).
   */
  orchestrationCanonicalRoute?: string | null;
  orchestrationFallbackRoute?: string | null;
};

export type ExecutionResolutionResult = {
  href: string;
  resolutionState: 'resolved' | 'degraded';
  usedFallback: boolean;
  missingContext: boolean;
  reason: 'canonical' | 'deepLink' | 'fallbackRoute' | 'journey' | 'cta' | 'local_fallback';
};

/** Backend continuation links: `/jobs/analyze/:jobAnalysisId` → dashboard analyzer. */
export function mapApiContinuationHref(href: string): string {
  const trimmed = href.trim();
  const m = trimmed.match(/^\/jobs\/analyze\/([0-9a-f-]{36})$/i);
  if (m?.[1]) {
    return `/dashboard/jobs/analyze?jobId=${encodeURIComponent(m[1])}`;
  }
  return trimmed;
}

function normalizeRoute(href: string | null | undefined): string | null {
  const mapped = href ? mapApiContinuationHref(href) : href;
  const n = normalizeTodayPlanRoute(mapped ?? null);
  if (!n) return null;
  return normalizeDashboardRoute(n);
}

function isKnownDashboardRoute(href: string): boolean {
  return (
    href.startsWith('/dashboard/jobs') ||
    href.startsWith('/dashboard/interview') ||
    href.startsWith('/dashboard/cv') ||
    href.startsWith('/dashboard/job-board') ||
    href.startsWith('/dashboard/settings') ||
    href.startsWith('/dashboard/analyses') ||
    href.startsWith('/dashboard/interview-prep') ||
    href.startsWith('/dashboard/interviews') ||
    href.startsWith('/dashboard/cv-profiles') ||
    href.startsWith('/dashboard/job-hub') ||
    href.startsWith('/dashboard/job-analyzer') ||
    href.startsWith('/dashboard/career-goals')
  );
}

function isMissingContextForRoute(href: string): boolean {
  try {
    const u = new URL(href, 'https://applymate.invalid');
    if (u.pathname === '/dashboard/interview') {
      return !u.searchParams.get('jobAnalysisId');
    }
    if (u.pathname.startsWith('/dashboard/jobs') && u.searchParams.get('applicationId') !== null) {
      return !u.searchParams.get('applicationId');
    }
    if (u.pathname === '/dashboard/cv') return false;
    return false;
  } catch {
    return true;
  }
}

export function ensureSafeDashboardHref(
  href: string | null | undefined,
  fallback: string,
): { href: string; usedFallback: boolean } {
  const normalized = normalizeRoute(href);
  if (!normalized) return { href: fallback, usedFallback: true };
  if (!isKnownDashboardRoute(normalized)) return { href: fallback, usedFallback: true };
  if (isMissingContextForRoute(normalized)) return { href: fallback, usedFallback: true };
  return { href: normalized, usedFallback: false };
}

function localFallback(input: ExecutionResolutionInput): string {
  const ids = input.ids ?? {};
  const actionType = String(input.actionType ?? '').toUpperCase();
  const kind = String(input.kind ?? '').toLowerCase();
  const analysisId = (ids.jobAnalysisId ?? '').trim();
  const listingId = (ids.jobListingId ?? '').trim();
  const appId = (input.executionContext?.applicationId ?? ids.applicationId ?? '').trim();
  const cvId = (input.executionContext?.cvProfileId ?? ids.cvProfileId ?? input.defaultCvProfileId ?? '').trim();
  const codes = (input.reasonCodes ?? []).map((x) => String(x).toUpperCase());

  if (kind.includes('follow') || actionType === 'OPEN_JOB_HUB' || appId) {
    return appId ? `/dashboard/jobs?applicationId=${encodeURIComponent(appId)}` : '/dashboard/jobs';
  }
  if (actionType === 'OPEN_DISCOVERY' || codes.some((c) => c.includes('DISCOVERY') || c.includes('MATCH'))) {
    return listingId ? `/dashboard/job-board?jobListingId=${encodeURIComponent(listingId)}` : '/dashboard/job-board';
  }
  if (actionType === 'OPEN_JOB_ANALYZE' || actionType === 'OPEN_TAILOR') {
    if (analysisId) return `/dashboard/jobs/analyze?jobId=${encodeURIComponent(analysisId)}`;
    if (listingId) return `/dashboard/jobs/analyze?jobListingId=${encodeURIComponent(listingId)}`;
    return '/dashboard/jobs/analyze?new=1';
  }
  if (actionType === 'OPEN_CV_CLINIC' || kind.includes('cv')) {
    return cvId ? `/dashboard/cv?profileId=${encodeURIComponent(cvId)}` : '/dashboard/cv';
  }
  if (actionType.includes('INTERVIEW') || kind.includes('interview')) {
    if (analysisId) return `/dashboard/interview?jobAnalysisId=${encodeURIComponent(analysisId)}`;
    return '/dashboard/interview';
  }
  return input.safeFallback ?? '/dashboard/jobs';
}

export function resolveExecutionDestination(input: ExecutionResolutionInput): ExecutionResolutionResult {
  const resolutionStateRaw = input.executionPayload?.resolutionState ?? input.executionContext?.resolutionState ?? null;
  const recommendationState = String(input.executionPayload?.recommendationState ?? 'active').trim().toLowerCase();
  const isActiveRecommendation =
    recommendationState === '' || recommendationState === 'active' || recommendationState === 'pending';
  const preferred = resolutionStateRaw === 'resolved' && isActiveRecommendation;
  const orchCanon = normalizeRoute(input.orchestrationCanonicalRoute);
  const orchFb = normalizeRoute(input.orchestrationFallbackRoute);
  const canonical = normalizeRoute(input.executionPayload?.canonicalRoute ?? input.executionContext?.canonicalRoute);
  const deep = normalizeRoute(input.executionPayload?.deepLink ?? input.executionContext?.deepLink);
  const fallbackRoute = normalizeRoute(input.executionPayload?.fallbackRoute ?? input.executionContext?.fallbackRoute);
  const journey = normalizeRoute(input.journeyNextRoute);
  const ctaHref = input.cta ? normalizeRoute(resolveTodayPlanHref(input.cta, { reasonCodes: input.reasonCodes })) : null;

  // Backend route payload is the source of truth; orchestration canonical overrides item payloads when provided.
  const ordered = [
    ...(orchCanon ? [{ value: orchCanon, reason: 'canonical' as const }] : []),
    { value: canonical, reason: 'canonical' as const },
    { value: deep, reason: 'deepLink' as const },
    { value: journey, reason: 'journey' as const },
    { value: fallbackRoute, reason: 'fallbackRoute' as const },
    ...(orchFb ? [{ value: orchFb, reason: 'fallbackRoute' as const }] : []),
    { value: ctaHref, reason: 'cta' as const },
  ];

  for (const candidate of ordered) {
    if (!candidate.value) continue;
    if (!isKnownDashboardRoute(candidate.value)) continue;
    if (isMissingContextForRoute(candidate.value)) continue;
    return {
      href: candidate.value,
      resolutionState: preferred ? 'resolved' : 'degraded',
      usedFallback: candidate.reason === 'fallbackRoute' || candidate.reason === 'journey' || candidate.reason === 'cta',
      missingContext: false,
      reason: candidate.reason,
    };
  }

  return {
    href: localFallback(input),
    resolutionState: 'degraded',
    usedFallback: true,
    missingContext: true,
    reason: 'local_fallback',
  };
}

