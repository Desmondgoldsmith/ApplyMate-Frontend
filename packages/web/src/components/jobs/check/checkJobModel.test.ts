import { describe, expect, it } from 'vitest';

import type { CvTailorDraftEntry, JobAnalysis } from '@/lib/api';

import {
  changeHeadline,
  changeLines,
  isSkillLike,
  looksLikeLink,
  matchSentence,
  requirementRows,
  scoreLift,
  verdictFor,
} from './checkJobModel';

describe('looksLikeLink', () => {
  it('tells a pasted link from pasted job text', () => {
    expect(looksLikeLink('https://jobs.lever.co/acme/123')).toBe(true);
    expect(looksLikeLink('www.monzo.com/careers/123')).toBe(true);
    expect(looksLikeLink('boards.greenhouse.io/stripe/jobs/1')).toBe(true);
    expect(looksLikeLink('We are hiring a frontend engineer')).toBe(false);
    expect(looksLikeLink('React')).toBe(false);
  });
});

describe('verdictFor', () => {
  it('uses plain words for the score', () => {
    expect(verdictFor(86).label).toBe('Strong match');
    expect(verdictFor(70).label).toBe('Good match');
    expect(verdictFor(55).label).toBe('Fair match');
    expect(verdictFor(30).label).toBe('Long shot');
  });
});

describe('requirementRows', () => {
  const analysis = {
    matchScore: 66,
    skillCoverage: [
      {
        skill: 'React',
        status: 'found',
        importance: 'CRITICAL',
        tier: 'required',
      },
      {
        skill: 'GraphQL',
        status: 'missing',
        importance: 'HIGH',
        tier: 'required',
      },
      {
        skill: 'Cypress',
        status: 'missing',
        importance: 'MEDIUM',
        tier: 'preferred',
      },
      {
        skill: 'Vue',
        status: 'missing',
        importance: 'HIGH',
        tier: 'required',
        orGroupId: 'fw',
      },
      {
        skill: 'Next.js',
        status: 'found',
        importance: 'HIGH',
        tier: 'required',
        orGroupId: 'fw',
      },
      { skill: 'react', status: 'found', importance: 'LOW', tier: 'mentioned' },
    ],
  } as JobAnalysis;

  it('lists what is missing first, required before nice-to-have, without repeats', () => {
    expect(requirementRows(analysis).map((r) => [r.label, r.have])).toEqual([
      ['GraphQL', false],
      ['Cypress', false],
      ['React', true],
      ['Next.js', true],
    ]);
  });

  it('drops a missing option when another option of the group is on the CV', () => {
    expect(requirementRows(analysis).some((r) => r.label === 'Vue')).toBe(
      false,
    );
  });

  it('says how many things the CV shows', () => {
    expect(matchSentence(requirementRows(analysis))).toBe(
      'Your CV shows 2 of the 4 things they ask for.',
    );
    expect(matchSentence([])).toBeNull();
  });

  it('only lists things that can sit in a Skills list', () => {
    const rows = requirementRows({
      matchScore: 90,
      skillCoverage: [
        {
          skill: '5+ years of relevant web front-end development experience',
          status: 'missing',
          importance: 'HIGH',
          tier: 'required',
          requirementKind: 'phrase',
        },
        {
          skill: 'Passion for engineering solutions focused around growth',
          status: 'missing',
          importance: 'HIGH',
          tier: 'required',
          requirementKind: 'phrase',
        },
        {
          skill: 'Design systems',
          status: 'missing',
          importance: 'MEDIUM',
          tier: 'preferred',
          requirementKind: 'phrase',
        },
        {
          skill: 'GraphQL',
          status: 'missing',
          importance: 'HIGH',
          tier: 'required',
          requirementKind: 'tool',
        },
      ],
    } as JobAnalysis);
    expect(rows.map((r) => r.label)).toEqual(['GraphQL', 'Design systems']);
    expect(isSkillLike('Strong communication skills')).toBe(false);
    expect(isSkillLike('Debugging skills')).toBe(false);
    expect(isSkillLike('Collaboration')).toBe(false);
    expect(isSkillLike('React Native')).toBe(true);
    expect(isSkillLike('HTML5')).toBe(true);
    expect(isSkillLike('AWS S3')).toBe(true);
  });

  it('falls back to missing skills on older analyses', () => {
    expect(
      requirementRows({
        matchScore: 50,
        missingSkills: [{ name: 'AWS', importance: 'HIGH' }],
      } as JobAnalysis),
    ).toEqual([{ key: 'aws', label: 'AWS', have: false, required: true }]);
  });
});

describe('changeHeadline', () => {
  const entry = (over: Partial<CvTailorDraftEntry>) =>
    ({
      sectionId: 's',
      sectionType: 'summary',
      before: '',
      after: '',
      status: 'accepted',
      changedFields: [],
      ...over,
    }) as CvTailorDraftEntry;

  it('describes each change in one plain line, from the stored before and after', () => {
    expect(
      changeHeadline(
        entry({
          sectionType: 'skills',
          before: JSON.stringify(['React']),
          after: JSON.stringify(['React', 'GraphQL']),
        }),
      ),
    ).toBe('Added GraphQL');
    expect(changeHeadline(entry({ sectionType: 'summary' }))).toBe(
      'Rewrote it for this job',
    );
    const experience = entry({
      sectionType: 'experience',
      before: JSON.stringify({
        items: [
          {
            title: 'Dev',
            company: 'Hubtel',
            bullets: ['fixed bugs', 'built dashboard'],
          },
        ],
      }),
      after: JSON.stringify({
        items: [
          {
            title: 'Dev',
            company: 'Hubtel',
            bullets: ['Resolved checkout bugs', 'built dashboard'],
          },
        ],
      }),
    });
    expect(changeHeadline(experience)).toBe(
      'Reworded 1 bullet to match the job',
    );
    expect(changeLines(experience)).toEqual({
      before: ['fixed bugs'],
      after: ['Resolved checkout bugs'],
    });
  });
});

describe('scoreLift', () => {
  it('is the rounded points gained, or null without both scores', () => {
    expect(scoreLift(66, 84.4)).toBe(18);
    expect(scoreLift(null, 80)).toBeNull();
  });
});
