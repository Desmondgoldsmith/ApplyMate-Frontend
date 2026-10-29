import { describe, expect, it } from 'vitest';
import type { ApplicationItem, JobHistoryItem } from '@/lib/api';
import { hubStageToApplicationStatus, mergeTrackedJobs } from './jobHubMerge';

const hist = (over: Partial<JobHistoryItem> = {}) =>
  ({
    id: 'ja-1',
    title: 'Engineer',
    company: 'Acme',
    createdAt: '2026-10-01T00:00:00Z',
    ...over,
  }) as JobHistoryItem;

const app = (status: string) =>
  ({
    id: 'app-1',
    title: 'Engineer',
    company: 'Acme',
    status,
    createdAt: '2026-10-01T00:00:00Z',
  }) as ApplicationItem;

describe('mergeTrackedJobs', () => {
  it('keeps offers and closed applications in their own columns', () => {
    const [offer] = mergeTrackedJobs([app('offer_received')], [], {});
    expect(offer?.stage).toBe('offered');
    const [ghosted] = mergeTrackedJobs([app('ghosted')], [], {});
    expect(ghosted?.stage).toBe('rejected');
    expect(ghosted?.applicationStatus).toBe('ghosted');
  });

  it('exposes the server stage only while the card shows it', () => {
    const [shown] = mergeTrackedJobs([], [hist({ pipelineStatus: 'applied' })], {});
    expect(shown?.serverPipelineStage).toBe('applied');

    const [overridden] = mergeTrackedJobs([], [hist({ pipelineStatus: 'applied' })], {
      'ja-1': 'interviewing',
    });
    expect(overridden?.stage).toBe('interviewing');
    expect(overridden?.serverPipelineStage).toBeNull();
  });
});

describe('hubStageToApplicationStatus', () => {
  it('sends a status for every application column', () => {
    expect(hubStageToApplicationStatus('offered')).toBe('offer_received');
    expect(hubStageToApplicationStatus('rejected')).toBe('rejected');
  });
});
