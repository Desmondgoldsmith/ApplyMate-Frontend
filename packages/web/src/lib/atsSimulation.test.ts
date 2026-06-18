import { describe, expect, it } from 'vitest';

import { dimensionScoreByHint, parseAtsSimulationReport } from '@/lib/atsSimulation';

describe('parseAtsSimulationReport', () => {
  it('returns undefined for null / non-object', () => {
    expect(parseAtsSimulationReport(null)).toBeUndefined();
    expect(parseAtsSimulationReport([])).toBeUndefined();
  });

  it('parses camelCase simulation payload', () => {
    const raw = {
      overallScore: 78,
      coveragePercent: 62,
      dimensions: {
        keywordMatch: { score0to100: 70, weight: 0.25, contribution: 17.5 },
        hardSkills: { score0to100: 55, weight: 0.2, contribution: 11 },
      },
      keywords: {
        required: { present: ['React'], missing: ['Kubernetes'] },
        preferred: { present: [], missing: ['GraphQL'] },
      },
      hardSkillMatches: [{ term: 'React', canonical: 'react', matched: true }],
      titleAlignmentScore: 80,
      seniorityAlignmentScore: 72,
      semanticSimilarityScore: 65,
      formattingParseabilityScore: 88,
      seniorityAlignment: {
        score0to100: 72,
        jobLevel: 'mid',
        cvLevel: 'mid',
        jobTitleNormalized: 'mid-level DevOps engineer',
        cvTitleNormalized: 'mid-level frontend engineer',
        detail:
          'The role is a mid-level DevOps engineer; your CV reads as a mid-level frontend engineer. Same experience band, but recruiters may look for DevOps-specific evidence.',
      },
      recommendations: ['Add metrics to experience bullets.'],
    };
    const r = parseAtsSimulationReport(raw);
    expect(r).toBeDefined();
    expect(r!.overallScore).toBe(78);
    expect(r!.coveragePercent).toBe(62);
    expect(r!.dimensions?.keywordMatch?.score0to100).toBe(70);
    expect(r!.keywords?.required?.missing).toEqual(['Kubernetes']);
    expect(r!.hardSkillMatches?.[0]?.matched).toBe(true);
    expect(r!.seniorityAlignment?.detail).toContain('DevOps');
    expect(r!.seniorityAlignmentScore).toBe(72);
    expect(r!.recommendations?.[0]).toContain('metrics');
  });

  it('accepts snake_case keys', () => {
    const r = parseAtsSimulationReport({
      overall_score: 50,
      coverage_percent: 40,
      hard_skill_matches: [{ term: 'Go', matched: false }],
      title_alignment_score: 60,
      seniority_alignment_score: 55,
      semantic_similarity_score: 48,
      formatting_parseability_score: 90,
    });
    expect(r!.overallScore).toBe(50);
    expect(r!.hardSkillMatches?.[0]?.matched).toBe(false);
    expect(r!.formattingParseabilityScore).toBe(90);
  });
});

describe('dimensionScoreByHint', () => {
  it('matches normalized dimension keys', () => {
    const d = { HardSkillMatch: { score0to100: 42, weight: 0.1, contribution: 4 } };
    expect(dimensionScoreByHint(d, ['hard', 'skill'])).toBe(42);
  });
});
