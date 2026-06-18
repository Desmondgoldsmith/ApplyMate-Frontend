import type { ApplicationItem } from '@/lib/api';

export const ARCHIVE_NUDGE_DISMISS_STORAGE_KEY = 'applymate:archive:dismissed';

export const STALE_APPLICATION_NUDGE_DAYS = 21;
export const MAX_STALE_APPLICATION_NUDGES = 2;

export type StaleApplicationNudge = {
  applicationId: string;
  jobTitle: string;
  company: string;
  daysSinceUpdate: number;
};

const TERMINAL_STATUSES = new Set([
  'offer_received',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'ARCHIVED',
]);

const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export function readArchiveNudgeDismissals(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ARCHIVE_NUDGE_DISMISS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === 'string' && typeof value === 'string' && value.trim()) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeArchiveNudgeDismissal(applicationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = readArchiveNudgeDismissals();
    prev[applicationId] = new Date().toISOString();
    window.localStorage.setItem(
      ARCHIVE_NUDGE_DISMISS_STORAGE_KEY,
      JSON.stringify(prev),
    );
  } catch {
    /* ignore */
  }
}

export function isArchiveNudgeDismissed(
  applicationId: string,
  dismissed: Record<string, string>,
): boolean {
  const at = dismissed[applicationId];
  if (!at) return false;
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms < DISMISS_MS;
}

function daysSince(iso: string | undefined, nowMs: number): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((nowMs - ms) / 86_400_000));
}

function isTerminalApplicationStatus(status: string | undefined): boolean {
  if (!status?.trim()) return false;
  const s = status.trim();
  if (TERMINAL_STATUSES.has(s)) return true;
  return TERMINAL_STATUSES.has(s.toLowerCase());
}

/** Active applications with no update for 21+ days (max 2, oldest first). */
export function selectStaleApplicationNudges(
  applications: ApplicationItem[] | undefined,
  dismissed: Record<string, string>,
  nowMs = Date.now(),
): StaleApplicationNudge[] {
  if (!applications?.length) return [];

  const candidates: StaleApplicationNudge[] = [];

  for (const app of applications) {
    if (!app.id?.trim()) continue;
    if (isTerminalApplicationStatus(app.status)) continue;

    const lastIso = app.lastActivityAt ?? app.createdAt;
    const days = daysSince(lastIso, nowMs);
    if (days == null || days < STALE_APPLICATION_NUDGE_DAYS) continue;
    if (isArchiveNudgeDismissed(app.id, dismissed)) continue;

    candidates.push({
      applicationId: app.id,
      jobTitle: app.title?.trim() || 'Untitled role',
      company: app.company?.trim() || 'Unknown company',
      daysSinceUpdate: days,
    });
  }

  candidates.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
  return candidates.slice(0, MAX_STALE_APPLICATION_NUDGES);
}
