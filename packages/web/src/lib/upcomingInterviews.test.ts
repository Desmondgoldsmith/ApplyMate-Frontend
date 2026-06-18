import { describe, expect, it } from 'vitest';

import type { UpcomingInterviewItem } from '@/lib/today-plan';
import type { JobHistoryItem } from '@/lib/api';
import {
  deriveAppliedPrepFromJobHistory,
  isAppliedPrepUpcomingRow,
  mergeDashboardUpcomingInterviews,
  sortUpcomingInterviewsForDashboard,
  upcomingInterviewsCountBadge,
} from '@/lib/upcomingInterviews';

function row(partial: Partial<UpcomingInterviewItem> & Pick<UpcomingInterviewItem, 'jobAnalysisId'>): UpcomingInterviewItem {
  return {
    id: partial.jobAnalysisId,
    headline: partial.headline ?? 'Headline',
    supporting: partial.supporting ?? '',
    company: partial.company ?? null,
    jobTitle: partial.jobTitle ?? null,
    stage: partial.stage ?? null,
    interviewDate: partial.interviewDate ?? null,
    daysUntilInterview: partial.daysUntilInterview ?? null,
    confidence: partial.confidence ?? null,
    ctaLabel: 'Start interview practice',
    ctaHref: `/dashboard/interview?jobAnalysisId=${partial.jobAnalysisId}`,
    lastUpdatedAt: null,
    ...partial,
  };
}

describe('sortUpcomingInterviewsForDashboard', () => {
  it('ranks scheduled interviews above applied_prep', () => {
    const sorted = sortUpcomingInterviewsForDashboard([
      row({ jobAnalysisId: 'a', stage: 'applied_prep', confidence: 90 }),
      row({ jobAnalysisId: 'b', stage: 'technical_interview', daysUntilInterview: 5, confidence: 50 }),
    ]);
    expect(sorted[0]?.jobAnalysisId).toBe('b');
    expect(sorted[1]?.jobAnalysisId).toBe('a');
  });

  it('sorts sooner daysUntilInterview first within funnel rows', () => {
    const sorted = sortUpcomingInterviewsForDashboard([
      row({ jobAnalysisId: 'far', stage: 'interview', daysUntilInterview: 14 }),
      row({ jobAnalysisId: 'soon', stage: 'interview', daysUntilInterview: 2 }),
    ]);
    expect(sorted[0]?.jobAnalysisId).toBe('soon');
  });
});

describe('isAppliedPrepUpcomingRow', () => {
  it('detects applied_prep stage', () => {
    expect(isAppliedPrepUpcomingRow(row({ jobAnalysisId: 'x', stage: 'applied_prep' }))).toBe(true);
    expect(isAppliedPrepUpcomingRow(row({ jobAnalysisId: 'x', stage: 'interview' }))).toBe(false);
  });
});

describe('deriveAppliedPrepFromJobHistory', () => {
  it('builds applied_prep rows for history pipeline applied', () => {
    const history: JobHistoryItem[] = [
      {
        id: 'ja-1',
        jobTitle: 'Engineer',
        company: 'Acme',
        companyLogoUrl: null,
        matchScore: 80,
        recommendation: '',
        createdAt: '2026-01-01',
        scoreBeforeTailoring: null,
        tailoredCvProfileId: null,
        tailoredCvName: null,
        isTailored: false,
        hasCoverLetter: false,
        pipelineStatus: 'applied',
      },
    ];
    const rows = deriveAppliedPrepFromJobHistory(history, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stage).toBe('applied_prep');
    expect(rows[0]?.headline).toContain('Acme');
  });
});

describe('mergeDashboardUpcomingInterviews', () => {
  it('dedupes plan rows against history supplement', () => {
    const plan = [row({ jobAnalysisId: 'ja-1', stage: 'applied_prep' })];
    const history: JobHistoryItem[] = [
      {
        id: 'ja-1',
        jobTitle: 'Engineer',
        company: 'Acme',
        companyLogoUrl: null,
        matchScore: 80,
        recommendation: '',
        createdAt: '2026-01-01',
        scoreBeforeTailoring: null,
        tailoredCvProfileId: null,
        tailoredCvName: null,
        isTailored: false,
        hasCoverLetter: false,
        pipelineStatus: 'applied',
      },
    ];
    const merged = mergeDashboardUpcomingInterviews(plan, history);
    expect(merged).toHaveLength(1);
  });
});

describe('upcomingInterviewsCountBadge', () => {
  it('uses role wording when all rows are applied_prep', () => {
    const rows = [row({ jobAnalysisId: 'a', stage: 'applied_prep' })];
    expect(upcomingInterviewsCountBadge(1, rows)).toBe('1 role');
  });
});
