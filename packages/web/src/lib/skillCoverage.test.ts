import { describe, expect, it } from 'vitest';

import type { JobAnalysis } from '@/lib/api';
import {
  getGapDisplaySkills,
  getTailorChecklistSkills,
  isPrimaryGapCoverageItem,
  satisfiedOrGroupIds,
} from '@/lib/skillCoverage';

describe('skillCoverage gap quality', () => {
  it('treats satisfied OR siblings as non-primary gaps', () => {
    const items = [
      { skill: 'React', status: 'found' as const, importance: 'HIGH' as const, orGroupId: 'or_1' },
      { skill: 'Vue', status: 'missing' as const, importance: 'HIGH' as const, orGroupId: 'or_1', tier: 'preferred' as const },
    ];
    const satisfied = satisfiedOrGroupIds(items);
    expect(satisfied.has('or_1')).toBe(true);
    expect(isPrimaryGapCoverageItem(items[1], satisfied)).toBe(false);
  });

  it('returns empty gaps when missingSkills is absent (no client-side inference)', () => {
    const analysis = {
      matchScore: 70,
      skillCoverage: [
        { skill: 'TypeScript', status: 'missing', importance: 'HIGH', tier: 'required' },
        { skill: 'web development', status: 'missing', importance: 'LOW', tier: 'mentioned' },
      ],
    } satisfies JobAnalysis;
    expect(getGapDisplaySkills(analysis)).toEqual([]);
  });

  it('renders full missingSkills list from API without truncation', () => {
    const gaps = Array.from({ length: 7 }, (_, i) => ({
      name: `Gap ${i + 1}`,
      importance: 'HIGH' as const,
      tier: 'required' as const,
      requirementKind: i % 2 === 0 ? ('tool' as const) : ('phrase' as const),
    }));
    const analysis = { matchScore: 50, missingSkills: gaps } satisfies JobAnalysis;
    expect(getGapDisplaySkills(analysis)).toHaveLength(7);
  });

  it('shows no gaps when German OR group is satisfied (empty missingSkills)', () => {
    const analysis = {
      matchScore: 78,
      missingSkills: [],
      skillCoverage: [
        {
          skill: 'React',
          status: 'found',
          importance: 'HIGH',
          tier: 'required',
          orGroupId: 'auto_or_0',
        },
        {
          skill: 'Vue.js',
          status: 'found',
          importance: 'MEDIUM',
          tier: 'preferred',
          orGroupId: 'auto_or_0',
        },
        {
          skill: 'Angular',
          status: 'found',
          importance: 'MEDIUM',
          tier: 'preferred',
          orGroupId: 'auto_or_0',
        },
      ],
    } satisfies JobAnalysis;
    expect(getGapDisplaySkills(analysis)).toEqual([]);
    expect(getTailorChecklistSkills(analysis)).toEqual([]);
  });

  it('prefers server missingSkills when present', () => {
    const analysis = {
      matchScore: 70,
      missingSkills: [{ name: 'GraphQL', importance: 'HIGH' }],
      skillCoverage: [
        { skill: 'GraphQL', status: 'missing', importance: 'HIGH' },
        { skill: 'Vue', status: 'missing', importance: 'HIGH' },
      ],
    } satisfies JobAnalysis;
    expect(getTailorChecklistSkills(analysis).map((g) => g.name)).toEqual(['GraphQL']);
  });
});
