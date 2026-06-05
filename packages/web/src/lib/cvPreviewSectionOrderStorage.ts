const KEY_PREFIX = 'cv-preview-section-order:';

export function readStoredPreviewSectionOrder(profileId: string): string[] | null {
  if (typeof window === 'undefined' || !profileId.trim()) return null;
  try {
    const raw = window.sessionStorage.getItem(`${KEY_PREFIX}${profileId.trim()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
  } catch {
    return null;
  }
}

export function writeStoredPreviewSectionOrder(profileId: string, order: string[]): void {
  if (typeof window === 'undefined' || !profileId.trim() || order.length === 0) return;
  try {
    window.sessionStorage.setItem(`${KEY_PREFIX}${profileId.trim()}`, JSON.stringify(order));
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredPreviewSectionOrder(profileId: string): void {
  if (typeof window === 'undefined' || !profileId.trim()) return;
  try {
    window.sessionStorage.removeItem(`${KEY_PREFIX}${profileId.trim()}`);
  } catch {
    /* ignore */
  }
}
