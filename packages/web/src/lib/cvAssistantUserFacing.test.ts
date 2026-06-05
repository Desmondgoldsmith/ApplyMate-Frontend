import { describe, expect, it } from 'vitest';

import { emptyCVBuilderData } from '@/lib/cvBuilder';
import {
  buildCvSectionInventory,
  filterRecruiterFindingsPartition,
  filterUnrealisticCvSuggestions,
  sanitizeAssistantClarificationQuestion,
} from '@/lib/cvAssistantUserFacing';

describe('sanitizeAssistantClarificationQuestion', () => {
  it('rewrites JSON-centric model wording', () => {
    const q =
      'The provided CV JSON does not contain any data for Experience. Would you like placeholder sections?';
    expect(sanitizeAssistantClarificationQuestion(q)).not.toMatch(/json/i);
    expect(sanitizeAssistantClarificationQuestion(q)).toMatch(/your CV/i);
  });
});

describe('buildCvSectionInventory', () => {
  it('detects education from section rows', () => {
    const inv = buildCvSectionInventory(emptyCVBuilderData(), [
      { id: '1', type: 'education', order: 2, hidden: false } as never,
    ]);
    expect(inv.hasEducation).toBe(true);
  });
});

describe('filterRecruiterFindingsPartition', () => {
  it('drops add-education-section finding when education exists', () => {
    const inv = buildCvSectionInventory(
      {
        ...emptyCVBuilderData(),
        education: {
          items: [
            {
              id: 'e1',
              degree: 'BSc',
              field: 'CS',
              school: 'Uni',
              startYear: '2018',
              endYear: '2022',
            },
          ],
        },
      },
      [{ id: '1', type: 'education', order: 2, hidden: false } as never],
    );
    const { partition, dropped } = filterRecruiterFindingsPartition(
      {
        positives: [],
        actionable: [
          "Include an 'Education' section with details of your degrees, institutions, and dates of attendance.",
        ],
        otherNotes: [],
        hasActionableFindings: true,
      },
      inv,
    );
    expect(partition.actionable).toHaveLength(0);
    expect(partition.hasActionableFindings).toBe(false);
    expect(dropped).toHaveLength(1);
  });
});

describe('filterUnrealisticCvSuggestions', () => {
  it('removes add-summary suggestion when summary exists', () => {
    const inv = buildCvSectionInventory(
      {
        ...emptyCVBuilderData(),
        summary: { text: 'Product engineer with 5 years experience.' },
      },
      [],
    );
    const { items, dropped } = filterUnrealisticCvSuggestions(
      [
        {
          id: 's1',
          section: 'summary',
          issue: 'Add a Summary section to introduce your profile.',
          suggestion: '',
          priority: 2,
        },
      ],
      inv,
    );
    expect(items).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });
});
