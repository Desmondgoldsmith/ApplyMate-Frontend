import type { CVSectionRecord } from '@/lib/api';

function itemsNonEmpty(data: Record<string, unknown> | undefined): boolean {
  const items = data?.items;
  return Array.isArray(items) && items.length > 0;
}

/** True when the skills section row has any non-empty skill strings (categories or flat list). */
export function skillsSectionHasDisplayableContent(sections: CVSectionRecord[] | undefined): boolean {
  const s = sections?.find((x) => x.type.toLowerCase() === 'skills');
  const d = s?.data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  const o = d as Record<string, unknown>;
  const cats = o.categories;
  if (Array.isArray(cats)) {
    for (const c of cats) {
      if (!c || typeof c !== 'object') continue;
      const skills = (c as { skills?: unknown }).skills;
      if (Array.isArray(skills) && skills.some((x) => typeof x === 'string' && x.trim().length > 0)) return true;
    }
  }
  const flat = o.skills;
  if (Array.isArray(flat) && flat.some((x) => typeof x === 'string' && x.trim().length > 0)) return true;
  return false;
}

export function educationSectionHasItems(sections: CVSectionRecord[] | undefined): boolean {
  const s = sections?.find((x) => x.type.toLowerCase() === 'education');
  return itemsNonEmpty(s?.data as Record<string, unknown> | undefined);
}

export function experienceSectionHasItems(sections: CVSectionRecord[] | undefined): boolean {
  const s = sections?.find((x) => x.type.toLowerCase() === 'experience');
  return itemsNonEmpty(s?.data as Record<string, unknown> | undefined);
}

/**
 * When `profile.structured` is empty but core sections were rebuilt into `sections` rows (common after upload),
 * the UI should not treat the CV as “missing” education/skills/experience.
 */
export function coreCvContentPresentInSections(sections: CVSectionRecord[] | undefined): boolean {
  return (
    educationSectionHasItems(sections) ||
    experienceSectionHasItems(sections) ||
    skillsSectionHasDisplayableContent(sections)
  );
}
