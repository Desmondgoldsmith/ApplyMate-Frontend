import { describe, expect, it, vi } from 'vitest';

import { parseJobMatchFactorsBreakdown } from '@/lib/jobMatchFactorsBreakdown';

describe('parseJobMatchFactorsBreakdown', () => {
  it('parses six factors including evidence strength in canonical order', () => {
    const parsed = parseJobMatchFactorsBreakdown({
      factors: [
        {
          key: 'evidenceStrength',
          label: 'Evidence strength',
          score: 84,
          hint: 'Quantified outcomes and proof depth.',
          explanation: 'Solid proof depth for this role.',
        },
        {
          key: 'skillsMatch',
          label: 'How well your experience matches what this role needs',
          score: 56,
          explanation: '5 of 9 requirements demonstrated.',
          found: ['React'],
          missing: ['Cypress'],
        },
        {
          key: 'keywordCoverage',
          label: 'How ATS-friendly your CV is for this role',
          score: 56,
          explanation: '5 of 9 exact phrases appear in your CV.',
          missingExplanation: 'Semantic fit without verbatim JD phrases.',
          foundCount: 5,
          totalCount: 9,
        },
      ],
    });
    expect(parsed?.factors.map((f) => f.key)).toEqual([
      'skillsMatch',
      'keywordCoverage',
      'evidenceStrength',
    ]);
    expect(parsed?.factors[0]?.found).toEqual(['React']);
    expect(parsed?.factors[0]?.missing).toEqual(['Cypress']);
    expect(parsed?.factors[1]?.missingExplanation).toContain('Semantic fit');
    expect(parsed?.factors[2]?.hint).toContain('Quantified');
  });

  it('falls back to the backend wording when a factor has no label', () => {
    const parsed = parseJobMatchFactorsBreakdown({
      factors: [
        { key: 'skillsMatch', score: 70 },
        { key: 'experienceMatch', score: 60 },
        { key: 'keywordCoverage', score: 50 },
        { key: 'seniorityAlignment', score: 40 },
        { key: 'industryRelevance', score: 30 },
        { key: 'evidenceStrength', score: 20 },
      ],
    });
    expect(parsed?.factors.map((f) => f.label)).toEqual([
      'How well your experience matches what this role needs',
      'Years of experience',
      'How ATS-friendly your CV is for this role',
      'CV level',
      'Industry fit',
      'Evidence strength',
    ]);
  });

  it('resolveFactorSkillLists uses API arrays only, not explanation prose', async () => {
    const { resolveFactorSkillLists } =
      await import('@/lib/jobMatchFactorsBreakdown');
    const lists = resolveFactorSkillLists({
      key: 'skillsMatch',
      label: 'How well your experience matches what this role needs',
      score: 40,
      explanation:
        'Typescript. Missing from CV: Rust, Playwright. Requirements found: React',
      found: ['React'],
      missing: ['GitLab'],
    });
    expect(lists.found).toEqual(['React']);
    expect(lists.missing).toEqual(['GitLab']);
  });

  it('returns null for empty payload', () => {
    expect(parseJobMatchFactorsBreakdown(null)).toBeNull();
    expect(parseJobMatchFactorsBreakdown({ factors: [] })).toBeNull();
  });

  it('warnFactorScoreInconsistency logs when found chips exist but score is 0', async () => {
    const { warnFactorScoreInconsistency } =
      await import('@/lib/jobMatchFactorsBreakdown');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnFactorScoreInconsistency({
      key: 'skillsMatch',
      label: 'How well your experience matches what this role needs',
      score: 0,
      explanation: '1 of 1 tools appear in your CV.',
      found: ['Python'],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skillsMatch'));
    warn.mockRestore();
  });
});
