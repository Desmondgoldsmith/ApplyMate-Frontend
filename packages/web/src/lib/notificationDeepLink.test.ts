import { describe, expect, it } from 'vitest';

import type { NotificationItem } from '@/lib/api';
import { notificationActionHref } from '@/lib/notificationDeepLink';

function n(partial: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'n-1',
    message: 'Notification body',
    read: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('notificationDeepLink', () => {
  it('normalizes legacy ctaHref to canonical job hub URL', () => {
    const href = notificationActionHref(
      n({
        metadata: {
          ctaHref: '/dashboard/job-hub?jobAnalysisId=ja-real&focus=analysis',
        },
      }),
    );
    expect(href).toBe('/dashboard/jobs?jobId=ja-real&focus=analysis');
  });

  it('builds canonical job hub link from jobAnalysisId metadata', () => {
    const href = notificationActionHref(
      n({
        metadata: {
          jobAnalysisId: 'ja-123',
          focus: 'analysis',
        },
      }),
    );
    expect(href).toBe('/dashboard/jobs?jobId=ja-123&focus=analysis');
  });

  it('builds canonical application deep link', () => {
    expect(
      notificationActionHref(
        n({
          metadata: { applicationId: 'app-9' },
        }),
      ),
    ).toBe('/dashboard/jobs?applicationId=app-9&focus=followup');
  });

  it('rewrites legacy job-hub href from metadata', () => {
    expect(
      notificationActionHref(
        n({
          metadata: { href: '/dashboard/job-hub?jobAnalysisId=ja-legacy&focus=analysis' },
        }),
      ),
    ).toBe('/dashboard/jobs?jobId=ja-legacy&focus=analysis');
  });

  it('falls back to canonical jobs list', () => {
    expect(notificationActionHref(n({ metadata: {} }))).toBe('/dashboard/jobs');
  });
});
