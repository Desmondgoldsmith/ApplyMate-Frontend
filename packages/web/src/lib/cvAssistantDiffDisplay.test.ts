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
