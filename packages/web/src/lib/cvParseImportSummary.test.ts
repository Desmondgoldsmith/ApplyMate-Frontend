import { describe, expect, it } from 'vitest';

import {
  extractCvParseImportSummary,
  normalizeCvParseImportSummary,
} from '@/lib/cvParseImportSummary';

describe('cvParseImportSummary', () => {
  it('normalizes import summary payload', () => {
    const summary = normalizeCvParseImportSummary({
      sectionCount: 2,
      message: 'We found 2 sections.',
      sections: [
        {
          type: 'experience',
          label: 'Experience',
          itemCount: 3,
          kind: 'core',
        },
        {
          type: 'custom_publications',
          label: 'Publications',
          itemCount: 2,
          kind: 'custom',
        },
      ],
    });
    expect(summary?.sectionCount).toBe(2);
    expect(summary?.sections[1]?.kind).toBe('custom');
    expect(summary?.sections[1]?.label).toBe('Publications');
  });

  it('extracts importSummary from parse envelope', () => {
    const summary = extractCvParseImportSummary({
      cvProfileId: 'p1',
      importSummary: {
        sectionCount: 1,
        message: 'Imported.',
        sections: [{ type: 'summary', label: 'Summary', itemCount: 1, kind: 'core' }],
      },
    });
    expect(summary?.sections).toHaveLength(1);
  });
});
