export type HubNoteListItem = {
  id: string;
  body: string;
  savedAt: string;
};

function storageKey(jobKey: string) {
  return `applymate:job-hub:notes-entries:${jobKey}`;
}

function readAll(jobKey: string): HubNoteListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(jobKey));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is HubNoteListItem =>
        x &&
        typeof x === 'object' &&
        typeof (x as HubNoteListItem).id === 'string' &&
        typeof (x as HubNoteListItem).body === 'string' &&
        typeof (x as HubNoteListItem).savedAt === 'string',
    );
  } catch {
    return [];
  }
}

function writeAll(jobKey: string, rows: HubNoteListItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(jobKey), JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

/** Newest first (for display). */
export function listNoteEntries(jobKey: string): HubNoteListItem[] {
  return readAll(jobKey).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

const MAX_ENTRIES = 40;

function newId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/** If there are no entries yet, seed one row from the current primary note text (migration / first open). */
export function seedNoteEntriesIfEmpty(jobKey: string, primaryBody: string) {
  const trimmed = primaryBody.trim();
  if (!trimmed) return;
  const all = readAll(jobKey);
  if (all.length > 0) return;
  writeAll(jobKey, [{ id: newId(), body: primaryBody, savedAt: new Date().toISOString() }]);
}

/**
 * Append a new list row when the saved body differs from the newest stored entry (avoids duplicate rows on re-save).
 */
export function appendNoteEntryIfChanged(jobKey: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const sorted = listNoteEntries(jobKey);
  const newest = sorted[0];
  if (newest && newest.body.trim() === trimmed) return;
  const next = [{ id: newId(), body, savedAt: new Date().toISOString() }, ...sorted];
  writeAll(jobKey, next.slice(0, MAX_ENTRIES));
}

export function removeNoteEntry(jobKey: string, id: string) {
  writeAll(
    jobKey,
    readAll(jobKey).filter((r) => r.id !== id),
  );
}
