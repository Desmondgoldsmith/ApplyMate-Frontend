import type { CVSectionRecord } from '@/lib/api';

/** Canonical section type ordering (shared across CV templates). */
/**
 * Baseline preview keys when `sectionOrder` is not passed yet — must match typical CV layout
 * (summary first) so drag/drop `reorderSectionKeys` uses the same order the user sees.
 */
export const DEFAULT_PREVIEW_DRAG_SECTION_ORDER: readonly string[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'achievements',
  'languages',
  'references',
];

export const PROFESSIONAL_SECTION_TYPE_ORDER = [
  'personal',
  'links',
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'languages',
  'achievements',
  'references',
  'volunteering',
  'interests',
  'publications',
] as const;

export function professionalSectionRank(type: string): number {
  const tl = type.toLowerCase();
  if (tl === 'custom' || tl.startsWith('custom_')) return 950;
  const idx = PROFESSIONAL_SECTION_TYPE_ORDER.indexOf(tl as (typeof PROFESSIONAL_SECTION_TYPE_ORDER)[number]);
  if (idx >= 0) return idx;
  return 900;
}

/** Insert `newSectionId` at the first slot that matches canonical type order while preserving relative order of other rows. */
export function insertNewSectionIdProfessionally(rows: CVSectionRecord[], newSectionId: string): string[] {
  const byOrder = [...rows].sort((a, b) => a.order - b.order);
  const idOrder = byOrder.map((r) => r.id);
  const newRow = rows.find((r) => r.id === newSectionId);
  if (!newRow) return idOrder;
  const rNew = professionalSectionRank(newRow.type);
  const without = idOrder.filter((id) => id !== newSectionId);
  const rowsById = new Map(rows.map((r) => [r.id, r]));
  let insertAt = without.length;
  for (let i = 0; i < without.length; i++) {
    const r = rowsById.get(without[i]!);
    if (!r) continue;
    if (professionalSectionRank(r.type) > rNew) {
      insertAt = i;
      break;
    }
  }
  return [...without.slice(0, insertAt), newSectionId, ...without.slice(insertAt)];
}

/** Remove duplicate preview keys while keeping first-seen order (duplicates break drag/reorder). */
export function dedupePreviewSectionKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
