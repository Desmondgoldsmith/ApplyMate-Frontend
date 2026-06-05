import { describe, expect, it } from 'vitest';

import { normalizeTodayPlan } from '@/lib/today-plan';

describe('normalizeTodayPlan predictiveOutlook', () => {
  it('parses semantic interview/offer outlook and timeline label', () => {
    const plan = normalizeTodayPlan({
      generatedAt: new Date().toISOString(),
      digestVersion: 'test',
      predictiveOutlook: {
        interviewOutlook: {
          value: 'strong',
          label: 'Interview Outlook',
          outlookBasis: 'Based on CV quality and applications.',
          disclaimer:
            'This reflects your current activity and pipeline health — not a statistical prediction of outcomes.',
        },
        offerOutlook: {
          value: 'building',
          label: 'Offer Outlook',
          outlookBasis: 'Pipeline is warming up.',
          disclaimer:
            'This reflects your current activity and pipeline health — not a statistical prediction of outcomes.',
        },
        timelineOutlook: 'near-term',
        timelineOutlookLabel: 'Near-term',
        pipelineHealth: 'healthy',
        confidence: 72,
      },
    });

    expect(plan.predictiveOutlook?.interviewOutlook?.value).toBe('strong');
    expect(plan.predictiveOutlook?.offerOutlook?.value).toBe('building');
    expect(plan.predictiveOutlook?.timelineOutlook).toBe('near-term');
    expect(plan.predictiveOutlook?.timelineOutlookLabel).toBe('Near-term');
    expect(plan.predictiveOutlook).not.toHaveProperty('interviewProbability');
    expect(plan.predictiveOutlook).not.toHaveProperty('estimatedWeeksToOffer');
  });

  it('parses dashboardVitals interviewOutlook without score percent', () => {
    const plan = normalizeTodayPlan({
      generatedAt: new Date().toISOString(),
      digestVersion: 'test',
      dashboardVitals: {
        interviewOutlook: {
          value: 'moderate',
          label: 'Interview Outlook',
          outlookBasis: 'Steady activity.',
          disclaimer: 'Not a statistical prediction.',
        },
      },
    });

    expect(plan.dashboardVitals?.interviewOutlook?.value).toBe('moderate');
    expect(plan.dashboardVitals?.interviewOutlook).not.toHaveProperty('score');
  });
});
