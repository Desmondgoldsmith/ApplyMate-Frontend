import { describe, expect, it } from 'vitest';

import { cvChangeEntryIndex } from '@/components/cv/templates/cvTemplateSectionBox';

describe('cvChangeEntryIndex', () => {
  it('reads the entry a change belongs to', () => {
    expect(cvChangeEntryIndex('experience[1].bullets[3]')).toBe(1);
    expect(cvChangeEntryIndex('experience.2.title')).toBe(2);
    expect(cvChangeEntryIndex('education[0].degree')).toBe(0);
    expect(cvChangeEntryIndex('projects.items[4].description')).toBe(4);
  });

  it('returns null for section-wide changes', () => {
    expect(cvChangeEntryIndex('summary')).toBeNull();
    expect(cvChangeEntryIndex('skills[2]')).toBeNull();
    expect(cvChangeEntryIndex('experience')).toBeNull();
    expect(cvChangeEntryIndex('Experience · Bullet 4')).toBeNull();
  });
});
