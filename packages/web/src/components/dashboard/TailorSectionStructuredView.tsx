'use client';

import type { ReactNode } from 'react';

import { CvRichTextHtml } from '@/components/cv/CvRichTextHtml';
import { Badge } from '@/components/ui/Badge';
import { extractSkillList } from '@/lib/cvTailorDiff';
import {
  formatExperienceRoleLabel,
  parseTailorExperienceItems,
} from '@/lib/tailorChangeContext';
import { cn } from '@/lib/utils';
function tryParseSectionJson(raw: string): unknown {
  const t = raw?.trim() ?? '';
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function labelizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function SkillPills({ skills, variant }: { skills: string[]; variant: 'before' | 'after' }) {
  if (skills.length === 0) {
    return <span className="text-xs text-white/35">No skills listed</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((s) => (
        <Badge
          key={s}
          variant={variant === 'before' ? 'muted' : 'teal'}
          className="max-w-full truncate border px-2.5 py-0.5 text-[11px] font-medium"
        >
          {s}
        </Badge>
      ))}
    </div>
  );
}

function renderEmptyPlaceholder(): ReactNode {
  return <span className="text-xs italic text-white/35">—</span>;
}

function renderSkillsPayload(data: unknown, variant: 'before' | 'after'): ReactNode {
  if (data === null || data === undefined) {
    return renderEmptyPlaceholder();
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.categories)) {
      return (
        <div className="space-y-3">
          {o.categories.map((cat, i) => {
            if (!cat || typeof cat !== 'object') return null;
            const c = cat as Record<string, unknown>;
            const name = typeof c.name === 'string' ? c.name : `Group ${i + 1}`;
            const skills = Array.isArray(c.skills)
              ? c.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              : [];
            return (
              <div key={`${name}-${i}`}>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-white/55">{name}</p>
                <SkillPills skills={skills} variant={variant} />
              </div>
            );
          })}
        </div>
      );
    }

    if (Array.isArray(o.skills)) {
      const name = typeof o.name === 'string' && o.name.trim() ? o.name : 'Skills';
      const skills = o.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      return (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-white/55">{name}</p>
          <SkillPills skills={skills} variant={variant} />
        </div>
      );
    }
  }

  if (Array.isArray(data) && data.every((x) => typeof x === 'string')) {
    return <SkillPills skills={data as string[]} variant={variant} />;
  }

  return null;
}

function renderExperiencePayload(data: unknown): ReactNode {
  if (data === null || data === undefined || typeof data !== 'object') {
    return renderEmptyPlaceholder();
  }
  const raw = typeof data === 'string' ? data : JSON.stringify(data);
  const parsedItems = parseTailorExperienceItems(raw);
  if (parsedItems.length === 0) return renderEmptyPlaceholder();

  return (
    <ul className="space-y-3 text-[13px] leading-relaxed">
      {parsedItems.map((item, i) => (
        <li key={`${formatExperienceRoleLabel(item)}-${i}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="font-semibold text-white">{formatExperienceRoleLabel(item)}</p>
          {item.bullets.length > 0 ? (
            <ul className="mt-2 list-outside list-disc space-y-1.5 pl-4 text-white/80">
              {item.bullets.map((b, j) => (
                <li key={j} className="pl-0.5">
                  <CvRichTextHtml text={b} as="span" className="[&_strong]:font-semibold [&_strong]:text-white" />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function renderRichTextBlock(text: string): ReactNode {
  return (
    <CvRichTextHtml
      text={text}
      as="div"
      className="text-sm leading-relaxed text-white/80 [&_strong]:font-semibold [&_strong]:text-white"
    />
  );
}

function renderSummaryPayload(data: unknown): ReactNode {
  if (data === null || data === undefined) return renderEmptyPlaceholder();
  if (typeof data === 'string') {
    return renderRichTextBlock(data);
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const t = (data as { text?: unknown; summary?: unknown }).text ?? (data as { summary?: unknown }).summary;
    if (typeof t === 'string' && t.trim()) {
      return renderRichTextBlock(t);
    }
  }
  return null;
}
export function TailorSectionStructuredView({
  sectionType,
  raw,
  variant,
  label,
}: {
  sectionType: string;
  raw: string;
  variant: 'before' | 'after';
  label?: string;
}) {
  const parsed = tryParseSectionJson(raw) ?? (raw.trim() ? raw : null);
  const st = sectionType.trim().toLowerCase();

  let body: ReactNode = null;
  if (st === 'skills' || st === 'skill') {
    body = renderSkillsPayload(parsed, variant);
  } else if (st === 'experience' || st === 'work' || st === 'employment') {
    body = renderExperiencePayload(parsed);
  } else if (st === 'summary' || st === 'profile') {
    body = renderSummaryPayload(parsed);
  }

  if (!body && typeof parsed === 'string') {
    body = renderRichTextBlock(parsed);
  }

  if (!body) {
    body = raw.trim() ? renderRichTextBlock(raw.trim()) : renderEmptyPlaceholder();
  }
  return (
    <div className={cn(variant === 'before' ? 'opacity-90' : '')}>
      {label ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      ) : null}
      {body}
    </div>
  );
}

export function TailorSkillsDelta({ beforeRaw, afterRaw }: { beforeRaw: string; afterRaw: string }) {
  const beforeParsed = tryParseSectionJson(beforeRaw);
  const afterParsed = tryParseSectionJson(afterRaw);
  const bSkills = extractSkillList(beforeParsed);
  const aSkills = extractSkillList(afterParsed);
  const bSet = new Set(bSkills.map((s) => s.toLowerCase()));
  const aSet = new Set(aSkills.map((s) => s.toLowerCase()));
  const removed = bSkills.filter((s) => !aSet.has(s.toLowerCase()));
  const added = aSkills.filter((s) => !bSet.has(s.toLowerCase()));

  if (removed.length === 0 && added.length === 0) {
    return (
      <TailorSectionStructuredView sectionType="skills" raw={afterRaw} variant="after" label="Updated skills" />
    );
  }

  return (
    <div className="space-y-3">
      {removed.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300/70">Removed</p>
          <SkillPills skills={removed} variant="before" />
        </div>
      ) : null}
      {added.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">Added</p>
          <SkillPills skills={added} variant="after" />
        </div>
      ) : null}
    </div>
  );
}

export function formatTailorChangedFieldPath(path: string): string {
  return path
    .replace(/\[\d+\]/g, (m) => m.replace('[', ' ').replace(']', ''))
    .replace(/\./g, ' › ')
    .trim();
}

export function filterTailorChangedFieldPaths(fields: string[]): string[] {
  return fields.filter((f) => {
    const t = f.trim();
    if (!t) return false;
    if (/^(reflected|updated)\s/i.test(t)) return false;
    if (t.length > 100 && !/[\[\].]/.test(t)) return false;
    return true;
  });
}

export function isStructuredTailorSectionBlob(raw: string): boolean {
  const t = raw?.trim() ?? '';
  if (!t.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(t) as unknown;
    return parsed !== null && typeof parsed === 'object';
  } catch {
    return false;
  }
}

export { labelizeKey };
