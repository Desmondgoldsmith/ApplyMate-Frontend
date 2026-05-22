import { describe, expect, it } from 'vitest';

import {
  buildLineDiff,
  buildOrderedWordDiff,
  buildTailorSectionChanges,
  extractSkillList,
} from '@/lib/cvTailorDiff';

describe('cvTailorDiff', () => {
  it('marks added and removed lines', () => {
    const lines = buildLineDiff('React, Next.js', 'React, Next.js, Kotlin');
    expect(lines.some((l) => l.type === 'removed' && l.text.includes('React'))).toBe(true);
    expect(lines.some((l) => l.type === 'added' && l.text.includes('Kotlin'))).toBe(true);
  });

  it('builds skill swap hunks', () => {
    const before = JSON.stringify({ skills: ['React', 'TypeScript'] });
    const after = JSON.stringify({ skills: ['React', 'TypeScript', 'Kubernetes'] });
    const hunks = buildTailorSectionChanges('skills', before, after, []);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.kind).toBe('skills');
    if (hunks[0]?.kind === 'skills') {
      expect(hunks[0].added).toContain('Kubernetes');
      expect(hunks[0].removed).toHaveLength(0);
    }
  });

  it('extracts flat skill list', () => {
    expect(extractSkillList({ skills: ['A', 'B'] })).toEqual(['A', 'B']);
  });

  it('ordered word diff keeps context words', () => {
    const tokens = buildOrderedWordDiff('I build apps', 'I build great apps');
    expect(tokens.some((t) => t.type === 'same' && t.text === 'I')).toBe(true);
    expect(tokens.some((t) => t.type === 'added' && t.text === 'great')).toBe(true);
  });
});
