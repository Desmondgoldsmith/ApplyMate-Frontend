import type { CVBuilderData } from '@/lib/cvBuilder';

const ID_KEYS = new Set(['id', '_id', 'localId', 'sectionId']);

function isBlankValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') {
    return (
      value
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim() === ''
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isBlankValue);
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).every(
      ([key, v]) => ID_KEYS.has(key) || isBlankValue(v),
    );
  }
  return true;
}

function withoutBlank<T>(items: T[]): T[] {
  return items.filter((item) => !isBlankValue(item));
}

/** Optional sections with nothing left to show are hidden, so no empty heading is printed. */
export function printSectionVisibility(
  printData: CVBuilderData,
  visibility: Record<string, boolean> | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = { ...(visibility ?? {}) };
  const lists: Record<string, unknown[]> = {
    projects: printData.projects,
    certifications: printData.certifications,
    languages: printData.languages,
    achievements: printData.achievements,
    references: printData.references,
  };
  for (const [key, items] of Object.entries(lists)) {
    if (items.length === 0) out[key] = false;
  }
  return out;
}

/**
 * The CV as it should be printed: rows the editor created but the user never filled in are
 * dropped, so a download never shows an empty "Projects" or a lone bullet.
 */
export function cvDataForPrint(data: CVBuilderData): CVBuilderData {
  return {
    ...data,
    experience: {
      ...data.experience,
      items: withoutBlank(data.experience.items),
    },
    education: { ...data.education, items: withoutBlank(data.education.items) },
    projects: withoutBlank(data.projects),
    certifications: withoutBlank(data.certifications),
    languages: withoutBlank(data.languages),
    achievements: withoutBlank(data.achievements),
    references: withoutBlank(data.references),
    customSections: withoutBlank(data.customSections),
  };
}
