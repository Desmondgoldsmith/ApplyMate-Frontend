export type TailorExperienceItem = {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  duration: string;
  roleLabel: string;
  current: boolean;
  bullets: string[];
};

function parseSectionJson(raw: string): unknown {
  const t = raw?.trim() ?? '';
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function strField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseTailorExperienceItems(raw: string): TailorExperienceItem[] {
  const parsed = parseSectionJson(raw);
  if (!parsed || typeof parsed !== 'object') return [];
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const x = it as Record<string, unknown>;
      const title = strField(x.title ?? x.role ?? x.position) || 'Role';
      const company = strField(x.company ?? x.organization);
      const startDate = strField(x.startDate ?? x.start);
      const endDate = strField(x.endDate ?? x.end);
      const duration = strField(x.duration);
      const roleLabel = strField(x.roleLabel ?? x.role_label);
      const current = x.current === true;
      const bullets = Array.isArray(x.bullets)
        ? x.bullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).map((b) => b.trim())
        : [];
      return { title, company, startDate, endDate, duration, roleLabel, current, bullets };
    })
    .filter((x): x is TailorExperienceItem => x !== null);
}

function formatExperienceDates(item: TailorExperienceItem): string | null {
  const duration = item.duration.trim();
  if (duration) return duration;
  const start = item.startDate.trim();
  const end = item.endDate.trim();
  if (item.current && start) return `${start} – Present`;
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return null;
}

/** User-facing label for one experience row, e.g. "Frontend Developer at Dummy Group (Jul 2024 – Dec 2025)". */
export function formatExperienceRoleLabel(item: TailorExperienceItem): string {
  if (item.roleLabel.trim()) return item.roleLabel.trim();
  const title = item.title.trim() || 'Role';
  const company = item.company.trim();
  const base = company ? `${title} at ${company}` : title;
  const dates = formatExperienceDates(item);
  return dates ? `${base} (${dates})` : base;
}

function itemIndexFromChangedField(path: string): number | null {
  const match = path.match(/items\[(\d+)\]/i);
  if (!match) return null;
  const idx = Number(match[1]);
  return Number.isFinite(idx) ? idx : null;
}

/**
 * Map machine paths like `items[2].bullets[1]` to readable role labels from the diff payload.
 */
export function resolveExperienceRoleLabelsFromChangedFields(
  changedFields: string[],
  beforeRaw: string,
  afterRaw: string,
): string[] {
  const indices = new Set<number>();
  for (const path of changedFields) {
    const idx = itemIndexFromChangedField(path);
    if (idx !== null) indices.add(idx);
  }
  if (indices.size === 0) return [];

  const afterItems = parseTailorExperienceItems(afterRaw);
  const beforeItems = parseTailorExperienceItems(beforeRaw);
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const idx of [...indices].sort((a, b) => a - b)) {
    const item = afterItems[idx] ?? beforeItems[idx];
    if (!item) continue;
    const label = formatExperienceRoleLabel(item);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels;
}
