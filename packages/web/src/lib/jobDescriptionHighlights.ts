import type {
  JobDescriptionHighlightSection,
  JobDescriptionHighlights,
  JobDescriptionHighlightTerm,
} from '@/lib/api';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlight all case-insensitive matches of each term in plain text. */
export function splitTextWithHighlights(
  text: string,
  terms: JobDescriptionHighlightTerm[],
): Array<{ text: string; highlight: boolean }> {
  const trimmed = text.trim();
  if (!trimmed || terms.length === 0) {
    return trimmed ? [{ text: trimmed, highlight: false }] : [];
  }

  const uniqueTerms = [...terms]
    .map((t) => t.text.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (uniqueTerms.length === 0) {
    return [{ text: trimmed, highlight: false }];
  }

  const pattern = uniqueTerms.map(escapeRegExp).join('|');
  const re = new RegExp(`(${pattern})`, 'gi');
  const parts = trimmed.split(re).filter((part) => part.length > 0);

  return parts.map((part) => ({
    text: part,
    highlight: uniqueTerms.some(
      (term) => part.localeCompare(term, undefined, { sensitivity: 'accent' }) === 0,
    ),
  }));
}

export function hasStructuredDescriptionSections(
  highlights: JobDescriptionHighlights | null | undefined,
): boolean {
  return Boolean(highlights?.sections?.some((section) => sectionHasContent(section)));
}

function sectionHasContent(section: JobDescriptionHighlightSection): boolean {
  if (section.format === 'bullets') {
    return (section.items?.some((item) => item.trim()) ?? false);
  }
  return Boolean(section.body?.trim());
}

export function descriptionSectionsFromHighlights(
  highlights: JobDescriptionHighlights | null | undefined,
): JobDescriptionHighlightSection[] {
  if (!highlights?.sections?.length) return [];
  return highlights.sections.filter(sectionHasContent);
}
