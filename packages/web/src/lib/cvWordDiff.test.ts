import { describe, expect, it } from 'vitest';

import { wordDiff } from './cvWordDiff';

const render = (parts: ReturnType<typeof wordDiff>) =>
  parts
    .map((p) =>
      p.kind === 'same'
        ? p.text
        : p.kind === 'added'
          ? `[+${p.text}]`
          : `[-${p.text}]`,
    )
    .join('');

describe('wordDiff', () => {
  it('marks only the words that changed', () => {
    expect(
      render(
        wordDiff(
          'Built the onboarding flow in React',
          'Built the customer onboarding flow in React and Next.js',
        ),
      ),
    ).toBe('Built the [+customer ]onboarding flow in React[+ and Next.js]');
  });

  it('shows a removed word as removed', () => {
    expect(render(wordDiff('Led a big team', 'Led a team'))).toBe(
      'Led a [-big ]team',
    );
  });

  it('handles empty sides', () => {
    expect(wordDiff('', 'New text')).toEqual([
      { text: 'New text', kind: 'added' },
    ]);
    expect(wordDiff('Old text', '')).toEqual([
      { text: 'Old text', kind: 'removed' },
    ]);
  });
});
