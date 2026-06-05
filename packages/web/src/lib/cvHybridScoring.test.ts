import { describe, expect, it } from 'vitest';

import {
  hybridOverallFormulaExample,
  hybridWeightsSummaryLine,
  hybridWeightsTooltip,
  hybridScoringFromScorePayload,
  isAiOriginSuggestionId,
  parseCvHybridScoring,
} from '@/lib/cvHybridScoring';

describe('cvHybridScoring', () => {
  it('parses hybrid scoring envelope fields', () => {
    const meta = parseCvHybridScoring({
      scoringMethod: 'hybrid',
      structuralScore: 62,
      aiScore: 78,
      aiCached: true,
      scoringTransparency: {
        headline: 'Your score blends structure and quality.',
        methods: {
          hybrid: { title: 'Hybrid', short: 'Structure plus AI quality review.' },
          rubric_only: {
            title: 'Structure only',
            short: 'Quality review unavailable — structure check only.',
          },
        },
        structural: { title: 'Structure', short: 'Checks sections and completeness.' },
        ai: { title: 'Quality', short: 'Eval model reviews writing quality.' },
        weights: { structuralPercent: 30, aiPercent: 70, short: '30/70 blend.' },
        cache: { title: 'Cache', short: 'Reused from the last 24 hours.' },
        jobContext: { title: 'Job', short: 'Optional job context.' },
      },
      aiAssessment: {
        summary: 'Strong impact bullets; tighten summary.',
        dimensions: {
          clarity: { score: 80, note: 'Clear roles' },
        },
      },
    });
    expect(meta?.scoringMethod).toBe('hybrid');
    expect(meta?.structuralScore).toBe(62);
    expect(meta?.aiScore).toBe(78);
    expect(meta?.aiCached).toBe(true);
    expect(meta?.scoringTransparency?.methods.hybrid.short).toContain('AI quality');
    expect(meta?.aiAssessment?.summary).toContain('Strong impact');
    expect(meta?.aiBreakdownAvailable).toBe(true);
    expect(meta?.atsMode).toBe('ai');
  });

  it('infers rubric_only when AI score is absent', () => {
    const meta = parseCvHybridScoring({
      scoringMethod: 'rubric_only',
      structuralScore: 55,
      aiScore: null,
    });
    expect(meta?.scoringMethod).toBe('rubric_only');
    expect(meta?.aiScore).toBeNull();
    expect(meta?.aiBreakdownAvailable).toBe(false);
    expect(meta?.atsMode).toBe('heuristic');
  });

  it('honors explicit aiBreakdownAvailable and atsMode flags', () => {
    const meta = parseCvHybridScoring({
      scoringMethod: 'hybrid',
      structuralScore: 72,
      aiScore: null,
      aiBreakdownAvailable: false,
      atsMode: 'heuristic',
    });
    expect(meta?.aiBreakdownAvailable).toBe(false);
    expect(meta?.atsMode).toBe('heuristic');
  });

  it('reads hybrid fields from score payload', () => {
    const meta = hybridScoringFromScorePayload({
      score: 73,
      scoringMethod: 'hybrid',
      structuralScore: 62,
      aiScore: 78,
      aiCached: false,
      scoringTransparency: null,
      aiAssessment: null,
    });
    expect(meta?.structuralScore).toBe(62);
  });

  it('detects AI-origin suggestion ids', () => {
    expect(isAiOriginSuggestionId('ai_q_summary_1')).toBe(true);
    expect(isAiOriginSuggestionId('rubric_1')).toBe(false);
  });

  it('formats blend weights copy and formula example for UI', () => {
    expect(hybridWeightsSummaryLine(30, 70)).toBe('30% structure · 70% quality');
    expect(hybridWeightsTooltip(30, 70, null)).toContain('scoringTransparency.weights');
    expect(hybridWeightsTooltip(30, 70, 'Custom weights from API.')).toMatch(
      /^Custom weights from API\./,
    );
    expect(hybridOverallFormulaExample(75, 79, 30, 70, 78)).toBe(
      '78 ≈ 30% × 75 + 70% × 79',
    );
  });
});
