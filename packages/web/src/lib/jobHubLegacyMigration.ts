import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import {
  hubNoteScopeFromJob,
  hubNotesQueryKey,
  type HubNoteScope,
} from '@/lib/hubNotesQueryKeys';

export const JOB_HUB_MIGRATION_FLAG = 'applymate:job-hub:migrated-notes-v1';

export type JobHubMigrationJob = {
  key: string;
  jobAnalysisId: string | null;
  applicationId: string | null;
  hubBookmarkId?: string | null;
};

const NOTES_LOCAL_PREFIX = 'applymate:job-hub:notes-local:';
const NOTES_ENTRIES_PREFIX = 'applymate:job-hub:notes-entries:';
const LOCAL_REMINDERS_KEY = 'applymate:job-hub:local-reminders';

type LegacyNoteEntry = { id: string; body: string; savedAt: string };
type LegacyLocalReminder = {
  id: string;
  jobKey: string;
  remindAt: string;
  message: string;
  source?: 'device' | 'server';
};

export function isJobHubMigrationComplete(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(JOB_HUB_MIGRATION_FLAG) === '1';
  } catch {
    return true;
  }
}

export function hasLegacyJobHubStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith(NOTES_LOCAL_PREFIX) ||
        k.startsWith(NOTES_ENTRIES_PREFIX) ||
        k === LOCAL_REMINDERS_KEY
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function readLegacyNoteEntries(jobKey: string): LegacyNoteEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${NOTES_ENTRIES_PREFIX}${jobKey}`);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is LegacyNoteEntry =>
        x &&
        typeof x === 'object' &&
        typeof (x as LegacyNoteEntry).body === 'string' &&
        (x as LegacyNoteEntry).body.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function readLegacyPrimaryNote(jobKey: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(`${NOTES_LOCAL_PREFIX}${jobKey}`)?.trim() ?? '';
  } catch {
    return '';
  }
}

function readLegacyReminders(): LegacyLocalReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_REMINDERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is LegacyLocalReminder =>
        x &&
        typeof x === 'object' &&
        typeof (x as LegacyLocalReminder).jobKey === 'string' &&
        typeof (x as LegacyLocalReminder).remindAt === 'string' &&
        typeof (x as LegacyLocalReminder).message === 'string',
    );
  } catch {
    return [];
  }
}

export function resolveJobKeyToScope(
  jobKey: string,
  jobs: JobHubMigrationJob[],
): HubNoteScope | null {
  const direct = jobs.find(
    (j) =>
      j.key === jobKey ||
      j.jobAnalysisId === jobKey ||
      j.applicationId === jobKey,
  );
  if (direct) return hubNoteScopeFromJob(direct);

  if (jobKey.startsWith('hubbk:')) {
    const bookmarkId = jobKey.slice('hubbk:'.length);
    const bm = jobs.find((j) => j.hubBookmarkId === bookmarkId || j.key === jobKey);
    if (bm) return hubNoteScopeFromJob(bm);
    if (bookmarkId) return { kind: 'bookmark', bookmarkId };
  }

  return null;
}

function resolveReminderTargets(
  jobKey: string,
  jobs: JobHubMigrationJob[],
): { jobAnalysisId?: string; jobBookmarkId?: string } | null {
  const job = jobs.find(
    (j) =>
      j.key === jobKey ||
      j.jobAnalysisId === jobKey ||
      j.applicationId === jobKey ||
      j.key === jobKey,
  );
  if (job?.jobAnalysisId) return { jobAnalysisId: job.jobAnalysisId };
  if (job?.hubBookmarkId) return { jobBookmarkId: job.hubBookmarkId };
  if (jobKey.startsWith('hubbk:')) {
    const bookmarkId = jobKey.slice('hubbk:'.length);
    if (bookmarkId) return { jobBookmarkId: bookmarkId };
  }
  return null;
}

function collectLegacyJobKeys(): string[] {
  const keys = new Set<string>();
  if (typeof window === 'undefined') return [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(NOTES_LOCAL_PREFIX)) {
        keys.add(k.slice(NOTES_LOCAL_PREFIX.length));
      } else if (k.startsWith(NOTES_ENTRIES_PREFIX)) {
        keys.add(k.slice(NOTES_ENTRIES_PREFIX.length));
      }
    }
    for (const r of readLegacyReminders()) {
      if (r.jobKey) keys.add(r.jobKey);
    }
  } catch {
    /* ignore */
  }
  return [...keys];
}

async function postNote(scope: HubNoteScope, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  switch (scope.kind) {
    case 'application':
      await api.applications.createNote(scope.applicationId, trimmed);
      break;
    case 'job-analysis':
      await api.jobs.createNote(scope.jobAnalysisId, trimmed);
      break;
    case 'bookmark':
      await api.jobDiscovery.createBookmarkNote(scope.bookmarkId, trimmed);
      break;
  }
}

async function migrateNotesForJobKey(
  jobKey: string,
  jobs: JobHubMigrationJob[],
): Promise<void> {
  const scope = resolveJobKeyToScope(jobKey, jobs);
  if (!scope) return;

  let existing: { body: string }[] = [];
  try {
    switch (scope.kind) {
      case 'application':
        existing = await api.applications.listNotes(scope.applicationId);
        break;
      case 'job-analysis':
        existing = await api.jobs.listNotes(scope.jobAnalysisId);
        break;
      case 'bookmark':
        existing = await api.jobDiscovery.listBookmarkNotes(scope.bookmarkId);
        break;
    }
  } catch {
    existing = [];
  }

  const existingBodies = new Set(existing.map((n) => n.body.trim()));

  const entries = readLegacyNoteEntries(jobKey);
  const primary = readLegacyPrimaryNote(jobKey);

  const bodies: string[] = [];
  if (entries.length > 0) {
    for (const e of [...entries].sort(
      (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime(),
    )) {
      const t = e.body.trim();
      if (t && !existingBodies.has(t)) {
        bodies.push(e.body);
        existingBodies.add(t);
      }
    }
  } else if (primary && !existingBodies.has(primary)) {
    bodies.push(primary);
  }

  for (const body of bodies) {
    await postNote(scope, body);
  }
}

async function migrateReminders(jobs: JobHubMigrationJob[]): Promise<void> {
  const rows = readLegacyReminders().filter((r) => r.source !== 'server');
  for (const r of rows) {
    const target = resolveReminderTargets(r.jobKey, jobs);
    if (!target) continue;
    const msg = r.message.trim();
    await api.jobs.createHubReminder({
      ...target,
      remindAt: r.remindAt,
      ...(msg ? { title: msg } : {}),
    });
  }
}

function removeLegacyStorageKeys() {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith(NOTES_LOCAL_PREFIX) ||
        k.startsWith(NOTES_ENTRIES_PREFIX) ||
        k === LOCAL_REMINDERS_KEY
      ) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
    window.localStorage.setItem(JOB_HUB_MIGRATION_FLAG, '1');
  } catch {
    /* ignore */
  }
}

export type JobHubMigrationResult =
  | { ok: true }
  | { ok: false; message: string };

/** One-time import of device-only notes/reminders. Keeps legacy data on failure. */
export async function runJobHubLegacyMigration(
  jobs: JobHubMigrationJob[],
  queryClient: QueryClient,
): Promise<JobHubMigrationResult> {
  if (typeof window === 'undefined') return { ok: true };
  if (isJobHubMigrationComplete()) return { ok: true };
  if (!hasLegacyJobHubStorage()) {
    try {
      window.localStorage.setItem(JOB_HUB_MIGRATION_FLAG, '1');
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  try {
    const jobKeys = collectLegacyJobKeys();
    for (const jobKey of jobKeys) {
      await migrateNotesForJobKey(jobKey, jobs);
    }
    await migrateReminders(jobs);
    removeLegacyStorageKeys();
    await queryClient.invalidateQueries({ queryKey: queryKeys.hub.notesRoot() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.hub.remindersRoot() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
    for (const j of jobs) {
      const scope = hubNoteScopeFromJob(j);
      if (scope) {
        await queryClient.invalidateQueries({ queryKey: hubNotesQueryKey(scope) });
      }
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not sync notes to your account';
    return { ok: false, message };
  }
}
