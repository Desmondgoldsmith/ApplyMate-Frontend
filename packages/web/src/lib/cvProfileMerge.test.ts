import { describe, expect, it } from 'vitest';

import {
  normalizeCvMergeCreatedResponse,
  normalizeCvMergePreviewResponse,
} from '@/lib/cvProfileMerge';

describe('cvProfileMerge', () => {
  it('parses preview merge response', () => {
    const preview = normalizeCvMergePreviewResponse({
      type: 'preview',
      mergeId: 'merge-1',
      suggestedName: 'Merged: A + B',
      sourceProfiles: [
        { id: 'a', name: 'Frontend CV' },
        { id: 'b', name: 'Backend CV' },
      ],
      structured: { summary: { text: 'Full-stack engineer.' } },
      sections: [
        { type: 'experience', label: 'Experience', itemCount: 3, order: 1 },
        { type: 'skills', label: 'Skills', itemCount: 12, order: 2 },
      ],
      instructions: 'Emphasise full-stack',
    });
    expect(preview.type).toBe('preview');
    expect(preview.suggestedName).toContain('Merged');
    expect(preview.sections).toHaveLength(2);
    expect(preview.sourceProfiles).toHaveLength(2);
  });

  it('parses created merge response', () => {
    const created = normalizeCvMergeCreatedResponse({
      type: 'created',
      mergeId: 'merge-2',
      profileId: 'new-id',
      sourceProfileIds: ['a', 'b'],
      profile: { id: 'new-id', template: 'modern' },
    });
    expect(created.type).toBe('created');
    expect(created.profileId).toBe('new-id');
    expect(created.sourceProfileIds).toEqual(['a', 'b']);
  });
});
