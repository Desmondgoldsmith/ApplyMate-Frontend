import { describe, expect, it } from 'vitest';

import type { TrackedJob } from '@/app/(dashboard)/dashboard/jobs/jobHubMerge';
import type { CareerDashboard } from '@/lib/career';
import { pickNextBestAction } from '@/lib/jobHubNextAction';

function job(overrides: Partial<TrackedJob> & Pick<TrackedJob, 'key' | 'stage'>): TrackedJob {
  return {
    jobAnalysisId: 'job-1',
    applicationId: null,
    title: 'Engineer',
    company: 'Acme',
    matchScore: null,
    createdAt: null,
    hasAnalysis: true,
    origin: 'analysis',
    state: 'analyzed',
    isApplied: false,
    ...overrides,
  };
}

describe('pickNextBestAction', () => {
  it('prioritizes continue tailoring for in-progress tailored roles', () => {
    const action = pickNextBestAction(undefined, [
      job({
        key: 't',
        stage: 'analyzed',
        jobAnalysisId: 'abc',
        applicationAssist: {
          hasCvReady: true,
          hasTailoredCv: true,
          hasCoverLetterDraft: false,
          missingFields: [],
        },
      }),
    ]);
    expect(action?.onClickKey).toBe('tailor');
    expect(action?.href).toContain('abc');
  });

  it('suggests accepted tab when accepted jobs exist', () => {
    const career: CareerDashboard = {
      activePipelineJobs: [],
      acceptedJobs: [{ jobId: 'x', pipelineStage: 'ACCEPTED', company: 'Co', title: 'Dev', matchScore: null, lastEventAt: '' }],
      recentActivity: [],
      badges: [],
      insights: { strongestSkill: null, conversionRate: null, avgMatchScoreOfAppliedJobs: null },
    };
    const action = pickNextBestAction(career, []);
    expect(action?.onClickKey).toBe('accepted');
    expect(action?.href).toContain('pipelineTab=accepted');
  });
});
