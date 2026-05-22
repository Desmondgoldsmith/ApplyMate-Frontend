import { describe, expect, it } from 'vitest';

import { formatSearchContextBanner, searchContextSourcePhrase } from '@/lib/jobBoardSearchContext';

describe('jobBoardSearchContext', () => {
  it('maps known location sources to readable phrases', () => {
    expect(searchContextSourcePhrase('saved_preference')).toBe('from your saved preference');
    expect(searchContextSourcePhrase('ip_detected')).toBe('from your detected location');
    expect(searchContextSourcePhrase('unknown')).toBe('for this search');
  });

  it('formats banner with role query when present', () => {
    expect(
      formatSearchContextBanner({
        locationLabel: 'Accra, Ghana',
        locationSource: 'saved_preference',
        roleQuery: 'software engineer',
      }),
    ).toBe('Showing software engineer roles near Accra, Ghana (from your saved preference).');
  });

  it('returns null when location label is empty', () => {
    expect(formatSearchContextBanner({ locationLabel: '  ' })).toBeNull();
  });
});
