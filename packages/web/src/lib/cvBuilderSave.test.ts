import { describe, expect, it } from 'vitest';

import type { CVSectionRecord } from '@/lib/api';
import {
  computeCvBuilderSaveFingerprint,
  stableStringify,
  type CVBuilderData,
} from '@/lib/cvBuilder';

const minimalData = (): CVBuilderData => ({
  personal: {
    name: 'A',
    email: 'a@b.co',
    phone: '',
    location: '',
    headline: 'Dev',
    extras: [],
  },
  summary: { text: 'Hi' },
  experience: { items: [] },
  education: { items: [] },
  skills: { categories: [] },
  projects: [],
  certifications: [],
  languages: [],
  achievements: [],
  references: [],
  customSections: [],
  parsedCustomSections: [],
});

const minimalSections = (): CVSectionRecord[] => [
  { id: 's1', type: 'summary', order: 0, hidden: false },
  { id: 'e1', type: 'experience', order: 1, hidden: false },
  { id: 'ed1', type: 'education', order: 2, hidden: false },
  { id: 'sk1', type: 'skills', order: 3, hidden: false },
];

describe('stableStringify', () => {
  it('is order-independent for object keys', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });
});

describe('computeCvBuilderSaveFingerprint', () => {
  it('matches for identical builder state', () => {
    const d = minimalData();
    const s = minimalSections();
    const a = computeCvBuilderSaveFingerprint(d, 'modern', s);
    const b = computeCvBuilderSaveFingerprint(d, 'modern', s);
    expect(a).toBe(b);
  });

  it('changes when summary text changes', () => {
    const s = minimalSections();
    const a = computeCvBuilderSaveFingerprint(minimalData(), 'modern', s);
    const b = computeCvBuilderSaveFingerprint({ ...minimalData(), summary: { text: 'Bye' } }, 'modern', s);
    expect(a).not.toBe(b);
  });
});
