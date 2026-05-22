import { describe, expect, it } from 'vitest';

import type { NotificationItem } from '@/lib/api';

import { normalizeNotificationHref, notificationActionHref } from './notificationDeepLink';

describe('notificationDeepLink', () => {
  it('prefers ctaHref over jobAnalysisId', () => {
    const n: NotificationItem = {
      id: '8ccaae7a-0d35-4f5b-a0a3-8caca0de7bdc',
      message: 'Analysis complete',
      read: false,
      createdAt: new Date().toISOString(),
      metadata: {
        jobAnalysisId: 'should-not-use-notification-id',
        ctaHref: '/dashboard/job-hub?jobAnalysisId=ja-real&focus=analysis',
      },
    };
    expect(notificationActionHref(n)).toBe('/dashboard/job-hub?jobAnalysisId=ja-real&focus=analysis');
  });

  it('builds canonical job-hub link from jobAnalysisId', () => {
    const n: NotificationItem = {
      id: 'notification-uuid',
      message: 'Done',
      read: true,
      createdAt: new Date().toISOString(),
      metadata: { jobAnalysisId: 'ja-123' },
    };
    expect(notificationActionHref(n)).toBe('/dashboard/job-hub?jobAnalysisId=ja-123&focus=analysis');
  });

  it('routes applicationId to job hub with application focus', () => {
    const n: NotificationItem = {
      id: 'n1',
      message: 'Apply',
      read: false,
      createdAt: new Date().toISOString(),
      metadata: { applicationId: 'app-9' },
    };
    expect(notificationActionHref(n)).toBe(
      '/dashboard/job-hub?applicationId=app-9&focus=followup',
    );
  });

  it('normalizes legacy /dashboard/jobs?jobId= links', () => {
    expect(normalizeNotificationHref('/dashboard/jobs?jobId=ja-legacy&focus=analysis')).toBe(
      '/dashboard/job-hub?jobAnalysisId=ja-legacy&focus=analysis',
    );
  });

  it('falls back to generic job hub when metadata has no deep link', () => {
    const n: NotificationItem = {
      id: '8ccaae7a-0d35-4f5b-a0a3-8caca0de7bdc',
      message: 'Growth feedback',
      read: false,
      createdAt: new Date().toISOString(),
      metadata: { eventName: 'analyze_completed', metricValue: 95 },
    };
    expect(notificationActionHref(n)).toBe('/dashboard/job-hub');
  });
});
