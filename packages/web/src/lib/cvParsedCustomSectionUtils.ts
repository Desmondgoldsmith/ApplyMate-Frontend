import type { CVBuilderData, CVBuilderParsedCustomSection } from '@/lib/cvBuilder';

/** Importer / UK CV "references available upon request" as a duplicate custom section row. */
export function isUponRequestReferenceParsedSection(block: CVBuilderParsedCustomSection): boolean {
  const title = block.title.trim().toLowerCase();
  const refLike = title === 'reference' || title === 'references';
  if (!refLike) return false;
  const blob = [
    block.title,
    ...block.items.map((i) => i.text),
    ...block.items.flatMap((i) => i.subItems),
    ...(block.items.map((i) => i.date).filter(Boolean) as string[]),
  ]
    .join(' ')
    .toLowerCase();
  return (
    /\bavailable\s+upon\s+request\b/.test(blob) ||
    /\breferences?\s+available\s+upon\s+request\b/.test(blob) ||
    /\bupon\s+request\b/.test(blob)
  );
}

export function filterParsedCustomSectionsForEditor(
  blocks: CVBuilderParsedCustomSection[],
): CVBuilderParsedCustomSection[] {
  return blocks.filter((b) => !isUponRequestReferenceParsedSection(b));
}

/** Legacy `custom-legacy` block — hide when API already has `custom_*` section rows. */
export function shouldRenderCustomLegacySection(
  data: Pick<CVBuilderData, 'customSections' | 'parsedCustomSections'>,
  inline: boolean,
): boolean {
  if (filterParsedCustomSectionsForEditor(data.parsedCustomSections).length > 0) {
    return false;
  }
  return inline || data.customSections.some((x) => x.title.trim() || x.body.trim());
}

export function orderedParsedPreviewKeys(
  sectionOrder: string[] | undefined,
  blocks: CVBuilderParsedCustomSection[],
): string[] {
  const keys = filterParsedCustomSectionsForEditor(blocks).map((b) => `parsed-${b.sectionId}`);
  if (!sectionOrder?.length) return keys;
  const fromOrder = sectionOrder.filter((k) => k.startsWith('parsed-') && keys.includes(k));
  const seen = new Set(fromOrder);
  return [...fromOrder, ...keys.filter((k) => !seen.has(k))];
}

export function parsedCustomMainPlaceholder(sectionType: string): string {
  const t = sectionType.toLowerCase();
  if (t.includes('interest')) return 'Interest or hobby (e.g. Open-source, hiking)';
  if (t.includes('publication')) return 'Publication title';
  if (t.includes('volunteer')) return 'Role or organization';
  if (t.includes('award') || t.includes('honor')) return 'Award or honor';
  return 'Entry title or summary';
}

export function parsedCustomDatePlaceholder(sectionType: string, range: boolean): string {
  const t = sectionType.toLowerCase();
  if (range) return 'Date range (From – To)';
  if (t.includes('publication')) return 'Year or date published';
  if (t.includes('volunteer')) return 'Date or year';
  return 'Date (optional)';
}

export function parsedCustomBulletPlaceholder(sectionType: string): string {
  const t = sectionType.toLowerCase();
  if (t.includes('interest')) return 'Optional detail';
  if (t.includes('publication')) return 'Journal, venue, or URL';
  if (t.includes('volunteer')) return 'Impact or responsibility';
  return 'Detail bullet';
}
