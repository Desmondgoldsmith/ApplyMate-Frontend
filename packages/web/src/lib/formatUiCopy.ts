/** Normalize AI-style em dashes in user-facing copy. */
export function formatUiCopy(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+,\s+/g, ', ')
    .replace(/,\s*,/g, ',')
    .trim();
}
