import { describe, expect, it } from 'vitest';

import {
  coerceStructuredTextInCvBuilderData,
  ensureCvPreviewData,
  type CVBuilderData,
} from './cvBuilder';

describe('ensureCvPreviewData', () => {
  it('coerces summary text from nested objects (no [object Object])', () => {
    const d = ensureCvPreviewData({
      personal: { name: 'N', email: 'e@e.com' },
      summary: { text: { text: 'Hello from nested' } as unknown as string },
    } as never);
    expect(d.summary.text).toBe('Hello from nested');
  });

  it('coerces headline from object shape', () => {
    const d = ensureCvPreviewData({
      personal: {
        name: 'N',
        email: 'e@e.com',
        headline: { content: 'Engineer' } as unknown as string,
      },
    } as never);
    expect(d.personal.headline).toBe('Engineer');
  });
});

describe('coerceStructuredTextInCvBuilderData', () => {
  it('extracts plain string from object-shaped experience title (assistant / API blobs)', () => {
    const d = coerceStructuredTextInCvBuilderData({
      personal: { name: 'N', email: 'e@e.com' },
      summary: { text: '' },
      experience: {
        items: [
          {
            id: '1',
            title: { text: 'Dev' } as unknown as string,
            company: 'Co',
            location: '',
            startDate: '',
            endDate: '',
            current: false,
            bullets: [],
          },
        ],
      },
      education: { items: [] },
      skills: { categories: [] },
      projects: [],
      certifications: [],
      languages: [],
      achievements: [],
      references: [],
      customSections: [],
      parsedCustomSections: [],
    } as unknown as CVBuilderData);
    expect(d.experience.items[0]?.title).toBe('Dev');
  });
});
