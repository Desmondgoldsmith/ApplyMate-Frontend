import { describe, expect, it } from 'vitest';

import {
  buildInterviewsAliasRedirect,
  buildJobAnalyzerAliasRedirect,
  buildJobHubAliasRedirect,
  normalizeDashboardRoute,
} from '@/lib/dashboardCanonicalRoutes';

describe('dashboardCanonicalRoutes', () => {
  it('redirects job-analyzer with analysis id as jobId', () => {
    const dest = buildJobAnalyzerAliasRedirect(
      new URLSearchParams({ jobAnalysisId: 'abc-123', openTailor: '1' }),
    );
    expect(dest).toBe('/dashboard/jobs/analyze?jobId=abc-123&openTailor=1');
  });

  it('redirects job-hub tailor focus to analyzer', () => {
    const dest = buildJobHubAliasRedirect(
      new URLSearchParams({ focus: 'tailor', jobAnalysisId: 'ja-1' }),
    );
    expect(dest).toBe('/dashboard/jobs/analyze?jobId=ja-1&openTailor=1');
  });

  it('redirects job-hub followUps to follow-up page', () => {
    expect(buildJobHubAliasRedirect(new URLSearchParams({ followUps: '1' }))).toBe(
      '/dashboard/follow-up-jobs',
    );
  });

  it('redirects legacy /dashboard/interviews to interview-prep list', () => {
    const dest = buildInterviewsAliasRedirect(
      new URLSearchParams({ jobAnalysisId: 'ja-9' }),
    );
    expect(dest).toBe('/dashboard/interview-prep?jobAnalysisId=ja-9');
  });

  it('normalizes legacy alias hrefs for in-app use', () => {
    expect(normalizeDashboardRoute('/dashboard/job-hub?jobAnalysisId=x&focus=analysis')).toBe(
      '/dashboard/jobs?jobId=x&focus=analysis',
    );
    expect(normalizeDashboardRoute('/dashboard/interviews')).toBe('/dashboard/interview-prep');
    expect(normalizeDashboardRoute('/dashboard/interview-prep?jobAnalysisId=y')).toBe(
      '/dashboard/interview-prep?jobAnalysisId=y',
    );
  });
});
