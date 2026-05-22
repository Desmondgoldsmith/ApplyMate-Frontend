import type { NotificationItem } from '@/lib/api';

const JOB_HUB_FALLBACK = '/dashboard/job-hub';

function pickMetaString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function jobHubAnalysisHref(jobAnalysisId: string, focus = 'analysis'): string {
  const qp = new URLSearchParams();
  qp.set('jobAnalysisId', jobAnalysisId);
  if (focus) qp.set('focus', focus);
  return `/dashboard/job-hub?${qp.toString()}`;
}

function jobHubApplicationHref(applicationId: string): string {
  const qp = new URLSearchParams({ applicationId, focus: 'followup' });
  return `/dashboard/job-hub?${qp.toString()}`;
}

function jobHubBookmarkHref(bookmarkId: string): string {
  return `/dashboard/job-hub?${new URLSearchParams({ bookmarkId }).toString()}`;
}

/**
 * Backend may still return legacy `/dashboard/jobs?jobId=…` rows; normalize to canonical job-hub URLs
 * (alias page forwards to `/dashboard/jobs` with the query keys Job Hub reads).
 */
export function normalizeNotificationHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed.startsWith('/')) return trimmed;

  try {
    const url = new URL(trimmed, 'https://applymate.local');
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === '/dashboard/jobs') {
      const jobAnalysisId =
        url.searchParams.get('jobAnalysisId')?.trim() ||
        url.searchParams.get('jobId')?.trim() ||
        null;
      const applicationId = url.searchParams.get('applicationId')?.trim() || null;
      const bookmarkId = url.searchParams.get('bookmarkId')?.trim() || null;
      const focus = url.searchParams.get('focus')?.trim() || 'analysis';

      if (jobAnalysisId) return jobHubAnalysisHref(jobAnalysisId, focus);
      if (applicationId) return jobHubApplicationHref(applicationId);
      if (bookmarkId) return jobHubBookmarkHref(bookmarkId);
      return JOB_HUB_FALLBACK;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return trimmed;
  }
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

  return JOB_HUB_FALLBACK;
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
