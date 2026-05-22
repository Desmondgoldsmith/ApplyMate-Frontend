import { describe, expect, it } from 'vitest';

import type { UnifiedPriorityItem } from '@/lib/today-plan';
import {
  formatBlockersPreview,
  formatConfidenceShort,
  formatInterruptionAge,
  inferEffortBand,
  labelForReadyState,
  scanLabelForJobHistoryRow,
  laneLabelForPriorityState,
} from '@/lib/todayPlanLabels';

const baseItem = (over: Partial<UnifiedPriorityItem>): UnifiedPriorityItem =>
  ({
    id: '1',
    priorityScore: 50,
    urgencyBucket: 'soon',
    kind: 'apply',
    title: 'T',
    subtitle: null,
    reasonCodes: [],
    reasonText: null,
    whyNowShort: null,
    compactDisplay: null,
    explain: null,
    applyAssist: null,
    prefill: null,
    resumeState: null,
    stateSnapshot: null,
    microcopy: null,
    outcomeCopy: null,
    nextActionPreview: null,
    outcomeFraming: null,
    journey: null,
    ctaHint: null,
    isNewSinceLastVisit: false,
    firstSeenAt: null,
    lastSeenAt: null,
    locationStrategy: null,
    locationLabel: null,
    postedAgeHours: null,
    recommendationSource: null,
    recommendationLocation: null,
    fallbackReason: null,
    dedupeGroupKey: null,
    recommendationFamilyId: null,
    confidenceScore: null,
    confidenceReason: null,
    estimatedOutcome: null,
    expectedImpactLevel: null,
    suppressionReason: null,
    roleTitle: null,
    roleCompany: null,
    roleLabel: null,
    interviewPrepContext: null,
    executionContext: null,
    followUpContext: null,
    cvFixContext: null,
    qualitySignals: null,
    reasonShort: null,
    reasonDetailed: null,
    recommendationId: null,
    generationReason: null,
    priorityState: null,
    actionReassurance: null,
    ids: {},
    cta: { label: 'Open', action: {} },
    ...over,
  }) as UnifiedPriorityItem;

describe('todayPlanLabels', () => {
  it('maps readyState to plain language', () => {
    expect(labelForReadyState('needs_cv_tailoring')).toBe('Needs CV tailoring first');
    expect(labelForReadyState('ready')).toBe('Ready to go');
  });

  it('formats interruption age in human terms', () => {
    expect(formatInterruptionAge(3)).toMatch(/hours ago/);
    expect(formatInterruptionAge(50)).toMatch(/days ago/);
  });

  it('formats confidence tiers without hype', () => {
    expect(formatConfidenceShort(85)).toBe('Strong match');
    expect(formatConfidenceShort(65)).toBe('Good match');
    expect(formatConfidenceShort(55)).toBe('Fair match');
  });

  it('summarizes blockers', () => {
    expect(formatBlockersPreview(['a', 'b', 'c'], 2)).toMatch(/\+1 more/);
  });

  it('maps priorityState to lane labels', () => {
    expect(laneLabelForPriorityState('continuation')).toContain('left off');
    expect(laneLabelForPriorityState('waiting')).toBe('Waiting');
  });

  it('infers job history scan tone without unified priorities', () => {
    expect(scanLabelForJobHistoryRow({ hasCoverLetter: false, isTailored: true }).label).toContain('cover');
    expect(scanLabelForJobHistoryRow({ matchScore: 80, hasCoverLetter: true, isTailored: true }).label).toBe(
      'Strong match',
    );
    expect(
      scanLabelForJobHistoryRow({
        pipelineStatus: 'interviewing',
        hasCoverLetter: true,
        isTailored: true,
      }).label,
    ).toBe('Interviewing');
  });

  it('infers effort band from friction and fast path', () => {
    expect(
      inferEffortBand(
        baseItem({
          applyAssist: {
            suggestedNextStep: '',
            estimatedSteps: 1,
            estimatedStepsRemaining: 1,
            estimatedMinutesToApply: 5,
            blockerSeverity: 'none',
            fastPathEligible: true,
            fastPathRoute: null,
            noEditsNeeded: true,
            primaryActionLabel: null,
            frictionScore: 15,
            completionLikelihood: 90,
            blockers: [],
            readyState: 'ready',
          },
        }),
      ),
    ).toBe('instant');
  });
});
