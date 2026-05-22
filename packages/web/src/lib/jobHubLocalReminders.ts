export type LocalHubReminder = {
  id: string;
  jobKey: string;
  remindAt: string;
  message: string;
  createdAt: string;
  /** Legacy: `server` mirrors were used before GET reminders; cleared when server list loads. */
  source?: 'device' | 'server';
};

const STORAGE_KEY = 'applymate:job-hub:local-reminders';

function readAll(): LocalHubReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is LocalHubReminder =>
        x &&
        typeof x === 'object' &&
        typeof (x as LocalHubReminder).id === 'string' &&
        typeof (x as LocalHubReminder).jobKey === 'string' &&
        typeof (x as LocalHubReminder).remindAt === 'string' &&
        typeof (x as LocalHubReminder).message === 'string' &&
        ((x as LocalHubReminder).source === undefined ||
          (x as LocalHubReminder).source === 'device' ||
          (x as LocalHubReminder).source === 'server'),
    );
  } catch {
    return [];
  }
}

function writeAll(rows: LocalHubReminder[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function listLocalRemindersForJob(jobKey: string): LocalHubReminder[] {
  return readAll()
    .filter((r) => r.jobKey === jobKey)
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
}

export type AddLocalReminderOpts = {
  id?: string;
  source?: 'device' | 'server';
};

export function addLocalReminder(
  jobKey: string,
  remindAt: string,
  message: string,
  opts?: string | AddLocalReminderOpts,
): LocalHubReminder {
  const options: AddLocalReminderOpts =
    typeof opts === 'string' ? { id: opts } : (opts ?? {});
  const row: LocalHubReminder = {
    id: options.id?.trim() || `lr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    jobKey,
    remindAt,
    message: message.trim(),
    createdAt: new Date().toISOString(),
    source: options.source ?? 'device',
  };
  const next = [...readAll(), row];
  writeAll(next);
  return row;
}

export function removeLocalReminder(id: string) {
  writeAll(readAll().filter((r) => r.id !== id));
}

/** Drop legacy hub mirrors (`source: 'server'`) once server list is authoritative. */
export function removeServerMirrorsForJob(jobKey: string) {
  writeAll(readAll().filter((r) => !(r.jobKey === jobKey && r.source === 'server')));
}

const SESSION_FIRED_PREFIX = 'applymate:reminder-fired:';

/** One browser notification per reminder id per tab session when remindAt has passed (requires Notification permission). */
export function notifyDueLocalReminders(): void {
  if (typeof window === 'undefined') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const now = Date.now();
  for (const r of readAll()) {
    const t = new Date(r.remindAt).getTime();
    if (!Number.isFinite(t) || t > now) continue;
    if (now - t > 7 * 86_400_000) continue;
    const flag = `${SESSION_FIRED_PREFIX}${r.id}`;
    try {
      if (sessionStorage.getItem(flag)) continue;
      new Notification('ApplyMate reminder', {
        body: r.message?.trim() || 'Scheduled reminder',
      });
      sessionStorage.setItem(flag, '1');
    } catch {
      /* ignore */
    }
  }
}

export function localReminderStatus(remindAt: string): 'upcoming' | 'due' | 'elapsed' {
  const t = new Date(remindAt).getTime();
  if (!Number.isFinite(t)) return 'upcoming';
  const now = Date.now();
  if (t > now + 60_000) return 'upcoming';
  if (t > now - 60_000) return 'due';
  return 'elapsed';
}
