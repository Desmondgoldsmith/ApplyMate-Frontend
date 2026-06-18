/** Plain-language dashboard copy helpers (display-only; does not mutate API payloads). */

export function cleanAiText(text: string | null | undefined): string {
  if (!text?.trim()) return '';
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeDashboardDisplayText(text: string | null | undefined): string {
  return cleanAiText(text);
}

/** Strip priority / confidence badges from focus task meta lines. */
export function sanitizeFocusMetaLine(metaLine: string | null | undefined): string | null {
  if (!metaLine?.trim()) return null;
  const cleaned = metaLine
    .replace(/\s*Confidence\s+\d+%\s*/gi, '')
    .replace(/\s*\d+%\s*priority\s*/gi, '')
    .replace(/\s*Action signal\s+\d+%\s*/gi, '')
    .replace(/\s*Signal\s+\d+%\s*/gi, '')
    .replace(/(?:\s*·\s*)+/g, ' · ')
    .replace(/^[\s·]+|[\s·]+$/g, '')
    .trim();
  return cleaned || null;
}
