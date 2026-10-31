import { describe, expect, it } from 'vitest';

import { emptyCVBuilderData, type CVBuilderData } from '@/lib/cvBuilder';

import { cvDataForPrint, printSectionVisibility } from './cvPrintData';

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

  it('never prints a section that only has a heading', () => {
    const base = emptyCVBuilderData();
    const data: CVBuilderData = {
      ...base,
      customSections: [{ id: 'c1', title: 'Awards', body: '<p> </p>' }],
      parsedCustomSections: [
        {
          sectionId: 's1',
          sectionType: 'custom_talks',
          title: 'Talks',
          items: [],
        },
        {
          sectionId: 's2',
          sectionType: 'custom_hobbies',
          title: 'Hobbies',
          items: [{ id: 'i1', text: 'Chess', subItems: [] }],
        },
      ],
      skills: { categories: [{ id: 'k1', name: 'Tools', skills: [''] }] },
    } as CVBuilderData;

    const out = cvDataForPrint(data);
    const visible = printSectionVisibility(out, {});

    expect(out.customSections).toHaveLength(0);
    expect(out.parsedCustomSections.map((b) => b.title)).toEqual(['Hobbies']);
    expect(visible).toMatchObject({
      summary: false,
      experience: false,
      skills: false,
      'custom-legacy': false,
    });
  });
});
