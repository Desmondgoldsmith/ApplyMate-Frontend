import { coerceAiPatchToDisplayString } from '@/lib/cvAiPatchDisplay';

/**
 * Human-readable strings for CV assistant diff UI.
 *
 * **Summary (`targetSection === 'summary'`) — backend contract (narrow diff):**
 * - `diff.before` / `diff.after` are slices like `{ summary: { text: string } }` (or legacy string `summary`).
 * - Top-level `diff.summary` on the API **response** is only the one-line change blurb (same as `diffSummary`);
 *   it is **not** CV body text — use `diff.after.summary.text` (via this helper) for the proposed paragraph.
 *
 * Other sections may still send larger before/after shapes until narrowed server-side.
 */

/** Mirrors backend `readCvDataSummaryText`: summary string whether `summary` is a string or `{ text }`. */
export function readCvDataSummaryText(cv: unknown): string {
  if (cv == null) return '';
  if (typeof cv === 'string') return cv;
  if (typeof cv !== 'object') return '';
  const o = cv as Record<string, unknown>;
  const s = o.summary;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object' && s !== null && 'text' in s) {
    const t = (s as { text?: unknown }).text;
    if (typeof t === 'string') return t;
  }
  return '';
}

function trimToMax(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function readTextField(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'text' in (value as object)) {
    const t = (value as { text?: unknown }).text;
    if (typeof t === 'string') return t.trim();
  }
  return '';
}

function formatExperienceItems(items: unknown[]): string {
  const lines: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const title = String(it.title ?? it.role ?? it.position ?? '').trim();
    const company = String(
      it.company ?? it.employer ?? it.organization ?? '',
    ).trim();
    const headline = [title, company].filter(Boolean).join(' · ');
    if (headline) lines.push(headline);
    const desc = readTextField(it.description) || readTextField(it.summary);
    if (desc) lines.push(desc);
    const bullets = it.bullets ?? it.highlights ?? it.achievements;
    if (Array.isArray(bullets)) {
      for (const b of bullets) {
        const s = typeof b === 'string' ? b.trim() : readTextField(b);
        if (s) lines.push(`• ${s}`);
      }
    }
    if (lines.length) lines.push('');
  }
  return lines.join('\n').trim();
}

function formatEducationItems(items: unknown[]): string {
  const lines: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const school = String(it.school ?? it.institution ?? '').trim();
    const degree = String(it.degree ?? it.qualification ?? '').trim();
    const field = String(it.field ?? it.major ?? '').trim();
    const headline = [degree, field, school].filter(Boolean).join(' · ');
    if (headline) lines.push(headline);
    const desc = readTextField(it.description);
    if (desc) lines.push(desc);
    if (lines.length) lines.push('');
  }
  return lines.join('\n').trim();
}

function formatSkillsBlob(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const o = value as Record<string, unknown>;
  const categories = o.categories;
  if (Array.isArray(categories)) {
    return categories
      .map((cat) => {
        if (!cat || typeof cat !== 'object') return '';
        const c = cat as Record<string, unknown>;
        const name = String(c.name ?? c.category ?? '').trim();
        const skills = c.skills ?? c.items;
        const list = Array.isArray(skills)
          ? skills
              .map((s) => (typeof s === 'string' ? s.trim() : ''))
              .filter(Boolean)
          : [];
        if (!name && list.length === 0) return '';
        return list.length ? `${name}: ${list.join(', ')}` : name;
      })
      .filter(Boolean)
      .join('\n');
  }
  const flat = o.skills ?? o.items;
  if (Array.isArray(flat)) {
    return flat
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

function formatGenericItems(items: unknown[]): string {
  const lines: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const title = String(it.title ?? it.name ?? '').trim();
    if (title) lines.push(title);
    const body =
      readTextField(it.body) ||
      readTextField(it.description) ||
      readTextField(it.summary);
    if (body) lines.push(body);
    if (lines.length) lines.push('');
  }
  return lines.join('\n').trim();
}

function formatSectionBlob(targetSection: string, value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return String(value);
  const o = value as Record<string, unknown>;
  const ts = targetSection.trim().toLowerCase();

  if (ts === 'summary') {
    const t = readCvDataSummaryText(value);
    if (t.trim()) return t.trim();
  }

  if ('text' in o && typeof o.text === 'string' && Object.keys(o).length <= 2) {
    return o.text.trim();
  }

  const items = o.items;
  if (Array.isArray(items)) {
    if (ts === 'experience' || ts === 'experiences')
      return formatExperienceItems(items);
    if (ts === 'education') return formatEducationItems(items);
    if (ts === 'skills')
      return formatSkillsBlob(value) || formatGenericItems(items);
    return formatGenericItems(items);
  }

  if (ts === 'skills') {
    const skills = formatSkillsBlob(value);
    if (skills) return skills;
  }

  if (ts === 'personal') {
    const parts = [
      o.fullName,
      o.name,
      o.email,
      o.phone,
      o.location,
      o.city,
      o.linkedin,
      o.website,
    ]
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean);
    if (parts.length) return parts.join('\n');
  }

  return '';
}

function readTargetFromBlob(
  targetSection: string,
  blob: unknown,
  maxJson: number,
  allowCoerceFallback = true,
): string {
  const ts = targetSection.trim().toLowerCase();
  if (!ts) return '';
  if (ts === 'summary') {
    const fromSummary = readCvDataSummaryText(blob);
    if (fromSummary.trim()) return fromSummary;
  }
  if (blob == null) return '';
  if (typeof blob === 'string') return trimToMax(blob, maxJson);
  if (typeof blob !== 'object') return trimToMax(String(blob), maxJson);
  const o = blob as Record<string, unknown>;
  const direct = o[ts];
  if (typeof direct === 'string') return trimToMax(direct, maxJson);
  if (direct != null) {
    const formatted = formatSectionBlob(ts, direct);
    if (formatted) return trimToMax(formatted, maxJson);
  }
  if (ts === 'summary') {
    const again = readCvDataSummaryText(blob);
    if (again) return trimToMax(again, maxJson);
  }
  const whole = formatSectionBlob(ts, blob);
  if (whole) return trimToMax(whole, maxJson);

  if (!allowCoerceFallback) return '';

  const fromPatch = coerceAiPatchToDisplayString(blob, ts);
  if (fromPatch.trim()) return trimToMax(fromPatch, maxJson);

  return '';
}

/**
 * Section-scoped display text without patch coercion (used by cvAiPatchDisplay to avoid cycles).
 */
export function assistantSectionBlobToDisplayString(
  targetSection: string,
  blob: unknown,
  maxJson = 12000,
): string {
  return readTargetFromBlob(targetSection, blob, maxJson, false);
}

export function assistantDiffDisplayStrings(
  targetSection: string,
  before: unknown,
  after: unknown,
  maxJson = 12000,
): { before: string; after: string } {
  return {
    before: readTargetFromBlob(targetSection, before, maxJson),
    after: readTargetFromBlob(targetSection, after, maxJson),
  };
}

export function assistantChangedFieldLabel(targetSection: string): string {
  const t = targetSection.trim().toLowerCase();
  if (t === 'summary') return 'Summary';
  if (!t) return 'Update';
  return t.charAt(0).toUpperCase() + t.slice(1);
}
