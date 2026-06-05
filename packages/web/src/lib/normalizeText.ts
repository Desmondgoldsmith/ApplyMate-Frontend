/**
 * Coerce API / structured CV values into plain strings for inputs, previews, and PDFs.
 * Prevents `[object Object]` when a field is stored as `{ text }` / `{ content }` or similar.
 */
export function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('text' in o && typeof o.text === 'string') {
      return o.text;
    }
    if ('content' in o && typeof o.content === 'string') {
      return o.content;
    }
    const action = o.action ?? o.op;
    if (
      typeof action === 'string' &&
      typeof o.value === 'string' &&
      (o.field != null || o.path != null || o.fieldPath != null)
    ) {
      return o.value;
    }
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

/** Belt-and-suspenders for `<input value>` / `<textarea value>` (alias of {@link normalizeText}). */
export function toInputString(value: unknown): string {
  return normalizeText(value);
}
