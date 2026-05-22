/**
 * Top-level fields on the global API success envelope (Phase 7 backend).
 * `unwrapApiDataEnvelope` continues to return `data` only — use this when you need meta / requestId.
 */
export type CvApiResponseMeta = {
  cvRevisionId?: string;
  pendingSuggestionsCount?: number;
  durationMs?: number;
};

export type CvApiSuccessContext = {
  requestId?: string;
  meta?: CvApiResponseMeta;
};

/** Read `requestId` / `meta` from a raw API JSON body before unwrapping `data`. */
export function readCvApiSuccessContext(raw: unknown): CvApiSuccessContext {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const requestId = typeof o.requestId === 'string' && o.requestId.trim() ? o.requestId.trim() : undefined;
  const m = o.meta;
  if (m === null || typeof m !== 'object' || Array.isArray(m)) {
    return requestId ? { requestId } : {};
  }
  const metaObj = m as Record<string, unknown>;
  const meta: CvApiResponseMeta = {};
  if (typeof metaObj.cvRevisionId === 'string') meta.cvRevisionId = metaObj.cvRevisionId;
  if (typeof metaObj.pendingSuggestionsCount === 'number' && Number.isFinite(metaObj.pendingSuggestionsCount)) {
    meta.pendingSuggestionsCount = metaObj.pendingSuggestionsCount;
  }
  if (typeof metaObj.durationMs === 'number' && Number.isFinite(metaObj.durationMs)) {
    meta.durationMs = metaObj.durationMs;
  }
  return {
    requestId,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
}
