import type { CvTailorDraftEntry, JobAnalysis } from '@/lib/api';
import {
  buildTailorSectionChanges,
  type TailorChangeHunk,
} from '@/lib/cvTailorDiff';

export type CheckStep = 1 | 2 | 3;

/** True when the user pasted a single web link rather than the job text. */
export function looksLikeLink(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 2000 || /\s/.test(t)) return false;
  return (
    /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(t) ||
    /^www\.[^\s/]+\.[a-z]{2,}/i.test(t) ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S+$/i.test(t)
  );
}

export const MIN_JOB_TEXT_CHARS = 200;

export type Verdict = {
  label: 'Strong match' | 'Good match' | 'Fair match' | 'Long shot';
  tone: 'success' | 'accent' | 'warning' | 'danger';
};

export function verdictFor(score: number): Verdict {
  if (score >= 80) return { label: 'Strong match', tone: 'success' };
  if (score >= 65) return { label: 'Good match', tone: 'accent' };
  if (score >= 50) return { label: 'Fair match', tone: 'warning' };
  return { label: 'Long shot', tone: 'danger' };
}

export type RequirementRow = {
  key: string;
  label: string;
  have: boolean;
  required: boolean;
};

/**
 * A requirement that can sit in a Skills list ("GraphQL", "Design systems"). Sentences such as
 * "5+ years of front-end experience" or "Passion for growth" are not offered: the summary and
 * bullet rewording covers them, and adding them to Skills would read badly.
 */
export function isSkillLike(label: string, kind?: string): boolean {
  const t = label.trim();
  if (!t || t.length > 40) return false;
  // "5+" / "3 years" are experience asks; digits in names (HTML5, EC2) are fine.
  if (/\d\s*\+|\b\d+\s*(years?|yrs)\b/i.test(t)) return false;
  if (t.split(/\s+/).length > 4) return false;
  if (
    /\b(experience|years?|passion|ability|able|strong|excellent|team|environment|degree|skills|problem[- ]solving|communication|collaboration)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return kind !== 'phrase' || t.split(/\s+/).length <= 3;
}

function tidyLabel(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * "What they ask for": each requirement from the posting with whether the CV shows it. Required
 * ones first, missing before met. A missing option is dropped when another option in its
 * "any one of" group is already on the CV.
 */
export function requirementRows(analysis: JobAnalysis): RequirementRow[] {
  const coverage = analysis.skillCoverage ?? [];
  const metGroups = new Set(
    coverage
      .filter((c) => c.status === 'found' && c.orGroupId)
      .map((c) => c.orGroupId as string),
  );
  const seen = new Set<string>();
  const rows: RequirementRow[] = [];
  for (const c of coverage) {
    const label = tidyLabel(c.skill ?? '');
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    if (!isSkillLike(label, c.requirementKind)) continue;
    const have = c.status === 'found';
    if (!have && c.orGroupId && metGroups.has(c.orGroupId)) continue;
    seen.add(key);
    rows.push({
      key,
      label,
      have,
      required:
        c.tier === 'required' ||
        c.importance === 'CRITICAL' ||
        c.importance === 'HIGH',
    });
  }
  if (rows.length === 0) {
    for (const m of analysis.missingSkills ?? []) {
      const label = tidyLabel(m.name ?? '');
      const key = label.toLowerCase();
      if (!label || seen.has(key) || !isSkillLike(label, m.requirementKind)) {
        continue;
      }
      seen.add(key);
      rows.push({
        key,
        label,
        have: false,
        required: m.importance === 'CRITICAL' || m.importance === 'HIGH',
      });
    }
  }
  // What is missing comes first (the user acts on it), required before nice-to-have.
  return rows.sort(
    (a, b) =>
      Number(a.have) - Number(b.have) ||
      Number(b.required) - Number(a.required),
  );
}

/** "You have 7 of the 10 things they ask for." */
export function matchSentence(rows: RequirementRow[]): string | null {
  if (rows.length === 0) return null;
  const have = rows.filter((r) => r.have).length;
  if (have === rows.length) return 'Your CV shows everything they ask for.';
  return `Your CV shows ${have} of the ${rows.length} things they ask for.`;
}

const SECTION_NAMES: Record<string, string> = {
  summary: 'Summary',
  experience: 'Work experience',
  skills: 'Skills',
};

export function sectionName(type: string): string {
  return SECTION_NAMES[type] ?? tidyLabel(type);
}

function hunksOf(entry: CvTailorDraftEntry): TailorChangeHunk[] {
  try {
    return buildTailorSectionChanges(
      entry.sectionType,
      entry.before,
      entry.after,
      entry.changedFields,
    );
  } catch {
    return [];
  }
}

/** One plain line for what tailoring changed in a section. */
export function changeHeadline(entry: CvTailorDraftEntry): string {
  const hunks = hunksOf(entry);
  if (entry.sectionType === 'skills') {
    const added = hunks.flatMap((h) => (h.kind === 'skills' ? h.added : []));
    return added.length
      ? `Added ${added.slice(0, 4).join(', ')}${added.length > 4 ? '…' : ''}`
      : 'Put the skills this job wants first';
  }
  if (entry.sectionType === 'summary') return 'Rewrote it for this job';
  if (entry.sectionType === 'experience') {
    const n = hunks.filter(
      (h) => h.kind === 'bullet' || h.kind === 'text',
    ).length;
    return n > 0
      ? `Reworded ${n} bullet${n === 1 ? '' : 's'} to match the job`
      : 'Reworded your bullets to match the job';
  }
  return entry.summary?.trim() || 'Updated for this job';
}

/** Before / after text for the "See the change" view, as plain lines. */
export function changeLines(entry: CvTailorDraftEntry): {
  before: string[];
  after: string[];
} {
  const before: string[] = [];
  const after: string[] = [];
  for (const h of hunksOf(entry)) {
    if (h.kind === 'skills') {
      before.push(...h.removed);
      after.push(...h.added);
    } else {
      if (h.before.trim()) before.push(h.before.trim());
      if (h.after.trim()) after.push(h.after.trim());
    }
  }
  if (before.length + after.length === 0) {
    return {
      before: entry.displayDiff?.removed ?? [],
      after: entry.displayDiff?.added ?? [],
    };
  }
  return { before, after };
}

export function scoreLift(
  before: number | null | undefined,
  after: number | null | undefined,
): number | null {
  if (before == null || after == null) return null;
  return Math.round(after) - Math.round(before);
}
