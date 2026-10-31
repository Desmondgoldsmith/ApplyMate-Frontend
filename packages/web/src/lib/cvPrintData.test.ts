import { describe, expect, it } from 'vitest';

import { emptyCVBuilderData, type CVBuilderData } from '@/lib/cvBuilder';

import { cvDataForPrint } from './cvPrintData';

describe('cvDataForPrint', () => {
  it('drops rows the user never filled in and keeps real ones', () => {
    const base = emptyCVBuilderData({ name: 'Jordan', email: 'j@example.com' });
    const data = {
      ...base,
      projects: [
        {
          id: 'p1',
          name: '',
          description: '<p></p>',
          url: '',
          tech: [],
          bullets: [''],
        },
        {
          id: 'p2',
          name: 'Design system',
          description: '',
          url: '',
          tech: [],
          bullets: [],
        },
      ],
      certifications: [{ id: 'c1', name: '', issuer: '', date: '' }],
    } as unknown as CVBuilderData;

    const out = cvDataForPrint(data);

    expect(out.projects.map((p) => (p as { name: string }).name)).toEqual([
      'Design system',
    ]);
    expect(out.certifications).toHaveLength(0);
    expect(out.personal.name).toBe('Jordan');
  });
});
