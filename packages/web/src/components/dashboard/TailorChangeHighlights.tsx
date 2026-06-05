'use client';

import { useMemo } from 'react';

import {
  buildOrderedWordDiff,
  buildTailorSectionChanges,
  type TailorChangeHunk,
} from '@/lib/cvTailorDiff';
import { richTextPlainText } from '@/lib/cvRichTextCore';
import { cn } from '@/lib/utils';

/** Strip rich-text markup (e.g. <strong>, <u>, <a>) so diffs read as clean prose. */
function cleanDiffText(raw: string): string {
  if (!raw) return '';
  return richTextPlainText(raw) || raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function InlineEdit({ before, after }: { before: string; after: string }) {
  const tokens = useMemo(
    () => buildOrderedWordDiff(cleanDiffText(before), cleanDiffText(after)),
    [before, after],
  );

  if (tokens.length === 0) {
    return <p className="text-[12px] leading-relaxed text-white/45">No changes</p>;
  }

  return (
    <p className="text-[13px] leading-[1.7] text-white/75">
      {tokens.map((t, i) => (
        <span
          key={`${i}-${t.type}-${t.text.slice(0, 16)}`}
          className={cn(
            t.type === 'removed' &&
              'bg-rose-500/15 text-rose-200/90 line-through decoration-rose-400/50',
            t.type === 'added' && 'bg-emerald-500/15 font-medium text-emerald-100',
          )}
        >
          {t.text}{' '}
        </span>
      ))}
    </p>
  );
}

function SkillDelta({ removed, added }: { removed: string[]; added: string[] }) {
  return (
    <div className="space-y-2.5">
      {removed.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {removed.map((s) => (
            <span
              key={`rm-${s}`}
              className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-200/90 line-through"
            >
              {cleanDiffText(s)}
            </span>
          ))}
        </div>
      ) : null}
      {added.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {added.map((s) => (
            <span
              key={`add-${s}`}
              className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-100"
            >
              + {cleanDiffText(s)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChangeBlock({ hunk }: { hunk: TailorChangeHunk }) {
  if (hunk.kind === 'skills') {
    return <SkillDelta removed={hunk.removed} added={hunk.added} />;
  }

  return (
    <div className="space-y-1.5">
      {hunk.label ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{hunk.label}</p>
      ) : null}
      <InlineEdit before={hunk.before} after={hunk.after} />
    </div>
  );
}

export function TailorChangeHighlights({
  sectionType,
  beforeRaw,
  afterRaw,
  changedFields = [],
  className,
}: {
  sectionType: string;
  beforeRaw: string;
  afterRaw: string;
  changedFields?: string[];
  className?: string;
}) {
  const hunks = useMemo(
    () => buildTailorSectionChanges(sectionType, beforeRaw, afterRaw, changedFields),
    [sectionType, beforeRaw, afterRaw, changedFields],
  );

  const meaningful = hunks.filter(
    (h) => h.kind !== 'text' || h.before.trim() !== h.after.trim(),
  );

  if (meaningful.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5', className)}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        Suggested edit
      </p>
      <div className="space-y-3">
        {meaningful.map((hunk, i) => (
          <ChangeBlock key={`${hunk.kind}-${i}`} hunk={hunk} />
        ))}
      </div>
      <p className="mt-2.5 text-[10px] text-white/32">
        <span className="text-rose-300/70 line-through">Strikethrough</span>
        {' · '}
        <span className="text-emerald-300/80">highlight</span> = changes for this role
      </p>
    </div>
  );
}
