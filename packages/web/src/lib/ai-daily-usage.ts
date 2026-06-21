import type { QueryClient } from '@tanstack/react-query';

import type { AuthUser } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

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
  "You've reached today's limit of free AI actions (tailor, apply-with-AI, merge, and similar). Refreshing your CV score does not count. Resets at UTC midnight.";

/** Shown near CV suggestion bulk actions when the server sends quota copy. */
export const CV_SCORE_NO_AI_USE_NOTE =
  'Refreshing your CV score does not use a daily AI action.';

/** Tailor CTA helper — one charge for the whole operation. */
export const CV_TAILOR_ONE_AI_USE_NOTE =
  'Uses 1 daily AI action for the whole tailor (not per section).';

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
      : 10;
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

/** Invalidate `GET /users/me` after an action that consumes daily AI quota. */
export function invalidateDailyAiUsageQuery(
  queryClient: QueryClient,
  accessToken: string | null | undefined,
): void {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.auth.me(accessToken ?? ''),
  });
}

export type CvAiUsageMeta = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt?: string;
  timezone?: string;
};

/** Apply `meta.aiUsage` / `data.aiUsage` from a CV mutation without waiting for refetch. */
export function applyCvAiUsageToAuthCache(
  queryClient: QueryClient,
  accessToken: string | null | undefined,
  aiUsage: CvAiUsageMeta | null | undefined,
): void {
  if (!aiUsage || !Number.isFinite(aiUsage.used)) return;
  queryClient.setQueryData<import('@/lib/api').AuthUser>(
    queryKeys.auth.me(accessToken ?? ''),
    (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        aiUsesToday: aiUsage.used,
        aiDailyLimit: aiUsage.limit,
        aiUsesRemaining: aiUsage.remaining,
        aiUsageTimezone: aiUsage.timezone ?? prev.aiUsageTimezone,
      };
    },
  );
}

export function extractCvAiUsageFromResponse(raw: unknown): CvAiUsageMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const meta = o.meta;
  const data = o.data;
  const from =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).aiUsage ??
        (meta as Record<string, unknown>).ai_usage
      : null;
  const fromData =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>).aiUsage ??
        (data as Record<string, unknown>).ai_usage
      : null;
  const usage = (from ?? fromData) as Record<string, unknown> | null;
  if (!usage || typeof usage !== 'object') return null;
  const used = Number(usage.used);
  const limit = Number(usage.limit);
  const remaining = Number(usage.remaining);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || !Number.isFinite(remaining)) {
    return null;
  }
  const resetsAt =
    typeof usage.resetsAt === 'string'
      ? usage.resetsAt
      : typeof usage.resets_at === 'string'
        ? usage.resets_at
        : undefined;
  const timezone =
    typeof usage.timezone === 'string' ? usage.timezone : undefined;
  return { used, limit, remaining, resetsAt, timezone };
}
