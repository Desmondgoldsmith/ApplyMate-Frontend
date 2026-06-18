import { describe, expect, it } from 'vitest';

import type { JobAnalysis } from '@/lib/api';
import {
  historyItemHasCompletedAnalysis,
  isCompletedJobAnalysis,
} from '@/lib/jobAnalysisComplete';

describe('isCompletedJobAnalysis', () => {
  it('returns false for heuristic bookmark placeholders', () => {
    const analysis: JobAnalysis = {
      matchScore: 0,
      scoreSource: 'heuristic',
    };
    expect(isCompletedJobAnalysis(analysis)).toBe(false);
  });

  it('returns true for AI-scored jobs', () => {
    const analysis: JobAnalysis = {
      matchScore: 42,
      scoreSource: 'ai',
    };
    expect(isCompletedJobAnalysis(analysis)).toBe(true);
  });

  it('returns true for gemini-scored jobs', () => {
    const analysis: JobAnalysis = {
      matchScore: 55,
      scoreSource: 'gemini',
    };
    expect(isCompletedJobAnalysis(analysis)).toBe(true);
  });

  it('returns false when skill coverage exists without AI (extension CV score)', () => {
    const analysis: JobAnalysis = {
      matchScore: 0,
      hasAnalysis: false,
      skillCoverage: [{ skill: 'React', status: 'found', importance: 'HIGH' }],
    };
    expect(isCompletedJobAnalysis(analysis)).toBe(false);
  });

  it('respects explicit hasAnalysis from API', () => {
    expect(
      isCompletedJobAnalysis({
        matchScore: 72,
        hasAnalysis: false,
        scoreSource: 'heuristic',
      }),
    ).toBe(false);
  });
});

describe('historyItemHasCompletedAnalysis', () => {
  it('returns false for bookmark-only extension saves', () => {
    expect(
      historyItemHasCompletedAnalysis({
        hasAnalysis: false,
        analyzeSource: null,
        matchScore: null,
        recommendation: null,
      }),
    ).toBe(false);
  });

  it('returns true after real AI analyze', () => {
    expect(
      historyItemHasCompletedAnalysis({
        hasAnalysis: true,
        analyzeSource: 'ai',
        matchScore: 78,
        recommendation: 'GOOD_MATCH',
      }),
    ).toBe(true);
  });
});
