/**
 * Daily AI usage display + guards — data comes from the API (`GET /users/me`, UTC day).
 * The server enforces limits; this module maps `AuthUser` into UI state.
 */

import type { AuthUser } from '@/lib/api';

export type DailyAiUsage = {
  used: number;
  /** null = PAID / no daily cap */
  limit: number | null;
  /** null = unlimited */
  remaining: number | null;
  /** Timezone label for the cap (e.g. UTC) */
  dayKey: string;
  isLimited: boolean;
  isPaidTier: boolean;
  isLoading: boolean;
};

export const DAILY_AI_LIMIT_REACHED_MESSAGE =
  "You've reached today's limit of free AI actions (CV scan, chat, spellcheck, apply-with-AI, and similar). Counts reset at UTC midnight.";

/** Appended in CV flows when surfacing quota errors (links to `#pricing` elsewhere). */
export const AI_QUOTA_UPGRADE_HINT = 'Upgrade your plan for higher daily limits — open Plans from the dashboard.';

/** Map `/users/me` into badge / guard state. */
export function mapMeToDailyAiUsage(
  me: AuthUser | null | undefined,
  /** True while the initial `users/me` request has not returned. */
  isPending: boolean,
): DailyAiUsage {
  if (isPending && me == null) {
    return {
      used: 0,
      limit: null,
      remaining: null,
      dayKey: '',
      isLimited: true,
      isPaidTier: false,
      isLoading: true,
    };
  }

  /** PAID: API sends `aiDailyLimit` and `aiUsesRemaining` as `null`. */
  const paid = me != null && me.aiDailyLimit === null && me.aiUsesRemaining === null;

  if (paid) {
    return {
      used: me?.aiUsesToday ?? 0,
      limit: null,
      remaining: null,
      dayKey: me?.aiUsageTimezone ?? 'UTC',
      isLimited: false,
      isPaidTier: true,
      isLoading: false,
    };
  }

  const limit =
    typeof me?.aiDailyLimit === 'number' && Number.isFinite(me.aiDailyLimit)
      ? me.aiDailyLimit
      : 5;
  const used = typeof me?.aiUsesToday === 'number' && Number.isFinite(me.aiUsesToday) ? me.aiUsesToday : 0;
  const remaining =
    typeof me?.aiUsesRemaining === 'number' && Number.isFinite(me.aiUsesRemaining)
      ? me.aiUsesRemaining
      : Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    dayKey: me?.aiUsageTimezone ?? 'UTC',
    isLimited: true,
    isPaidTier: false,
    isLoading: false,
  };
}

export function canUseAiFromDailyAiUsage(u: DailyAiUsage): boolean {
  if (u.isLoading) return true;
  if (!u.isLimited || u.isPaidTier) return true;
  return (u.remaining ?? 0) > 0;
}
