export type WordDiffPart = { text: string; kind: 'same' | 'added' | 'removed' };

/** Above this many token pairs the diff is skipped and shown as old → new. */
const MAX_DIFF_CELLS = 250_000;

function tokens(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function pushPart(
  out: WordDiffPart[],
  text: string,
  kind: WordDiffPart['kind'],
) {
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push({ text, kind });
}

/**
 * Word-level difference between two versions, for showing one readable paragraph: unchanged
 * words as they are, removed words struck through, added words highlighted.
 */
export function wordDiff(before: string, after: string): WordDiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length === 0) return b.length ? [{ text: after, kind: 'added' }] : [];
  if (b.length === 0) return [{ text: before, kind: 'removed' }];
  if (a.length * b.length > MAX_DIFF_CELLS) {
    return [
      { text: before, kind: 'removed' },
      { text: ' ', kind: 'same' },
      { text: after, kind: 'added' },
    ];
  }
  // Longest common subsequence of tokens (whitespace counts as a token so spacing is kept).
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: WordDiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pushPart(out, a[i]!, 'same');
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      pushPart(out, a[i]!, 'removed');
      i++;
    } else {
      pushPart(out, b[j]!, 'added');
      j++;
    }
  }
  while (i < a.length) pushPart(out, a[i++]!, 'removed');
  while (j < b.length) pushPart(out, b[j++]!, 'added');
  // Whitespace-only changes read as noise: fold them into the surrounding text.
  return out.map((part) =>
    part.kind !== 'same' && part.text.trim() === ''
      ? { ...part, kind: 'same' }
      : part,
  );
}
