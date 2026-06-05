import type { ReactNode } from 'react';

import { formatUiCopy } from '@/lib/formatUiCopy';

export type ExplainerBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'verbs'; preamble: string; verbs: string[] }
  | { kind: 'compare'; weak: string; strong: string };

/** Remove duplicate sentences / repeated adjacent phrases from API copy. */
export function dedupeExplainerCopy(text: string): string {
  const normalized = formatUiCopy(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const sentences = normalized.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const sent of sentences) {
    const key = sent.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(sent);
  }
  let joined = unique.join(' ');

  // Collapse immediate duplicate phrases (e.g. "foofoo" from bad joins)
  joined = joined.replace(/(\b[\w\s%]{8,}?)\1+/gi, '$1');
  return joined.trim();
}

export function parseExplainerBlocks(raw: string): ExplainerBlock[] {
  const text = dedupeExplainerCopy(raw);
  if (!text) return [];

  const blocks: ExplainerBlock[] = [];

  const withAfter = text.match(
    /^([\s\S]*?)\bWeak:\s*([\s\S]+?)\s*(?:→|->)\s*Strong:\s*([\s\S]+?)(\.\s+[\s\S]+)$/i,
  );
  const tailOnly = withAfter
    ? null
    : text.match(/^([\s\S]*?)\bWeak:\s*([\s\S]+?)\s*(?:→|->)\s*Strong:\s*([\s\S]+)$/i);
  const compare = withAfter ?? tailOnly;

  if (compare) {
    const before = compare[1].trim();
    const weak = compare[2].trim().replace(/^["']|["']$/g, '');
    const strong = compare[3].trim().replace(/^["']|["']$/g, '').replace(/\.\s*$/, '');
    const after = (compare[4] ?? '').trim().replace(/^\.\s*/, '');

    if (before) blocks.push(...parseLeadingSection(before));
    if (weak && strong) blocks.push({ kind: 'compare', weak, strong });
    if (after) blocks.push({ kind: 'paragraph', text: after });
    return blocks;
  }

  return parseLeadingSection(text);
}

function parseVerbLead(text: string): ExplainerBlock | null {
  const m = text.match(/^([\s\S]+?):\s*([A-Z][^.]+)\.\s*$/);
  if (!m) return null;
  const verbs = m[2]
    .split(/,\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (verbs.length < 2) return null;
  return { kind: 'verbs', preamble: m[1].trim(), verbs };
}

function parseLeadingSection(text: string): ExplainerBlock[] {
  const trimmed = text.trim();
  const verbBlock = parseVerbLead(trimmed);
  if (verbBlock) return [verbBlock];

  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0) {
    const afterColon = trimmed.slice(colonIdx + 1).trim();
    const dotIdx = afterColon.indexOf('.');
    if (dotIdx > 0) {
      const maybeVerbs = afterColon.slice(0, dotIdx).trim();
      const verbs = maybeVerbs.split(/,\s*/).filter((v) => /^[A-Z]/.test(v));
      if (verbs.length >= 2) {
        const rest = afterColon.slice(dotIdx + 1).trim();
        const blocks: ExplainerBlock[] = [
          { kind: 'verbs', preamble: trimmed.slice(0, colonIdx).trim(), verbs },
        ];
        if (rest) blocks.push({ kind: 'paragraph', text: rest });
        return blocks;
      }
    }
  }

  return [{ kind: 'paragraph', text: trimmed }];
}

const HIGHLIGHT_TERMS =
  /\b(role clarity|bullet depth|measurable outcomes|work history|recruiter scan|screening software|ATS basics|contact details|achievements|concrete outcomes|bullet points|\d+(?:\.\d+)?%)\b/gi;

function inlineHighlights(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  const re = new RegExp(HIGHLIGHT_TERMS.source, HIGHLIGHT_TERMS.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <mark
        key={`${keyPrefix}-h-${i++}`}
        className="rounded-sm bg-[#00C9B1]/12 px-0.5 font-medium text-[#9ef0e3] not-italic"
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

export function renderExplainerBlocks(blocks: ExplainerBlock[]): ReactNode {
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        if (block.kind === 'verbs') {
          return (
            <div key={`b-${i}`} className="space-y-1.5">
              <p className="leading-relaxed text-white/60">{block.preamble}:</p>
              <div className="flex flex-wrap gap-1.5">
                {block.verbs.map((verb) => (
                  <span
                    key={verb}
                    className="rounded-md border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#7ee8d8]"
                  >
                    {verb}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        if (block.kind === 'compare') {
          return (
            <div key={`b-${i}`} className="space-y-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
              <div className="flex gap-2 text-[10px] leading-snug sm:text-[11px]">
                <span className="shrink-0 font-semibold uppercase tracking-wide text-rose-300/90">
                  Weak
                </span>
                <p className="min-w-0 text-white/50 line-through decoration-rose-400/40">
                  {block.weak}
                </p>
              </div>
              <div className="flex gap-2 text-[10px] leading-snug sm:text-[11px]">
                <span className="shrink-0 font-semibold uppercase tracking-wide text-[#00C9B1]">
                  Strong
                </span>
                <p className="min-w-0 font-medium text-white/75">{block.strong}</p>
              </div>
            </div>
          );
        }
        return (
          <p key={`b-${i}`} className="leading-relaxed text-white/60">
            {inlineHighlights(block.text, `p-${i}`)}
          </p>
        );
      })}
    </div>
  );
}
