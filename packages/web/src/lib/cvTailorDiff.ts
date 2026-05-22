export type CvTailorDiffLine = {
  type: 'same' | 'added' | 'removed';
  text: string;
};

export type TailorChangeHunk =
  | { kind: 'skills'; removed: string[]; added: string[] }
  | { kind: 'text'; label: string; before: string; after: string }
  | { kind: 'bullet'; label: string; before: string; after: string };

function parseSectionJson(raw: string): unknown {
  const t = raw?.trim() ?? '';
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return t;
  }
}

function normSkill(s: string): string {
  return s.trim().toLowerCase();
}

/** Flatten skills from structured CV section JSON. */
export function extractSkillList(data: unknown): string[] {
  if (data === null || data === undefined) return [];
  if (Array.isArray(data) && data.every((x) => typeof x === 'string')) {
    return (data as string[]).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.skills)) {
    return o.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim());
  }
  if (Array.isArray(o.categories)) {
    const out: string[] = [];
    for (const cat of o.categories) {
      if (!cat || typeof cat !== 'object') continue;
      const skills = (cat as { skills?: unknown }).skills;
      if (Array.isArray(skills)) {
        for (const s of skills) {
          if (typeof s === 'string' && s.trim()) out.push(s.trim());
        }
      }
    }
    return out;
  }
  return [];
}

function extractSummaryText(data: unknown): string {
  if (typeof data === 'string') return data.trim();
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    const t = o.text ?? o.summary ?? o.headline;
    if (typeof t === 'string') return t.trim();
  }
  return '';
}

type ExperienceItem = { title: string; company: string; bullets: string[] };

function extractExperienceItems(data: unknown): ExperienceItem[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const x = it as Record<string, unknown>;
      const title = typeof x.title === 'string' ? x.title.trim() : 'Role';
      const company = typeof x.company === 'string' ? x.company.trim() : '';
      const bullets = Array.isArray(x.bullets)
        ? x.bullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).map((b) => b.trim())
        : [];
      return { title, company, bullets };
    })
    .filter((x): x is ExperienceItem => x !== null);
}

function labelizeFieldPath(path: string): string {
  return path
    .replace(/\[\d+\]/g, ' ')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function pairLineDiffSwaps(beforeRaw: string, afterRaw: string): TailorChangeHunk[] {
  const lines = buildLineDiff(beforeRaw, afterRaw);
  const hunks: TailorChangeHunk[] = [];
  let pendingRemoved: string[] = [];

  const flush = (added: string) => {
    if (pendingRemoved.length === 0 && !added) return;
    const from = pendingRemoved.join('\n');
    pendingRemoved = [];
    if (from || added) {
      hunks.push({
        kind: 'text',
        label: hunks.length === 0 ? 'Wording' : `Change ${hunks.length + 1}`,
        before: from,
        after: added,
      });
    }
  };

  for (const line of lines) {
    if (line.type === 'removed') {
      pendingRemoved.push(line.text);
    } else if (line.type === 'added') {
      flush(line.text);
    } else if (line.type === 'same') {
      flush('');
    }
  }
  flush('');

  return hunks.filter((h) => h.kind !== 'text' || h.before !== h.after);
}

/**
 * Structured before → after hunks for tailor suggestion cards.
 */
export function buildTailorSectionChanges(
  sectionType: string,
  beforeRaw: string,
  afterRaw: string,
  changedFields: string[] = [],
): TailorChangeHunk[] {
  const st = sectionType.trim().toLowerCase();
  const beforeParsed = parseSectionJson(beforeRaw);
  const afterParsed = parseSectionJson(afterRaw);
  const hunks: TailorChangeHunk[] = [];

  if (st === 'skills' || st === 'skill') {
    const bSkills = extractSkillList(beforeParsed);
    const aSkills = extractSkillList(afterParsed);
    const bSet = new Set(bSkills.map(normSkill));
    const aSet = new Set(aSkills.map(normSkill));
    const removed = bSkills.filter((s) => !aSet.has(normSkill(s)));
    const added = aSkills.filter((s) => !bSet.has(normSkill(s)));
    if (removed.length > 0 || added.length > 0) {
      hunks.push({ kind: 'skills', removed, added });
    }
    if (hunks.length > 0) return hunks;
  }

  if (st === 'summary' || st === 'profile') {
    const bText = extractSummaryText(beforeParsed) || (typeof beforeParsed === 'string' ? beforeParsed : '');
    const aText = extractSummaryText(afterParsed) || (typeof afterParsed === 'string' ? afterParsed : '');
    if (bText && aText && bText !== aText) {
      hunks.push({ kind: 'text', label: 'Professional summary', before: bText, after: aText });
      return hunks;
    }
  }

  if (st === 'experience' || st === 'work' || st === 'employment') {
    const bItems = extractExperienceItems(beforeParsed);
    const aItems = extractExperienceItems(afterParsed);
    const max = Math.max(bItems.length, aItems.length);
    for (let i = 0; i < max; i++) {
      const b = bItems[i];
      const a = aItems[i];
      const roleLabel = a
        ? [a.title, a.company].filter(Boolean).join(' · ')
        : b
          ? [b.title, b.company].filter(Boolean).join(' · ')
          : `Role ${i + 1}`;
      const bBullets = b?.bullets ?? [];
      const aBullets = a?.bullets ?? [];
      const bulletMax = Math.max(bBullets.length, aBullets.length);
      for (let j = 0; j < bulletMax; j++) {
        const bb = bBullets[j] ?? '';
        const ab = aBullets[j] ?? '';
        if (bb !== ab && (bb || ab)) {
          hunks.push({
            kind: 'bullet',
            label: bulletMax > 1 ? `${roleLabel} — bullet ${j + 1}` : roleLabel,
            before: bb || '(empty bullet)',
            after: ab || '(empty bullet)',
          });
        }
      }
    }
    if (hunks.length > 0) return hunks;
  }

  for (const field of changedFields) {
    const label = labelizeFieldPath(field);
    if (label && !hunks.some((h) => h.kind === 'text' && h.label === label)) {
      const bPlain = typeof beforeParsed === 'string' ? beforeParsed : beforeRaw.trim();
      const aPlain = typeof afterParsed === 'string' ? afterParsed : afterRaw.trim();
      if (bPlain && aPlain && bPlain !== aPlain) {
        hunks.push({ kind: 'text', label, before: bPlain.slice(0, 600), after: aPlain.slice(0, 600) });
      }
    }
  }

  const bPlain =
    extractSummaryText(beforeParsed) ||
    (typeof beforeParsed === 'string' ? beforeParsed : beforeRaw.trim());
  const aPlain =
    extractSummaryText(afterParsed) ||
    (typeof afterParsed === 'string' ? afterParsed : afterRaw.trim());

  if (bPlain && aPlain && bPlain !== aPlain) {
    hunks.push({ kind: 'text', label: sectionType ? labelizeFieldPath(sectionType) : 'Section', before: bPlain, after: aPlain });
    return hunks;
  }

  const lineSwaps = pairLineDiffSwaps(
    typeof beforeParsed === 'string' ? beforeParsed : beforeRaw,
    typeof afterParsed === 'string' ? afterParsed : afterRaw,
  );
  if (lineSwaps.length > 0) return lineSwaps.slice(0, 6);

  return hunks;
}

/**
 * Simple line-level diff for tailor before/after text blocks.
 * Green = added, red = removed (Grammarly-style inline lists).
 */
export function buildLineDiff(before: string, after: string): CvTailorDiffLine[] {
  const beforeLines = before.split(/\r?\n/).map((l) => l.trimEnd());
  const afterLines = after.split(/\r?\n/).map((l) => l.trimEnd());

  const result: CvTailorDiffLine[] = [];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i] ?? '';
    const a = afterLines[i] ?? '';
    if (b === a) {
      if (b) result.push({ type: 'same', text: b });
      continue;
    }
    if (b) result.push({ type: 'removed', text: b });
    if (a) result.push({ type: 'added', text: a });
  }
  return result;
}

