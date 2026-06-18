import { describe, expect, it } from 'vitest';

import {
  formatExperienceRoleLabel,
  parseTailorExperienceItems,
  resolveExperienceRoleLabelsFromChangedFields,
} from '@/lib/tailorChangeContext';

describe('tailorChangeContext', () => {
  it('parses experience items from structured JSON', () => {
    const items = parseTailorExperienceItems(
      JSON.stringify({
        items: [
          {
            title: 'Frontend Developer',
            company: 'Dummy Group',
            startDate: 'Jul 2024',
            endDate: 'Dec 2025',
            bullets: ['Built UI'],
          },
        ],
      }),
    );
    expect(items).toHaveLength(1);
    expect(formatExperienceRoleLabel(items[0]!)).toBe(
      'Frontend Developer at Dummy Group (Jul 2024 – Dec 2025)',
    );
  });

  it('resolves role labels from changed field paths', () => {
    const after = JSON.stringify({
      items: [
        { title: 'Frontend Developer', company: 'Dummy Group', bullets: ['New bullet'] },
        { title: 'Software Engineer', company: 'Google', bullets: ['Another bullet'] },
      ],
    });
    const labels = resolveExperienceRoleLabelsFromChangedFields(
      ['items[0].bullets[2]', 'items[1].bullets[0]'],
      '',
      after,
    );
    expect(labels).toEqual([
      'Frontend Developer at Dummy Group',
      'Software Engineer at Google',
    ]);
  });

  it('prefers backend roleLabel when present', () => {
    const items = parseTailorExperienceItems(
      JSON.stringify({
        items: [
          {
            title: 'Frontend Developer',
            company: 'Dummy Group',
            roleLabel: 'Frontend Developer at Dummy Group (Jul 2024 – Dec 2025)',
            bullets: ['Built UI'],
          },
        ],
      }),
    );
    expect(formatExperienceRoleLabel(items[0]!)).toBe(
      'Frontend Developer at Dummy Group (Jul 2024 – Dec 2025)',
    );
  });
});
