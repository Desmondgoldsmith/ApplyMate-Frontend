/** Keys must match `JobsAnalyzeContent` (legacy + fresh bootstrap). */
const PREFILL_JD = 'applymate_prefill_jd';
const PREFILL_TITLE = 'applymate_prefill_title';
const PREFILL_COMPANY = 'applymate_prefill_company';

/** One-shot payload for `?new=1` (survives React Strict Mode double-mount). */
export const FRESH_ANALYZE_PREFILL_SESSION = 'applymate:fresh-analyze:prefill';
const NEXT_ACTION_PREFETCH_CACHE = 'applymate:next-action-prefetch-cache';

export type FreshAnalyzePrefillPayload = {
  title: string;
  company: string;
  description: string;
  /** When set, a successful analyze PATCHes this hub bookmark with the new JobAnalysis id. */
  hubBookmarkId?: string;
  selectedCvId?: string;
  sourceContext?: string;
  resumeWorkingStep?: string;
};

type NextActionPrefetchCacheEntry = {
  contextToken?: string | null;
  prefill?: {
    selectedCvId?: string | null;
    sourceContext?: string | null;
  } | null;
  resumeState?: {
    workingStep?: string | null;
  } | null;
};

export function prefillJobAnalyzerInStorage(
  title: string,
  company: string,
  description: string,
  opts?: {
    hubBookmarkId?: string;
    selectedCvId?: string;
    sourceContext?: string;
    resumeWorkingStep?: string;
  },
) {
  if (typeof window === 'undefined') return;
  try {
    if (!title.trim() && !company.trim() && !description.trim()) {
      window.sessionStorage.removeItem(FRESH_ANALYZE_PREFILL_SESSION);
      window.localStorage.removeItem(PREFILL_JD);
      window.localStorage.removeItem(PREFILL_TITLE);
      window.localStorage.removeItem(PREFILL_COMPANY);
      return;
    }
    const payload: FreshAnalyzePrefillPayload = {
      title,
      company,
      description,
      ...(opts?.hubBookmarkId?.trim() ? { hubBookmarkId: opts.hubBookmarkId.trim() } : {}),
      ...(opts?.selectedCvId?.trim() ? { selectedCvId: opts.selectedCvId.trim() } : {}),
      ...(opts?.sourceContext?.trim() ? { sourceContext: opts.sourceContext.trim() } : {}),
      ...(opts?.resumeWorkingStep?.trim() ? { resumeWorkingStep: opts.resumeWorkingStep.trim() } : {}),
    };
    window.sessionStorage.setItem(FRESH_ANALYZE_PREFILL_SESSION, JSON.stringify(payload));
    window.localStorage.setItem(PREFILL_JD, description);
    window.localStorage.setItem(PREFILL_TITLE, title);
    window.localStorage.setItem(PREFILL_COMPANY, company);
  } catch {
    /* ignore */
  }
}

export function cacheNextActionPrefetchBundle(raw: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (raw === null || typeof raw !== 'object') return;
    const body = raw as Record<string, unknown>;
    const source = Array.isArray(body.items)
      ? body.items
      : body.data && typeof body.data === 'object' && Array.isArray((body.data as Record<string, unknown>).items)
        ? ((body.data as Record<string, unknown>).items as unknown[])
        : [];
    if (source.length === 0) return;
    const cacheRaw = window.sessionStorage.getItem(NEXT_ACTION_PREFETCH_CACHE);
    const cache =
      cacheRaw && cacheRaw.trim()
        ? (JSON.parse(cacheRaw) as Record<string, NextActionPrefetchCacheEntry>)
        : {};
    for (const it of source) {
      if (it === null || typeof it !== 'object' || Array.isArray(it)) continue;
      const obj = it as Record<string, unknown>;
      const token = typeof obj.contextToken === 'string' ? obj.contextToken.trim() : '';
      if (!token) continue;
      cache[token] = {
        contextToken: token,
        prefill:
          obj.prefill && typeof obj.prefill === 'object' && !Array.isArray(obj.prefill)
            ? (obj.prefill as NextActionPrefetchCacheEntry['prefill'])
            : null,
        resumeState:
          obj.resumeState && typeof obj.resumeState === 'object' && !Array.isArray(obj.resumeState)
            ? (obj.resumeState as NextActionPrefetchCacheEntry['resumeState'])
            : null,
      };
    }
    window.sessionStorage.setItem(NEXT_ACTION_PREFETCH_CACHE, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

export function consumePrefetchByContextToken(contextToken: string | null | undefined): {
  selectedCvId?: string;
  sourceContext?: string;
  resumeWorkingStep?: string;
} | null {
  if (typeof window === 'undefined') return null;
  const token = String(contextToken ?? '').trim();
  if (!token) return null;
  try {
    const cacheRaw = window.sessionStorage.getItem(NEXT_ACTION_PREFETCH_CACHE);
    if (!cacheRaw) return null;
    const cache = JSON.parse(cacheRaw) as Record<string, NextActionPrefetchCacheEntry>;
    const hit = cache[token];
    if (!hit) return null;
    delete cache[token];
    window.sessionStorage.setItem(NEXT_ACTION_PREFETCH_CACHE, JSON.stringify(cache));
    const selectedCvId = String(hit.prefill?.selectedCvId ?? '').trim();
    const sourceContext = String(hit.prefill?.sourceContext ?? '').trim();
    const resumeWorkingStep = String(hit.resumeState?.workingStep ?? '').trim();
    return {
      ...(selectedCvId ? { selectedCvId } : {}),
      ...(sourceContext ? { sourceContext } : {}),
      ...(resumeWorkingStep ? { resumeWorkingStep } : {}),
    };
  } catch {
    return null;
  }
}
