import { describe, expect, it } from 'vitest';

import {
  buildSectionExplainerFallback,
  parseCvSectionScoreExplainer,
  parseSectionScoreWithExplainer,
} from '@/lib/cvSectionScoreExplainer';

describe('cvSectionScoreExplainer', () => {
  it('parses nested explainer on section payload', () => {
    const section = parseSectionScoreWithExplainer({
      score: 56,
      weight: 0.25,
      feedback: 'Bullets lack metrics.',
      explainer: {
        whatItMeans: 'Experience shows your work history.',
        whyThisScore: 'Few quantified outcomes.',
        howToImprove: 'Add metrics to top roles.',
        suggestionId: 'sug-exp-1',
      },
      flags: [],
    });
    expect(section.score).toBe(56);
    expect(section.explainer?.suggestionId).toBe('sug-exp-1');
    expect(section.explainer?.howToImprove).toContain('metrics');
  });

  it('builds fallback from feedback and matched improvement', () => {
    const explainer = buildSectionExplainerFallback(
      { score: 40, weight: 0.2, feedback: 'Thin skills list.', flags: [] },
      'skills',
      [
        {
          id: 'ai_q_skills_1',
          section: 'skills',
          issue: 'Missing cloud tools',
          suggestion: 'List AWS and Terraform.',
        },
      ],
    );
    expect(explainer?.suggestionId).toBe('ai_q_skills_1');
    expect(explainer?.whyThisScore).toContain('Thin skills');
  });

  it('parses standalone explainer object', () => {
    const e = parseCvSectionScoreExplainer({
      what_it_means: 'Summary introduces you.',
      why_this_score: 'Too generic.',
      how_to_improve: 'Tailor to target role.',
    });
    expect(e?.whatItMeans).toContain('introduces');
  });
});
