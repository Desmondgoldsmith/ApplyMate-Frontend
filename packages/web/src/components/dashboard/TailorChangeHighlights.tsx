'use client';

import { Briefcase } from 'lucide-react';
import { useMemo } from 'react';

import {
  isStructuredTailorSectionBlob,
  TailorSectionStructuredView,
  TailorSkillsDelta,
} from '@/components/dashboard/TailorSectionStructuredView';
import type { TailorDisplayDiff } from '@/lib/api';
import {
  buildTailorSectionChanges,
  buildOrderedWordDiff,
  type TailorChangeHunk,
} from '@/lib/cvTailorDiff';
import { richTextPlainText } from '@/lib/cvRichTextCore';
import { resolveExperienceRoleLabelsFromChangedFields } from '@/lib/tailorChangeContext';
import { cn } from '@/lib/utils';

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

function StructuredSectionDiff({
  sectionType,
  beforeRaw,
  afterRaw,
}: {
  sectionType: string;
  beforeRaw: string;
  afterRaw: string;
}) {
  const st = sectionType.trim().toLowerCase();

  if (st === 'skills' || st === 'skill') {
    return <TailorSkillsDelta beforeRaw={beforeRaw} afterRaw={afterRaw} />;
  }

  if (st === 'experience' || st === 'work' || st === 'employment') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3.5">
          <TailorSectionStructuredView
            sectionType={sectionType}
            raw={beforeRaw}
            variant="before"
            label="Before"
          />
        </div>
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3.5">
          <TailorSectionStructuredView
            sectionType={sectionType}
            raw={afterRaw}
            variant="after"
            label="Suggested"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TailorSectionStructuredView
        sectionType={sectionType}
        raw={afterRaw}
        variant="after"
        label="Suggested edit"
      />
    </div>
  );
}

function ExperienceRoleContext({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        {labels.length === 1 ? 'Role updated' : 'Roles updated'}
      </p>
      <ul className="space-y-1">
        {labels.map((label) => (
          <li key={label} className="flex items-start gap-2 text-[12px] leading-snug text-white/75">
            <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00C9B1]/70" aria-hidden />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TailorChangeHighlights({
  sectionType,
  beforeRaw,
  afterRaw,
  changedFields = [],
  displayDiff,
  summary,
  className,
}: {
  sectionType: string;
  beforeRaw: string;
  afterRaw: string;
  changedFields?: string[];
  displayDiff?: TailorDisplayDiff | null;
  summary?: string | null;
  className?: string;
}) {
  const st = sectionType.trim().toLowerCase();
  const hasDisplayDiff =
    Boolean(displayDiff) &&
    ((displayDiff?.added.length ?? 0) > 0 || (displayDiff?.removed.length ?? 0) > 0);

  const experienceRoleLabels = useMemo(() => {
    if (hasDisplayDiff) return [];
    if (st !== 'experience' && st !== 'work' && st !== 'employment') return [];
    return resolveExperienceRoleLabelsFromChangedFields(changedFields, beforeRaw, afterRaw);
  }, [st, changedFields, beforeRaw, afterRaw, hasDisplayDiff]);

  const structured =
    !hasDisplayDiff &&
    (isStructuredTailorSectionBlob(beforeRaw) || isStructuredTailorSectionBlob(afterRaw));

  const legacyHunks = useMemo(() => {
    if (hasDisplayDiff || structured) return [];
    return buildTailorSectionChanges(sectionType, beforeRaw, afterRaw, changedFields).filter(
      (h) => h.kind !== 'text' || h.before.trim() !== h.after.trim(),
    );
  }, [hasDisplayDiff, structured, sectionType, beforeRaw, afterRaw, changedFields]);

  if (
    !summary?.trim() &&
    experienceRoleLabels.length === 0 &&
    !structured &&
    !hasDisplayDiff &&
    legacyHunks.length === 0
  ) {
    return null;
  }

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5', className)}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        Suggested edit
      </p>

      {summary?.trim() ? (
        <p className="mb-3 text-[13px] leading-relaxed text-white/75">{summary.trim()}</p>
      ) : null}

      <ExperienceRoleContext labels={experienceRoleLabels} />

      {hasDisplayDiff ? (
        <SkillDelta removed={displayDiff!.removed} added={displayDiff!.added} />
      ) : structured ? (
        <StructuredSectionDiff
          sectionType={sectionType}
          beforeRaw={beforeRaw}
          afterRaw={afterRaw}
        />
      ) : (
        <div className="space-y-3">
          {legacyHunks.map((hunk, i) => (
            <ChangeBlock key={`${hunk.kind}-${i}`} hunk={hunk} />
          ))}
        </div>
      )}

      <p className="mt-2.5 text-[10px] text-white/32">
        <span className="text-rose-300/70 line-through">Strikethrough</span>
        {' · '}
        <span className="text-emerald-300/80">highlight</span> = changes for this role
      </p>
    </div>
  );
}
