import { describe, expect, it } from 'vitest';

import {
  optionKeyFromBackendType,
  rowMatchesSection,
} from '@/components/cv/AddSectionModal';
import type { CVSectionRecord } from '@/lib/api';

const row = (type: string, title?: string): CVSectionRecord =>
  ({
    id: type,
    type,
    order: 1,
    hidden: true,
    data: title ? { title, items: [] } : { items: [] },
  }) as unknown as CVSectionRecord;

describe('Add section matching', () => {
  it('maps numbered custom rows to their option', () => {
    expect(optionKeyFromBackendType('custom_interests_0')).toBe('interests');
    expect(optionKeyFromBackendType('custom_volunteering_2')).toBe(
      'volunteering',
    );
    expect(optionKeyFromBackendType('custom_hobbies_0')).toBe('custom');
  });

  it('does not treat another hidden custom section as the one being added', () => {
    expect(
      rowMatchesSection(
        row('custom_volunteer_work_0', 'Volunteer work'),
        'custom',
        'Hobbies',
      ),
    ).toBe(false);
  });

  it('matches a custom section with the same name', () => {
    expect(
      rowMatchesSection(
        row('custom_hobbies_0', 'Hobbies'),
        'custom',
        'hobbies',
      ),
    ).toBe(true);
    expect(
      rowMatchesSection(row('custom_hobbies_1'), 'custom', 'Hobbies'),
    ).toBe(true);
  });

  it('matches built-in options by type', () => {
    expect(rowMatchesSection(row('languages'), 'languages', '')).toBe(true);
    expect(rowMatchesSection(row('languages'), 'references', '')).toBe(false);
  });
});
