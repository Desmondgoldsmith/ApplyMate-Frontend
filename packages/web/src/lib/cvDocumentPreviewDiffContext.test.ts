import { describe, expect, it, beforeEach } from 'vitest';

import {
  resolveCvPreviewSectionDiff,
  setCvDocumentPreviewDiffContext,
} from '@/lib/cvDocumentPreviewDiffContext';

describe('resolveCvPreviewSectionDiff', () => {
  beforeEach(() => {
    setCvDocumentPreviewDiffContext({ multiSection: false });
  });

  it('matches a single section when diffSection is set', () => {
    const state = resolveCvPreviewSectionDiff('skills', 'skills', [
      {
        fieldPath: 'skills',
        before: 'a',
        after: 'b',
        type: 'changed',
      },
    ]);
    expect(state.isDiff).toBe(true);
    expect(state.fields).toHaveLength(1);
  });

  it('maps contact improvements to the personal header section', () => {
    const state = resolveCvPreviewSectionDiff('personal', 'contact', [
      {
        fieldPath: 'headline',
        before: '',
        after: 'Senior Frontend Engineer',
        type: 'added',
      },
    ]);
    expect(state.isDiff).toBe(true);
    expect(state.fields?.[0]?.fieldPath).toBe('headline');
  });

  it('maps headline API section to the personal header section', () => {
    const state = resolveCvPreviewSectionDiff('personal', 'headline', [
      {
        fieldPath: 'headline',
        before: 'Developer',
        after: 'Senior Frontend Engineer',
        type: 'changed',
      },
    ]);
    expect(state.isDiff).toBe(true);
  });

  it('matches experience bullets via fieldPath when diffSection is missing', () => {
    const state = resolveCvPreviewSectionDiff('experience', null, [
      {
        fieldPath: 'experience[0].bullets[1]',
        before: 'Old bullet',
        after: 'New bullet',
        type: 'changed',
      },
    ]);
    expect(state.isDiff).toBe(true);
    expect(state.fields).toHaveLength(1);
  });

  it('shows inline diff on multiple sections when multiSection is enabled', () => {
    setCvDocumentPreviewDiffContext({ multiSection: true });
    const skills = resolveCvPreviewSectionDiff('skills', null, [
      {
        fieldPath: 'skills',
        before: 'a',
        after: 'b',
        type: 'changed',
        sectionDiffIndex: 0,
      },
      {
        fieldPath: 'experience',
        before: 'c',
        after: 'd',
        type: 'changed',
        sectionDiffIndex: 1,
      },
    ]);
    const experience = resolveCvPreviewSectionDiff('experience', null, [
      {
        fieldPath: 'skills',
        before: 'a',
        after: 'b',
        type: 'changed',
        sectionDiffIndex: 0,
      },
      {
        fieldPath: 'experience',
        before: 'c',
        after: 'd',
        type: 'changed',
        sectionDiffIndex: 1,
      },
    ]);
    expect(skills.isDiff).toBe(true);
    expect(skills.sectionDiffIndex).toBe(0);
    expect(experience.isDiff).toBe(true);
    expect(experience.sectionDiffIndex).toBe(1);
  });
});
