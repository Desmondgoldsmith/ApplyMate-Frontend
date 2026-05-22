/**
 * Job Hub workspace data in localStorage (not auth tokens). Call on sign-out so
 * another account on the same browser does not inherit bookmarks / notes / reminders.
 * Server-backed reminders & application notes are unaffected.
 */
export function clearJobHubBrowserStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('applymate:job-hub:')) keys.push(k);
    }
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
