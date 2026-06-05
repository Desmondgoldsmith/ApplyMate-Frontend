import type { CVBuilderData } from '@/lib/cvBuilder';

/** Resolve display title — parsed custom sections read from persisted builder data. */
export function resolveSectionDisplayTitle(
  sectionId: string,
  fallback: string,
  data: CVBuilderData,
  overrides: Record<string, string>,
): string {
  if (sectionId.startsWith('parsed-')) {
    const sid = sectionId.slice('parsed-'.length);
    const block = data.parsedCustomSections.find((b) => b.sectionId === sid);
    const fromData = block?.title?.trim();
    if (fromData) return fromData;
  }
  return overrides[sectionId]?.trim() || fallback;
}

/** Persist renamed section headings — custom/parsed rows save into builder data (autosave). */
export function persistSectionTitleChange(
  sectionId: string,
  rawTitle: string,
  fallback: string,
  data: CVBuilderData,
  onUpdate?: (patch: Partial<CVBuilderData>) => void,
): string {
  const title = rawTitle.trim() || fallback;
  if (sectionId.startsWith('parsed-') && onUpdate) {
    const sid = sectionId.slice('parsed-'.length);
    onUpdate({
      parsedCustomSections: data.parsedCustomSections.map((b) =>
        b.sectionId === sid ? { ...b, title } : b,
      ),
    });
    return title;
  }
  return title;
}
