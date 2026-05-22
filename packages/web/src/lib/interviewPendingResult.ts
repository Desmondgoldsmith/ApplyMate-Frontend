const STORAGE_KEY = 'applymate:interview-pending-results';

export type PendingInterviewResult = {
  sessionId: string;
  label?: string;
  startedAt: string;
};

function readAll(): PendingInterviewResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingInterviewResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: PendingInterviewResult[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function listPendingInterviewResults(): PendingInterviewResult[] {
  return readAll();
}

export function markInterviewPendingResult(sessionId: string, label?: string): void {
  if (!sessionId) return;
  const items = readAll().filter((i) => i.sessionId !== sessionId);
  items.unshift({
    sessionId,
    label: label?.trim() || undefined,
    startedAt: new Date().toISOString(),
  });
  writeAll(items.slice(0, 12));
}

export function clearInterviewPendingResult(sessionId: string): void {
  if (!sessionId) return;
  writeAll(readAll().filter((i) => i.sessionId !== sessionId));
}
