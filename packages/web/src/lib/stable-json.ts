/** Deep sort object keys so JSON comparison ignores key order (avoids save loops vs API). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      sorted[k] = sortKeysDeep(o[k]);
    }
    return sorted;
  }
  return value;
}

/** Strip server-only ids from section items for equality checks (optional). */
export function stripNestedIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = { ...(item as Record<string, unknown>) };
        delete o.id;
        return stripNestedIds(o);
      }
      return item;
    });
  }
  if (value && typeof value === 'object') {
    const o = { ...(value as Record<string, unknown>) };
    delete o.id;
    for (const k of Object.keys(o)) {
      o[k] = stripNestedIds(o[k]) as unknown;
    }
    return o;
  }
  return value;
}

export function stableStringifySectionPayload(data: Record<string, unknown> | undefined): string {
  return stableStringify(stripNestedIds(data ?? {}));
}
