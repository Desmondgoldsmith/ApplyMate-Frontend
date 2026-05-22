import { describe, expect, it } from 'vitest';

import {
  humanizeScoreImprovementDetail,
  parseScoreImprovementGuide,
  scoreImprovementAxisLabel,
  shouldShowScoreImprovementGuide,
} from './scoreImprovement';

describe('scoreImprovement', () => {
  it('parses post-tailor guide with up to 3 advice items', () => {
    const guide = parseScoreImprovementGuide({
      currentScore: 55,
      scoreBeforeTailoring: 29,
      scoreDelta: 26,
      scoreBand: 'medium',
      headline: 'After tailoring, your match went from 29% to 55% (+26).',
      ceilingHint: 'Tailoring improved how your CV reads for this role.',
      items: [
        {
          id: 'experience-years',
          title: 'Years and scope of experience',
          detail: 'The job expects more relevant years.',
          axis: 'experience',
        },
        {
          id: 'role-mid-senior',
          title: 'Seniority / role level',
          detail: 'This role is framed as senior level.',
          axis: 'role_level',
        },
        {
          id: 'extra',
          title: 'Fourth item',
          detail: 'Should be dropped.',
          axis: 'evidence',
        },
      ],
    });

    expect(guide?.currentScore).toBe(55);
    expect(guide?.items).toHaveLength(3);
    expect(guide?.items[2]?.title).toBe('Fourth item');
    expect(shouldShowScoreImprovementGuide(guide)).toBe(true);
  });

  it('returns undefined when items empty', () => {
    expect(
      parseScoreImprovementGuide({
        headline: 'x',
        ceilingHint: 'y',
        items: [],
      }),
    ).toBeUndefined();
  });

  it('labels axes for advice-only rows', () => {
    expect(scoreImprovementAxisLabel('experience')).toBe('Needs experience');
    expect(scoreImprovementAxisLabel('role_level')).toBe('Outside your CV');
  });

  it('humanizes bare seniority tokens in detail copy', () => {
    const out = humanizeScoreImprovementDetail(
      'This role is framed as mid level; your CV reads as mid. Closing a large gap usually means more responsibility.',
    );
    expect(out).not.toMatch(/\breads as mid\b/i);
    expect(out).toMatch(/mid-level/i);
  });
});