/**
 * Word diff in reading order (keeps unchanged words for context).
 * Use for inline track-changes in narrow panels — not {@link buildWordDiff}.
 */
export function buildOrderedWordDiff(before: string, after: string): CvTailorDiffLine[] {
  const b = before.trim().split(/\s+/).filter(Boolean);
  const a = after.trim().split(/\s+/).filter(Boolean);
  if (b.length === 0 && a.length === 0) return [];
  if (b.length === 0) return a.map((text) => ({ type: 'added' as const, text }));
  if (a.length === 0) return b.map((text) => ({ type: 'removed' as const, text }));

  const n = b.length;
  const m = a.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        b[i]!.toLowerCase() === a[j]!.toLowerCase()
          ? 1 + dp[i + 1]![j + 1]!
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const result: CvTailorDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (b[i]!.toLowerCase() === a[j]!.toLowerCase()) {
      result.push({ type: 'same', text: a[j]! });
      i++;
      j++;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      result.push({ type: 'removed', text: b[i]! });
      i++;
    } else {
      result.push({ type: 'added', text: a[j]! });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: 'removed', text: b[i]! });
    i++;
  }
  while (j < m) {
    result.push({ type: 'added', text: a[j]! });
    j++;
  }
  return result;
}

/** Set diff — removed/added tokens only (skills chip lists). */
export function buildWordDiff(before: string, after: string): CvTailorDiffLine[] {
  const bTokens = before.trim().split(/\s+/).filter(Boolean);
  const aTokens = after.trim().split(/\s+/).filter(Boolean);
  const bSet = new Set(bTokens.map((t) => t.toLowerCase()));
  const aSet = new Set(aTokens.map((t) => t.toLowerCase()));
  const lines: CvTailorDiffLine[] = [];
  for (const t of bTokens) {
    if (!aSet.has(t.toLowerCase())) lines.push({ type: 'removed', text: t });
  }
  for (const t of aTokens) {
    if (!bSet.has(t.toLowerCase())) lines.push({ type: 'added', text: t });
  }
  if (lines.length === 0 && before.trim() === after.trim() && before.trim()) {
    lines.push({ type: 'same', text: before.trim() });
  }
  return lines;
}
