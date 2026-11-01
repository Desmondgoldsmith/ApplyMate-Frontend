import { describe, expect, it } from 'vitest';

import { hubFilterFromQuery, stageMatchesFilter } from './jobHubMerge';

describe('Job Hub filter from a link', () => {
  it('reads the Home groups and single stages, and ignores anything else', () => {
    expect(hubFilterFromQuery('saved')).toBe('saved');
    expect(hubFilterFromQuery('Offers')).toBe('offers');
    expect(hubFilterFromQuery('interviewing')).toBe('interviewing');
    expect(hubFilterFromQuery('nonsense')).toBe('all');
    expect(hubFilterFromQuery(null)).toBe('all');
  });

  it('matches every stage in a group, so the count on Home is what you see', () => {
    expect(stageMatchesFilter('bookmarked', 'saved')).toBe(true);
    expect(stageMatchesFilter('analyzed', 'saved')).toBe(true);
    expect(stageMatchesFilter('applied', 'saved')).toBe(false);
    expect(stageMatchesFilter('negotiating', 'offers')).toBe(true);
    expect(stageMatchesFilter('applied', 'applied')).toBe(true);
    expect(stageMatchesFilter('rejected', 'all')).toBe(true);
  });
});
