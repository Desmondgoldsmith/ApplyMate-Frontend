import type { NotificationItem } from '@/lib/api';
import {
  DASHBOARD_ROUTES,
  jobHubAnalysisHref,
  jobHubApplicationHref,
  jobHubBookmarkHref,
  normalizeDashboardRoute,
} from '@/lib/dashboardCanonicalRoutes';

function pickMetaString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Backend may return legacy alias URLs or `/dashboard/jobs?jobId=…`; normalize to canonical
 * Job Hub paths (`/dashboard/jobs` with query keys Job Hub reads).
 */
export function normalizeNotificationHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed.startsWith('/')) return trimmed;
  return normalizeDashboardRoute(trimmed);
}

/**
 * Resolve in-app route for a notification action.
 * Never use `notification.id` — that is the notification row UUID, not a job id.
 */
export function notificationActionHref(n: NotificationItem): string {
  const rawMeta = n.metadata as Record<string, unknown> | undefined;

  const ctaHref = pickMetaString(rawMeta, ['ctaHref', 'cta_href']);
  const href = pickMetaString(rawMeta, ['href']);
  const deepLink = pickMetaString(rawMeta, ['deepLink', 'deep_link']);
  const preferred =
    ctaHref?.startsWith('/')
      ? ctaHref
      : href?.startsWith('/')
        ? href
        : deepLink?.startsWith('/')
          ? deepLink
          : null;
  if (preferred) return normalizeNotificationHref(preferred);

  const jobAnalysisId = pickMetaString(rawMeta, [
    'jobAnalysisId',
    'job_analysis_id',
    'jobId',
    'job_id',
  ]);
  if (jobAnalysisId) {
    const focus = pickMetaString(rawMeta, ['focus']) ?? 'analysis';
    return jobHubAnalysisHref(jobAnalysisId, focus);
  }

  const applicationId = pickMetaString(rawMeta, [
    'applicationId',
    'application_id',
    'appId',
    'jobApplicationId',
    'job_application_id',
  ]);
  if (applicationId) return jobHubApplicationHref(applicationId);

  const bookmarkId = pickMetaString(rawMeta, [
    'bookmarkId',
    'bookmark_id',
    'hubBookmarkId',
    'hub_bookmark_id',
  ]);
  if (bookmarkId) return jobHubBookmarkHref(bookmarkId);

  return DASHBOARD_ROUTES.jobs;
}

export function notificationActionLabel(n: NotificationItem): string {
  const rawMeta = n.metadata as Record<string, unknown> | undefined;
  const ctaHref = pickMetaString(rawMeta, ['ctaHref', 'cta_href']);
  const href = pickMetaString(rawMeta, ['href']);
  const preferred = ctaHref ?? href;
  if (preferred?.includes('applicationId=')) return 'Open application';
  if (preferred?.includes('jobAnalysisId=') || preferred?.includes('jobId=')) return 'Open job details';
  if (preferred?.includes('bookmarkId=')) return 'Open in Job Hub';

  const jobAnalysisId = pickMetaString(rawMeta, ['jobAnalysisId', 'job_analysis_id', 'jobId', 'job_id']);
  const applicationId = pickMetaString(rawMeta, ['applicationId', 'application_id']);
  const bookmarkId = pickMetaString(rawMeta, ['bookmarkId', 'bookmark_id']);

  if (jobAnalysisId) return 'Open job details';
  if (applicationId) return 'Open application';
  if (bookmarkId) return 'Open in Job Hub';
  return 'Open Job Hub';
}
