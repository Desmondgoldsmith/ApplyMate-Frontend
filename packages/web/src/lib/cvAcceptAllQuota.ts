/** GET /cv/suggestions — `acceptAllQuota` telemetry for bulk apply UX. */
export type CvAcceptAllQuota = {
  tier: string;
  aiUsesRemaining: number;
  pendingCount: number;
  pendingNeedingAi: number;
  pendingReusePreview: number;
  canAcceptWithAiToday: number;
  acceptAllCountsAsOneAiUse: boolean;
  message: string;
};

function pickInt(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  return fallback;
}

function pickBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function parseAcceptAllQuota(raw: unknown): CvAcceptAllQuota | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const message = pickString(o.message);
  const pendingCount = pickInt(o.pendingCount ?? o.pending_count);
  const pendingNeedingAi = pickInt(o.pendingNeedingAi ?? o.pending_needing_ai);
  if (!message && pendingCount === 0 && pendingNeedingAi === 0) return null;
  return {
    tier: pickString(o.tier) || 'FREE',
    aiUsesRemaining: pickInt(o.aiUsesRemaining ?? o.ai_uses_remaining),
    pendingCount,
    pendingNeedingAi,
    pendingReusePreview: pickInt(o.pendingReusePreview ?? o.pending_reuse_preview),
    canAcceptWithAiToday: pickInt(o.canAcceptWithAiToday ?? o.can_accept_with_ai_today),
    acceptAllCountsAsOneAiUse: pickBool(
      o.acceptAllCountsAsOneAiUse ?? o.accept_all_counts_as_one_ai_use,
      true,
    ),
    message,
  };
}

/** Block apply-all when AI is required but daily cap is exhausted. */
export function isAcceptAllBlockedByDailyQuota(
  quota: CvAcceptAllQuota | null | undefined,
): boolean {
  if (!quota) return false;
  return quota.pendingNeedingAi > 0 && quota.aiUsesRemaining === 0;
}

export function extractAcceptAllQuotaFromApiBody(data: unknown): CvAcceptAllQuota | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const root = data as Record<string, unknown>;
  const err =
    root.error && typeof root.error === 'object' && !Array.isArray(root.error)
      ? (root.error as Record<string, unknown>)
      : null;
  const candidates = [
    root.acceptAllQuota,
    root.accept_all_quota,
    err?.acceptAllQuota,
    err?.accept_all_quota,
  ];
  for (const c of candidates) {
    const parsed = parseAcceptAllQuota(c);
    if (parsed) return parsed;
  }
  return null;
}
