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
        interviewRisks: ['Kotlin gap', 'Gap 2', 'Gap 3', 'Gap 4', 'Gap 5', 'Gap 6', 'Gap 7'],
        missingEvidence: ['Team size'],
        salaryRange: '$120k – $140k',
      },
      axisMeta: [
        {
          key: 'skillMatch',
          label: 'Skill match',
          description: 'Overlap between required job skills and your CV.',
        },
      ],
      applyStrategy: 'APPLY_NOW',
    });
    expect(v2?.recruiterVerdict).toBe('STRONG');
    expect(v2?.axes.skillMatch).toBe(82);
    expect(v2?.attackPlan.topCVFixes).toHaveLength(1);
    expect(v2?.attackPlan.interviewRisks).toHaveLength(6);
    expect(v2?.axisMeta?.[0]?.description).toContain('Overlap');
    expect(v2?.applyStrategy).toBe('APPLY_NOW');
  });

  it('returns undefined for invalid payload', () => {
    expect(parseJobAnalysisV2({ recruiterVerdict: 'MAYBE' })).toBeUndefined();
  });
});
