import { describe, expect, it } from 'vitest';

import { assistantDiffDisplayStrings } from '@/lib/cvAssistantDiffDisplay';

describe('assistantDiffDisplayStrings', () => {
  it('formats summary text without JSON', () => {
    const { after } = assistantDiffDisplayStrings(
      'summary',
      { summary: { text: 'Before line' } },
      { summary: { text: 'After line' } },
    );
    expect(after).toBe('After line');
    expect(after).not.toContain('{');
  });

  it('formats patch operation blobs as value text', () => {
    const { after } = assistantDiffDisplayStrings(
      'summary',
      null,
      { action: 'replace', field: 'summary', value: 'Readable paragraph.' },
    );
    expect(after).toBe('Readable paragraph.');
    expect(after).not.toContain('action');
  });

  it('does not recurse on full-CV blobs scoped to one section', () => {
    const fullCv = {
      summary: { text: 'Summary line' },
      experience: {
        items: [{ title: 'Engineer', company: 'Acme', bullets: ['Did work'] }],
      },
    };
    const { before, after } = assistantDiffDisplayStrings(
      'experience',
      fullCv,
      fullCv,
    );
    expect(before).toContain('Engineer');
    expect(after).toContain('Engineer');
  });

  it('formats experience items as readable lines', () => {
    const blob = {
      experience: {
        items: [
          {
            title: 'Engineer',
            company: 'Acme',
            bullets: ['Shipped feature X'],
          },
        ],
      },
    };
    const { after } = assistantDiffDisplayStrings('experience', null, blob);
    expect(after).toContain('Engineer · Acme');
    expect(after).toContain('• Shipped feature X');
    expect(after).not.toMatch(/^\s*\{/);
  });
});
