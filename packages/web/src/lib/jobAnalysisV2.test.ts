import { describe, expect, it } from 'vitest';

import { parseJobAnalysisV2 } from '@/lib/jobAnalysisV2';

describe('parseJobAnalysisV2', () => {
  it('parses full analysisV2 payload', () => {
    const v2 = parseJobAnalysisV2({
      recruiterVerdict: 'STRONG',
      axes: {
        skillMatch: 82,
        experienceFit: 74,
        industryFit: 68,
        evidenceStrength: 71,
      },
      attackPlan: {
        topCVFixes: ['Lead with React delivery metrics'],
        interviewRisks: ['Kotlin gap'],
        missingEvidence: ['Team size'],
        salaryRange: '$120k – $140k',
      },
      applyStrategy: 'APPLY_NOW',
    });
    expect(v2?.recruiterVerdict).toBe('STRONG');
    expect(v2?.axes.skillMatch).toBe(82);
    expect(v2?.attackPlan.topCVFixes).toHaveLength(1);
    expect(v2?.applyStrategy).toBe('APPLY_NOW');
  });

  it('returns undefined for invalid payload', () => {
    expect(parseJobAnalysisV2({ recruiterVerdict: 'MAYBE' })).toBeUndefined();
  });
});
