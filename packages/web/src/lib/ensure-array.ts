/**
 * Many APIs return `{ data: [...] }`, `{ items: [...] }`, or `{ applications: [...] }`
 * instead of a raw JSON array. Normalize to a real array for TanStack Query.
 */
const LIST_KEYS = [
  'data',
  'items',
  'results',
  'applications',
  'records',
  'list',
  'jobs',
  'sections',
] as const;

export function ensureArray<T>(data: unknown, depth = 0): T[] {
  if (depth > 5) {
    return [];
  }
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (data !== null && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const k of LIST_KEYS) {
      const v = o[k];
      if (Array.isArray(v)) {
        return v as T[];
      }
    }
    // Nested wrapper e.g. `{ data: { applications: [...] } }`
    const inner = o.data;
    if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
      return ensureArray<T>(inner, depth + 1);
    }
  }
  return [];
}
