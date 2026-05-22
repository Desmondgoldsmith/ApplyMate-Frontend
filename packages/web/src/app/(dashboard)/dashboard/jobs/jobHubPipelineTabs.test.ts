import { describe, expect, it } from 'vitest';

import type { TrackedJob } from './jobHubMerge';
import {
  derivePipelineTab,
  jobMatchesPipelineTab,
  pipelineTabCounts,
  pipelineStatusLabel,
} from './jobHubPipelineTabs';

function job(overrides: Partial<TrackedJob> & Pick<TrackedJob, 'key' | 'stage'>): TrackedJob {
  return {
    jobAnalysisId: 'job-1',
    applicationId: null,
    title: 'Engineer',
    company: 'Acme',
    matchScore: null,
    createdAt: null,
    hasAnalysis: false,
    origin: 'analysis',
    state: 'analyzed',
    isApplied: false,
    ...overrides,
  };
}

describe('jobHubPipelineTabs', () => {
  it('derives discovery for bookmarked roles without analysis', () => {
    const j = job({ key: 'a', stage: 'bookmarked', hasAnalysis: false });
    expect(derivePipelineTab(j)).toBe('discovery');
    expect(pipelineStatusLabel(j)).toBe('Discovery');
  });

  it('derives tailoring when CV is tailored but not applied', () => {
    const j = job({
      key: 'b',
      stage: 'analyzed',
      hasAnalysis: true,
      applicationAssist: { hasCvReady: true, hasTailoredCv: true, hasCoverLetterDraft: false, missingFields: [] },
    });
    expect(derivePipelineTab(j)).toBe('tailoring');
    expect(jobMatchesPipelineTab(j, 'tailoring')).toBe(true);
    expect(jobMatchesPipelineTab(j, 'applied')).toBe(false);
  });

  it('counts tabs including all', () => {
    const jobs = [
      job({ key: '1', stage: 'bookmarked', hasAnalysis: false }),
      job({ key: '2', stage: 'accepted', hasAnalysis: true, isApplied: true }),
    ];
    expect(pipelineTabCounts(jobs)).toEqual({
      all: 2,
      discovery: 1,
      accepted: 1,
    });
  });
});
