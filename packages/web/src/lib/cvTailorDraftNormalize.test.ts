import { describe, expect, it } from 'vitest';

import { normalizeCvTailorDraft } from '@/lib/api';

function draftWith(entry: Record<string, unknown>) {
  return {
    success: true,
    data: {
      id: 'd1',
      cvProfileId: 'p1',
      jobAnalysisId: 'j1',
      status: 'pending',
      selectedSkills: ['Kubernetes'],
      drafts: [
        {
          sectionId: 's1',
          sectionType: 'summary',
          before: '{"text":"a"}',
          after: '{"text":"b"}',
          status: 'pending',
          changedFields: [],
          ...entry,
        },
      ],
    },
  };
}

describe('normalizeCvTailorDraft safetyNotes', () => {
  it('keeps the fact-check notes from the server', () => {
    const draft = normalizeCvTailorDraft(
      draftWith({
        safetyNotes: [
          ' Kept your original job titles, employers and dates. ',
          7,
          '',
        ],
      }),
    );
    expect(draft.drafts[0].safetyNotes).toEqual([
      'Kept your original job titles, employers and dates.',
    ]);
  });

  it('omits notes when there are none', () => {
    expect(normalizeCvTailorDraft(draftWith({})).drafts[0]).not.toHaveProperty(
      'safetyNotes',
    );
    expect(
      normalizeCvTailorDraft(draftWith({ safetyNotes: 'nope' })).drafts[0],
    ).not.toHaveProperty('safetyNotes');
  });
});
