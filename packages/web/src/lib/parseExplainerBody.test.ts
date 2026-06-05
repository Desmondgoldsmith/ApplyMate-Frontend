import { describe, expect, it } from 'vitest';

import { dedupeExplainerCopy, parseExplainerBlocks } from '@/lib/parseExplainerBody';

describe('parseExplainerBody', () => {
  it('dedupes repeated sentences', () => {
    const raw =
      'This is the single most impactful change you can make. Many reviewers look for concrete outcomes. This is the single most impactful change you can make. Many reviewers look for concrete outcomes.';
    expect(dedupeExplainerCopy(raw)).toBe(
      'This is the single most impactful change you can make. Many reviewers look for concrete outcomes.',
    );
  });

  it('parses verbs, weak/strong, and trailing paragraph', () => {
    const raw =
      'Start every bullet with a powerful verb: Built, Architected, Reduced, Led, Launched, Optimised. Weak: Was responsible for performance → Strong: Optimised API response time by 40%. This is the single most impactful change you can make.';
    const blocks = parseExplainerBlocks(raw);
    expect(blocks.some((b) => b.kind === 'verbs')).toBe(true);
    expect(blocks.some((b) => b.kind === 'compare' && b.weak.includes('responsible'))).toBe(true);
    expect(blocks.some((b) => b.kind === 'compare' && b.strong.includes('40%'))).toBe(true);
    expect(blocks.filter((b) => b.kind === 'paragraph')).toHaveLength(1);
  });
});
