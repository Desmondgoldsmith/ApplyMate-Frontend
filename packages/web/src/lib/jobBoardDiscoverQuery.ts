/** Prefer "Accra" from "Accra, Greater Accra Region" for compact UI labels (e.g. collapsed filters). */
export function compactLocationForJobSearch(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const comma = t.indexOf(',');
  if (comma > 1 && comma < t.length - 1) {
    const left = t.slice(0, comma).trim();
    if (left.length >= 2 && left.length <= 80) return left;
  }
  return t.length > 80 ? t.slice(0, 80).trim() : t;
}
