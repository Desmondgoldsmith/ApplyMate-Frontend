import { describe, expect, it } from 'vitest';

import {
  aiPatchOperationToSides,
  coerceAiPatchSectionBlob,
  coerceAiPatchToDisplayString,
  isAiPatchOperation,
  normalizeCvDiffPreviewParams,
} from '@/lib/cvAiPatchDisplay';

describe('cvAiPatchDisplay', () => {
  it('detects patch operations', () => {
    expect(
      isAiPatchOperation({ action: 'replace', field: 'summary', value: 'New text' }),
    ).toBe(true);
  });

  it('extracts value from replace patch', () => {
    expect(
      coerceAiPatchToDisplayString({
        action: 'replace',
        field: 'summary',
        value: 'Improved summary paragraph.',
      }),
    ).toBe('Improved summary paragraph.');
  });

  it('extracts before and after from patch with oldValue', () => {
    const sides = aiPatchOperationToSides({
      action: 'replace',
      field: 'summary',
      oldValue: 'Before line',
      value: 'After line',
    });
    expect(sides.before).toBe('Before line');
    expect(sides.after).toBe('After line');
  });

  it('parses JSON string patch blobs', () => {
    const raw = JSON.stringify({
      action: 'replace',
      field: 'summary',
      value: 'From JSON string',
    });
    expect(coerceAiPatchToDisplayString(raw, 'summary')).toBe('From JSON string');
  });

  it('normalizeCvDiffPreviewParams fixes object changedFields', () => {
    const normalized = normalizeCvDiffPreviewParams({
      section: 'summary',
      before: null,
      after: null,
      pointer: 'imp_1',
      changedFields: [
        {
          fieldPath: 'summary.text',
          field: 'Summary',
          before: { action: 'replace', field: 'summary', oldValue: 'Old' },
          after: { action: 'replace', field: 'summary', value: 'New' },
          type: 'changed',
        },
      ],
    });
    expect(normalized.changedFields[0]?.before).toBe('Old');
    expect(normalized.changedFields[0]?.after).toBe('New');
    expect(normalized.changedFields[0]?.after).not.toContain('action');
  });

  it('synthesizes changedFields from structural before/after when fields empty', () => {
    const normalized = normalizeCvDiffPreviewParams({
      section: 'summary',
      before: { summary: { text: 'Before paragraph' } },
      after: { summary: { text: 'After paragraph' } },
      pointer: 'imp_2',
      changedFields: [],
    });
    expect(normalized.changedFields.length).toBeGreaterThan(0);
    expect(normalized.changedFields[0]?.before).toContain('Before');
    expect(normalized.changedFields[0]?.after).toContain('After');
  });

  it('coerceAiPatchSectionBlob avoids raw JSON for tailor line diff', () => {
    const s = coerceAiPatchSectionBlob(
      JSON.stringify({ action: 'replace', field: 'summary', value: 'Tailored summary.' }),
      'summary',
    );
    expect(s).toBe('Tailored summary.');
    expect(s).not.toMatch(/^\s*\{/);
  });
});
