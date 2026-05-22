import { describe, expect, it } from 'vitest';

import type { DashboardContinuationItemPayload } from '@/lib/today-plan';
import {
  enrichInterviewContinuationItem,
  prepareContinuationItemsForDisplay,
  shouldShowInterviewContinuationItem,
} from '@/lib/interviewContinuation';

function interviewItem(
  partial: Partial<DashboardContinuationItemPayload> & Pick<DashboardContinuationItemPayload, 'id'>,
): DashboardContinuationItemPayload {
  return {
    type: 'interview',
    title: 'Interview',
    description: 'Desc',
    ctaLabel: 'Continue',
    ctaHref: '/dashboard/interview/sess-1',
    ...partial,
  };
}

describe('shouldShowInterviewContinuationItem', () => {
  it('shows evaluation_processing and results_ready', () => {
    expect(
      shouldShowInterviewContinuationItem(interviewItem({ id: '1', stepKey: 'evaluation_processing' })),
    ).toBe(true);
    expect(shouldShowInterviewContinuationItem(interviewItem({ id: '2', stepKey: 'results_ready' }))).toBe(
      true,
    );
  });

  it('hides completed interviews', () => {
    expect(
      shouldShowInterviewContinuationItem(
        interviewItem({
          id: '3',
          interviewResumeState: { evaluationStatus: 'completed', resultsPath: null },
        }),
      ),
    ).toBe(false);
  });
});

describe('enrichInterviewContinuationItem', () => {
  it('sets View results href from resultsPath', () => {
    const out = enrichInterviewContinuationItem(
      interviewItem({
        id: '4',
        stepKey: 'results_ready',
        interviewResumeState: {
          evaluationStatus: 'completed',
          resultsPath: '/dashboard/interview/sess-99',
        },
      }),
    );
    expect(out.ctaLabel).toBe('View results');
    expect(out.ctaHref).toBe('/dashboard/interview/sess-99');
  });
});

describe('prepareContinuationItemsForDisplay', () => {
  it('filters completed and enriches processing copy', () => {
    const items = prepareContinuationItemsForDisplay([
      interviewItem({
        id: '5',
        stepKey: 'evaluation_processing',
        ctaLabel: '',
        description: '',
      }),
      interviewItem({
        id: '6',
        interviewResumeState: { evaluationStatus: 'completed', resultsPath: null },
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.ctaLabel).toBe('Results processing…');
  });
});
