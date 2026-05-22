import { describe, expect, it } from 'vitest';

import {
  resolveInterviewDisplayScore,
  scoreFromInterviewSession,
  scoreFromProgressTrendPoint,
} from './interviewDisplayScore';

describe('interviewDisplayScore', () => {
  it('prefers readiness over overall and composite', () => {
    expect(
      resolveInterviewDisplayScore({
        readinessScore: 72,
        overallScore: 41,
        compositeScore: 39,
      }),
    ).toBe(72);
  });

  it('falls back to overall then composite when readiness is missing', () => {
    expect(resolveInterviewDisplayScore({ overallScore: 55, compositeScore: 39 })).toBe(55);
    expect(resolveInterviewDisplayScore({ compositeScore: 39 })).toBe(39);
  });

  it('reads readiness from session result', () => {
    expect(
      scoreFromInterviewSession({
        overallScore: 23,
        readinessScore: undefined,
        result: { readinessScore: 61, overallScore: 23 } as never,
      }),
    ).toBe(61);
  });

  it('matches progress point resolution order', () => {
    expect(
      scoreFromProgressTrendPoint({
        sessionId: 's1',
        compositeScore: 39,
        readinessScore: 43,
        capturedAt: '2026-05-20T12:00:00.000Z',
      }),
    ).toBe(43);
  });
});
