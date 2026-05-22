import { describe, expect, it } from 'vitest';

import { formatInterviewChartDate, toInterviewChartPoints } from './interviewChartData';
import type { ProgressTrendPoint } from './interview-prep-types';

describe('interviewChartData', () => {
  it('sorts points chronologically and formats dates', () => {
    const points: ProgressTrendPoint[] = [
      {
        sessionId: 'b',
        compositeScore: 39,
        readinessScore: 39,
        capturedAt: '2026-05-20T12:00:00.000Z',
      },
      {
        sessionId: 'a',
        compositeScore: 43,
        readinessScore: 43,
        capturedAt: '2026-05-18T12:00:00.000Z',
      },
    ];

    const chart = toInterviewChartPoints(points);
    expect(chart[0]!.sessionId).toBe('a');
    expect(chart[1]!.score).toBe(39);
    expect(chart[0]!.dateLabel).toBe(formatInterviewChartDate('2026-05-18T12:00:00.000Z'));
  });

  it('uses readiness score when it differs from composite', () => {
    const chart = toInterviewChartPoints([
      {
        sessionId: 's1',
        compositeScore: 23,
        readinessScore: 61,
        capturedAt: '2026-05-20T12:00:00.000Z',
      },
    ]);
    expect(chart[0]!.score).toBe(61);
  });

  it('marks current session when provided', () => {
    const points: ProgressTrendPoint[] = [
      {
        sessionId: 's1',
        compositeScore: 20,
        readinessScore: 20,
        capturedAt: '2026-05-10T12:00:00.000Z',
      },
      {
        sessionId: 's2',
        compositeScore: 30,
        readinessScore: 30,
        capturedAt: '2026-05-12T12:00:00.000Z',
      },
    ];

    const chart = toInterviewChartPoints(points, { currentSessionId: 's2' });
    expect(chart[1]!.isCurrent).toBe(true);
    expect(chart[0]!.isCurrent).toBeFalsy();
  });
});
