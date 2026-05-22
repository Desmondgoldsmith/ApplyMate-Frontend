/**
 * Deterministic “assistant remembers you” lines — no LLM, no network.
 */

const LS_LAST_OPEN = 'applymate:dashboard:last-opened-at';

export function readLastDashboardOpenMs(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const n = Number(window.localStorage.getItem(LS_LAST_OPEN) ?? 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeDashboardOpenedNow(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_LAST_OPEN, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Short welcome line when returning after a gap (first session has no extra line — time-of-day greeting covers it).
 */
export function dashboardWelcomeLine(params: { firstName: string; lastOpenedAtMs: number | null }): string | null {
  const name = params.firstName.trim() || 'there';
  if (params.lastOpenedAtMs == null || params.lastOpenedAtMs <= 0) {
    return null;
  }
  const hours = (Date.now() - params.lastOpenedAtMs) / (1000 * 60 * 60);
  if (hours < 3) return null;
  if (hours < 48) return `Welcome back, ${name}.`;
  return `Good to see you again, ${name}.`;
}

/** Eyebrow for continuation — calm variants, deterministic from stable string. */
export function continuationEyebrowLabel(seed: string): string {
  const variants = ['Where you left off', 'Pick up where you stopped', 'Continue from earlier'];
  let h = 0;
  const s = seed.trim() || 'default';
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return variants[Math.abs(h) % variants.length]!;
}
