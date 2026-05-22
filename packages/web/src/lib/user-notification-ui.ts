import type { NotificationPrefs } from '@/lib/api';

/** `nudgePausedUntil` is active when the instant is in the future. */
export function isMarketingPauseActive(iso: string | null | undefined): boolean {
  if (!iso || typeof iso !== 'string') return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Server / product default: on unless the user explicitly set `false` (opt-out). */
export function effectiveEmailHubReminderDue(prefs: NotificationPrefs | null | undefined): boolean {
  return prefs?.emailHubReminderDue !== false;
}

/** Same opt-out default for the weekly stall digest (marketing path). */
export function effectiveWeeklyStallDigest(prefs: NotificationPrefs | null | undefined): boolean {
  return prefs?.weeklyStallDigest !== false;
}

/** Daily growth digest follows opt-out semantics as well. */
export function effectiveDailyGrowthDigest(prefs: NotificationPrefs | null | undefined): boolean {
  return prefs?.dailyGrowthDigest !== false;
}

/** Reserved for push; same opt-out default when the key is absent. */
export function effectivePushHubReminderDue(prefs: NotificationPrefs | null | undefined): boolean {
  return prefs?.pushHubReminderDue !== false;
}

/** Clamp marketing cap for PATCH (server accepts 1–21). */
export function clampMarketingCap(n: number): number {
  return Math.max(1, Math.min(21, Math.round(n)));
}
