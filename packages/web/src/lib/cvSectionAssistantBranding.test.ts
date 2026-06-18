import { describe, expect, it } from 'vitest';

import type { CVBuilderData } from '@/lib/cvBuilder';
import {
  cvSectionAssistantDisplayName,
  cvSectionAssistantPopoverTitle,
  resolveCvSectionAssistantDisplayName,
} from '@/lib/cvSectionAssistantBranding';

describe('cvSectionAssistantBranding', () => {
  it('maps known section ids', () => {
    expect(cvSectionAssistantDisplayName('summary')).toBe('Summary');
    expect(cvSectionAssistantPopoverTitle('experience')).toBe('Experience assistant');
  });

  it('does not show raw UUIDs for parsed section ids', () => {
    const uuid = '592f1216-906b-42ab-baca-3fe6f0f44fa4';
    expect(cvSectionAssistantDisplayName(`parsed-${uuid}`)).toBe('Custom section');
    expect(cvSectionAssistantPopoverTitle(`parsed-${uuid}`)).toBe('Custom section assistant');
  });

  it('uses persisted parsed section title from builder data', () => {
    const uuid = '592f1216-906b-42ab-baca-3fe6f0f44fa4';
    const data = {
      parsedCustomSections: [
        {
          sectionId: uuid,
          sectionType: 'custom',
          title: 'Something New',
          items: [],
        },
      ],
    } as unknown as CVBuilderData;

    expect(resolveCvSectionAssistantDisplayName(`parsed-${uuid}`, data)).toBe('Something New');
    expect(cvSectionAssistantPopoverTitle(`parsed-${uuid}`, data)).toBe('Something New assistant');
  });

  it('falls back to section type label when parsed title is empty', () => {
    const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const data = {
      parsedCustomSections: [
        {
          sectionId: uuid,
          sectionType: 'custom_publications',
          title: '',
          items: [],
        },
      ],
    } as unknown as CVBuilderData;

    expect(resolveCvSectionAssistantDisplayName(`parsed-${uuid}`, data)).toBe('Publications');
    expect(cvSectionAssistantPopoverTitle(`parsed-${uuid}`, data)).toBe('Publications assistant');
  });
});
