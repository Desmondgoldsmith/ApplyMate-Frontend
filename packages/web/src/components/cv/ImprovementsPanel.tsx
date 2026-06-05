'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCvSuggestionMutations } from '@/hooks/useCvSuggestionMutations';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { GlowCard } from '@/components/ui/GlowCard';
import { useToast } from '@/components/ui/Toast';
import {
  api,
  type CVImprovementItem,
  type CvDiffPreviewOpenParams,
  type CvImprovementsPayload,
} from '@/lib/api';
import {
  AI_QUOTA_UPGRADE_HINT,
  invalidateDailyAiUsageQuery,
} from '@/lib/ai-daily-usage';
import { buildAcceptAllSuccessToastMessage } from '@/lib/cvAcceptAllSummaryToast';
import {
  extractAcceptAllQuotaFromApiBody,
  isAcceptAllBlockedByDailyQuota,
  type CvAcceptAllQuota,
} from '@/lib/cvAcceptAllQuota';
import {
  formatApiErrorForToast,
  getApiErrorMessage,
  isAcceptAllDailyQuotaExhaustedError,
  isDailyAiLimitApiError,
} from '@/lib/axios';
import { logCvDevPerf } from '@/lib/cvDevPerf';
import { logCvMaterializePerformanceDev } from '@/lib/cvApplyPerformanceDev';
import { logCvMutationErrorDev } from '@/lib/cvMutationDevLog';
import { logCvSuggestionMutationClientPerf } from '@/lib/cvSuggestionMutationReconcile';
import {
  applyBulkAcceptToImprovementsCache,
  applyBulkRejectToImprovementsCache,
  applySuggestionAcceptToImprovementsCache,
  applySuggestionRejectToImprovementsCache,
  applySuggestionSelfFixToImprovementsCache,
} from '@/lib/cvSuggestionsMutationApply';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { isCvApplyImprovementTerminalNoDiff, toastCopyForTerminalNoDiffApply } from '@/lib/cvApplyImprovementQueue';
import { cvOpenParamsFromApplyResult } from '@/lib/cvDiffPreviewMap';
import { normalizeText } from '@/lib/normalizeText';
import { shouldShowTruthfulnessAdjustNotice } from '@/lib/cvTruthfulnessUi';
import { isAiOriginSuggestionId } from '@/lib/cvHybridScoring';
import {
  CV_SUGGESTION_ACCEPT_ALL_MESSAGES,
  CV_SUGGESTION_APPLYING_MESSAGE,
} from '@/lib/cvAssistantLoadingCopy';
import { refreshCvState } from '@/lib/refreshCvState';
import { useAuthStore } from '@/store/useAuthStore';

export const APPLY_WITH_AI_LOADING_MESSAGES = [
  CV_SUGGESTION_APPLYING_MESSAGE,
  'Generating fact-based improvements…',
  'Preparing preview…',
] as const;

type ImprovementsPanelProps = {
  improvements: CVImprovementItem[];
  profileId?: string | null;
  acceptAllQuota?: CvAcceptAllQuota | null;
  /** @deprecated Accept/reject now handled at page level via onDiffPreview flow */
  onApplied?: () => void;
  onDiffPreview?: (params: CvDiffPreviewOpenParams | null) => void;
};

function PriorityBadge({ priority, severity }: { priority?: number; severity?: string }) {
  const p = priority ?? (severity === 'HIGH' ? 1 : severity === 'MEDIUM' ? 2 : 3);
  if (p === 1)
    return (
      <span className="inline-flex items-center rounded-full border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#F87171]">
        High priority
      </span>
    );
  if (p === 2)
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
        Medium
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
      Low
    </span>
  );
}

function ImprovementsPanelInner({
  improvements,
  profileId,
  acceptAllQuota = null,
  onDiffPreview,
}: ImprovementsPanelProps) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { reconcileAfterMutation } = useCvSuggestionMutations();
  const toast = useToast();
  const applyInflightBySuggestionIdRef = useRef<Set<string>>(new Set());
  /** Stable key for a suggestion — always the server id; index is a last-resort fallback only. */
  const stableKey = (item: CVImprovementItem | undefined, i: number): string => {
    const id = item?.id?.trim();
    return id && id.length > 0 ? id : `__idx_${i}`;
  };
  const pointerFor = (idx: number): string => {
    const id = improvements[idx]?.id?.trim();
    return id && id.length > 0 ? id : String(idx);
  };
  /** Resolved/applying/error state is keyed by stable suggestion id, never by list index. */
  const [resolvedSet, setResolvedSet] = useState<Set<string>>(new Set());
  const [applyingSet, setApplyingSet] = useState<Set<string>>(new Set());
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [navIndex, setNavIndex] = useState(0);
  const [bulkBusy, setBulkBusy] = useState<'accept' | 'reject' | null>(null);
  const [acceptAllQuotaOverride, setAcceptAllQuotaOverride] =
    useState<CvAcceptAllQuota | null>(null);

  useEffect(() => {
    const pre = new Set<string>();
    improvements.forEach((item, i) => {
      const st = item.status ?? 'pending';
      if (st !== 'pending' || item.resolved === true) pre.add(stableKey(item, i));
    });
    setResolvedSet(pre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [improvements]);

  useEffect(() => {
    setNavIndex(0);
  }, [improvements.length]);

  const unresolvedItems = useMemo(() => {
    const pending = improvements
      .map((item, i) => ({ item, i, key: stableKey(item, i) }))
      .filter(({ item, key }) => {
        const st = item.status ?? 'pending';
        return !resolvedSet.has(key) && st === 'pending' && item.resolved !== true;
      });
    pending.sort((a, b) => {
      const aAi = isAiOriginSuggestionId(a.item.id) ? 0 : 1;
      const bAi = isAiOriginSuggestionId(b.item.id) ? 0 : 1;
      if (aAi !== bAi) return aAi - bAi;
      const ap = a.item.priority ?? 2;
      const bp = b.item.priority ?? 2;
      return ap - bp;
    });
    return pending;
  }, [improvements, resolvedSet]);

  const effectiveAcceptAllQuota = acceptAllQuotaOverride ?? acceptAllQuota;
  const acceptAllBlocked = isAcceptAllBlockedByDailyQuota(effectiveAcceptAllQuota);
  const acceptAllHelper = effectiveAcceptAllQuota?.message?.trim() ?? '';
  const showBulkActions = unresolvedItems.length > 1;

  const clampedNav = Math.min(navIndex, Math.max(0, unresolvedItems.length - 1));
  const currentEntry = unresolvedItems[clampedNav];
  const applyLoadingActive = Boolean(currentEntry && applyingSet.has(currentEntry.key));
  const acceptAllLoadingActive = bulkBusy === 'accept';
  const [applyLoadingPhraseIndex, setApplyLoadingPhraseIndex] = useState(0);
  const [acceptAllLoadingPhraseIndex, setAcceptAllLoadingPhraseIndex] = useState(0);

  useEffect(() => {
    if (!applyLoadingActive) return undefined;
    setApplyLoadingPhraseIndex(0);
    const id = window.setInterval(() => {
      setApplyLoadingPhraseIndex((i) => (i + 1) % APPLY_WITH_AI_LOADING_MESSAGES.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [applyLoadingActive]);

  useEffect(() => {
    if (!acceptAllLoadingActive) return undefined;
    setAcceptAllLoadingPhraseIndex(0);
    const id = window.setInterval(() => {
      setAcceptAllLoadingPhraseIndex(
        (i) => (i + 1) % CV_SUGGESTION_ACCEPT_ALL_MESSAGES.length,
      );
    }, 2600);
    return () => window.clearInterval(id);
  }, [acceptAllLoadingActive]);

  const handleAcceptAll = async () => {
    if (acceptAllBlocked || bulkBusy) return;
    const qk = cvSuggestionsQueryKey(profileId);
    const prev = queryClient.getQueryData<CvImprovementsPayload>(qk);
    setBulkBusy('accept');
    const t0 = Date.now();
    try {
      const res = await api.cv.acceptAllSuggestions(profileId ?? undefined);
      queryClient.setQueryData<CvImprovementsPayload>(qk, (p) =>
        applyBulkAcceptToImprovementsCache(p, res) ?? p,
      );
      toast.success(buildAcceptAllSuccessToastMessage(res));
      invalidateDailyAiUsageQuery(queryClient, accessToken);
      const inv = reconcileAfterMutation(profileId, 'structuralAccept');
      await refreshCvState(queryClient, profileId, {
        refreshProfile: true,
        refreshSections: true,
        refreshSuggestions: true,
        invalidateScore: true,
      });
      logCvSuggestionMutationClientPerf('improvementsPanel.acceptAll', t0, {
        invalidations: inv,
        cacheWrites: 1,
      });
    } catch (e) {
      logCvMutationErrorDev('acceptAllSuggestions', e);
      if (prev !== undefined) queryClient.setQueryData(qk, prev);
      if (isAcceptAllDailyQuotaExhaustedError(e)) {
        const quota = extractAcceptAllQuotaFromApiBody(
          (e as { response?: { data?: unknown } }).response?.data,
        );
        if (quota) setAcceptAllQuotaOverride(quota);
        toast.error(
          quota?.message?.trim() ||
            formatApiErrorForToast(
              e,
              `Daily AI limit reached. ${AI_QUOTA_UPGRADE_HINT}`,
            ),
        );
      } else {
        toast.error(
          formatApiErrorForToast(e, 'Could not apply all suggestions.'),
        );
      }
    } finally {
      setBulkBusy(null);
    }
  };

  const handleRejectAll = async () => {
    if (bulkBusy) return;
    const qk = cvSuggestionsQueryKey(profileId);
    const prev = queryClient.getQueryData<CvImprovementsPayload>(qk);
    setBulkBusy('reject');
    const t0 = Date.now();
    try {
      const res = await api.cv.rejectAllSuggestions(profileId ?? undefined);
      queryClient.setQueryData<CvImprovementsPayload>(qk, (p) =>
        applyBulkRejectToImprovementsCache(p, res) ?? p,
      );
      toast.success('All suggestions dismissed.');
      const inv = reconcileAfterMutation(profileId, 'queueOnly');
      logCvSuggestionMutationClientPerf('improvementsPanel.rejectAll', t0, {
        invalidations: inv,
        cacheWrites: 1,
      });
    } catch (e) {
      logCvMutationErrorDev('rejectAllSuggestions', e);
      if (prev !== undefined) queryClient.setQueryData(qk, prev);
      toast.error(getApiErrorMessage(e) || 'Could not dismiss all suggestions.');
    } finally {
      setBulkBusy(null);
    }
  };

  const handleSelfFix = async (idx: number) => {
    const id = improvements[idx]?.id?.trim();
    const key = stableKey(improvements[idx], idx);
    if (!id) {
      setErrorMap((p) => ({ ...p, [key]: 'Missing suggestion id.' }));
      return;
    }
    const qk = cvSuggestionsQueryKey(profileId);
    const prev = queryClient.getQueryData<CvImprovementsPayload>(qk);
    const t0 = Date.now();
    try {
      // Mark resolved by stable id first so re-indexing the list cannot hide a neighbour row.
      setResolvedSet((prevSet) => new Set(prevSet).add(key));
      queryClient.setQueryData<CvImprovementsPayload>(qk, (p) => {
        if (!p?.improvements) return p;
        const nextList = p.improvements.filter((it) => (it?.id ?? '').trim() !== id);
        return {
          ...p,
          improvements: nextList,
          pendingSuggestionsCount: Math.max(0, nextList.length),
        };
      });
      const res = await api.cv.selfFixSuggestion(id, profileId ?? undefined);
      queryClient.setQueryData<CvImprovementsPayload>(qk, (p) =>
        applySuggestionSelfFixToImprovementsCache(p, id, res) ?? p,
      );
      toast.success("We'll credit this when you save your edits.");
      const inv = reconcileAfterMutation(profileId, 'queueOnly');
      logCvSuggestionMutationClientPerf('improvementsPanel.selfFix', t0, { invalidations: inv, cacheWrites: 2 });
    } catch (e) {
      logCvMutationErrorDev('selfFixSuggestion', e);
      if (prev !== undefined) queryClient.setQueryData(qk, prev);
      setResolvedSet((prevSet) => {
        const n = new Set(prevSet);
        n.delete(key);
        return n;
      });
      const msg = getApiErrorMessage(e) || 'Could not update this suggestion. Try again.';
      setErrorMap((p) => ({ ...p, [key]: msg }));
    }
  };

  const handleMarkDone = async (idx: number) => {
    const id = improvements[idx]?.id?.trim();
    const key = stableKey(improvements[idx], idx);
    if (!id) {
      setErrorMap((p) => ({ ...p, [key]: 'Missing suggestion id.' }));
      return;
    }
    const qk = cvSuggestionsQueryKey(profileId);
    const prev = queryClient.getQueryData<CvImprovementsPayload>(qk);
    const t0 = Date.now();
    let cacheWrites = 0;
    try {
      setResolvedSet((prevSet) => new Set(prevSet).add(key));
      queryClient.setQueryData<CvImprovementsPayload>(qk, (p) => {
        if (!p?.improvements) return p;
        const nextList = p.improvements.filter((it) => (it?.id ?? '').trim() !== id);
        return {
          ...p,
          improvements: nextList,
          pendingSuggestionsCount: Math.max(0, nextList.length),
        };
      });
      cacheWrites += 1;
      const res = await api.cv.rejectSuggestion(id, profileId ?? undefined);
      queryClient.setQueryData<CvImprovementsPayload>(qk, (p) =>
        applySuggestionRejectToImprovementsCache(p, id, res) ?? p,
      );
      cacheWrites += 1;
      if (res.idempotent) {
        toast.success('Already dismissed.');
      } else if (res.alreadyApplied) {
        toast.success('This suggestion was already applied.');
      } else {
        toast.success('Suggestion dismissed.');
      }
      const inv = reconcileAfterMutation(profileId, 'queueOnly');
      logCvSuggestionMutationClientPerf('improvementsPanel.markDone', t0, { invalidations: inv, cacheWrites });
    } catch (e) {
      logCvMutationErrorDev('rejectSuggestion', e);
      if (prev !== undefined) queryClient.setQueryData(qk, prev);
      setResolvedSet((prevSet) => {
        const n = new Set(prevSet);
        n.delete(key);
        return n;
      });
      const msg = getApiErrorMessage(e) || 'Could not dismiss this suggestion. Try again.';
      if (isDailyAiLimitApiError(e)) {
        toast.error(msg);
      } else {
        setErrorMap((p) => ({
          ...p,
          [key]: msg,
        }));
      }
    }
  };

  const handleApplyWithAI = async (idx: number) => {
    const stableId = improvements[idx]?.id?.trim();
    const key = stableKey(improvements[idx], idx);
    if (!stableId) {
      setErrorMap((p) => ({ ...p, [key]: 'Missing suggestion id.' }));
      return;
    }
    if (applyInflightBySuggestionIdRef.current.has(stableId)) return;
    applyInflightBySuggestionIdRef.current.add(stableId);
    setApplyingSet((prev) => new Set(prev).add(key));
    setErrorMap((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
    const applyWithAiPerfT0 = performance.now();
    try {
      const pointer = pointerFor(idx);
      const result = await api.cv.applyImprovement(pointer, profileId ?? undefined);
      const qk = cvSuggestionsQueryKey(profileId);
      if (isCvApplyImprovementTerminalNoDiff(result)) {
        const rid = String(result.suggestionId || result.improvementId || result.pointer || pointer).trim();
        const t0 = Date.now();
        queryClient.setQueryData<CvImprovementsPayload>(qk, (p) =>
          applySuggestionAcceptToImprovementsCache(p, rid, {
            pendingSuggestionsCount:
              result.pendingSuggestionsCount ??
              Math.max(0, (p?.improvements ?? []).filter((it) => (it?.id ?? '').trim() !== rid).length),
            cvRevisionId: result.cvRevisionId ?? null,
            alreadyApplied: true,
            acceptedSuggestionIds: [rid],
          }) ?? p,
        );
        setResolvedSet((prev) => new Set(prev).add(key));
        toast.success(toastCopyForTerminalNoDiffApply(result));
        const inv = reconcileAfterMutation(profileId, 'queueOnly');
        await refreshCvState(queryClient, profileId, {
          refreshProfile: true,
          refreshSections: true,
          refreshSuggestions: true,
          invalidateScore: true,
        });
        logCvSuggestionMutationClientPerf('improvementsPanel.applyImprovement.terminalNoDiff', t0, {
          invalidations: inv,
          cacheWrites: 1,
        });
        return;
      }
      logCvMaterializePerformanceDev('improvementsPanel.applyImprovement', result);
      if (result.cacheHit === true) {
        toast.info('Using a previously generated preview.');
      } else if (result.duplicateSuppressed) {
        toast.info('Showing your saved preview — no new AI run was needed.');
      }
      onDiffPreview?.(cvOpenParamsFromApplyResult(result, stableId));
      if (shouldShowTruthfulnessAdjustNotice(result)) {
        toast.info('Some suggested edits were adjusted to match your CV. See the preview note for details.');
      }
      if (result.cacheHit !== true && !result.duplicateSuppressed) {
        invalidateDailyAiUsageQuery(queryClient, accessToken);
      }
    } catch (e) {
      logCvMutationErrorDev('applyImprovement', e);
      const msg = formatApiErrorForToast(
        e,
        'AI could not apply this change. Try again.',
      );
      toast.error(msg);
      if (!isDailyAiLimitApiError(e)) {
        setErrorMap((p) => ({
          ...p,
          [key]: msg,
        }));
      }
    } finally {
      logCvDevPerf('cv.applyWithAi', applyWithAiPerfT0, { suggestionId: stableId });
      applyInflightBySuggestionIdRef.current.delete(stableId);
      setApplyingSet((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }
  };

  if (improvements.length === 0 || unresolvedItems.length === 0) {
    return (
      <GlowCard
        className="border border-[rgba(0,201,177,0.12)]"
        contentClassName="flex flex-col items-center justify-center py-10 text-center"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/35"
        >
          <CheckCircle2 className="h-6 w-6 text-emerald-400" strokeWidth={2.25} />
        </motion.div>
        <p className="text-sm font-semibold text-white/90">All AI suggestions have been resolved.</p>
        <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-white/45">
          Run another scan anytime to discover new opportunities after you edit your CV.
        </p>
      </GlowCard>
    );
  }

  return (
    <GlowCard
      className="border border-white/[0.08]"
      contentClassName="p-0"
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-3 px-3 pb-2.5 pt-2 sm:px-4">
        <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45 sm:text-[11px]">
          Suggested improvements
        </span>
        {unresolvedItems.length > 0 ? (
          <span
            className="pointer-events-none inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
            aria-label={`${unresolvedItems.length} pending suggestions`}
          >
            {unresolvedItems.length > 99 ? '99+' : unresolvedItems.length}
          </span>
        ) : null}
      </div>

      {showBulkActions ? (
        <div className="space-y-2 border-b border-white/[0.06] px-3 pb-3 sm:px-4">
          {acceptAllHelper ? (
            <p className="text-[10px] leading-snug text-white/45">{acceptAllHelper}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="cv-improvement-accept-all"
              disabled={Boolean(bulkBusy) || acceptAllBlocked || applyingSet.size > 0}
              onClick={() => void handleAcceptAll()}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#00C9B1] px-3 text-[11px] font-semibold text-[#080B0A] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[8rem] sm:flex-none"
            >
              {bulkBusy === 'accept' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Apply all
            </button>
            <button
              type="button"
              data-testid="cv-improvement-reject-all"
              disabled={Boolean(bulkBusy) || applyingSet.size > 0}
              onClick={() => void handleRejectAll()}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-transparent px-3 text-[11px] font-medium text-white/55 transition hover:border-white/25 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[8rem] sm:flex-none"
            >
              {bulkBusy === 'reject' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Dismiss all
            </button>
          </div>
          {acceptAllLoadingActive ? (
            <p className="flex items-center gap-2 text-[10px] text-white/50">
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              {CV_SUGGESTION_ACCEPT_ALL_MESSAGES[acceptAllLoadingPhraseIndex]}
            </p>
          ) : null}
          {acceptAllBlocked ? (
            <p className="text-[10px] leading-snug text-amber-200/85">
              {AI_QUOTA_UPGRADE_HINT}
            </p>
          ) : null}
        </div>
      ) : null}

      {unresolvedItems.length > 1 && (
        <div className="flex items-center justify-center gap-3 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setNavIndex((v) => Math.max(0, v - 1))}
            disabled={clampedNav === 0}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.10] bg-transparent text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-white/35">
            {clampedNav + 1} of {unresolvedItems.length}
          </span>
          <button
            type="button"
            onClick={() => setNavIndex((v) => Math.min(unresolvedItems.length - 1, v + 1))}
            disabled={clampedNav === unresolvedItems.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.10] bg-transparent text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="px-3 pb-3 pt-1">
        {currentEntry &&
          (() => {
            const { item, i: idx, key: entryKey } = currentEntry;
            const applying = applyingSet.has(entryKey);
            const error = errorMap[entryKey];

            return (
              <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] p-3.5">
                {item.section && (
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-white/30">
                    {item.section}
                  </span>
                )}

                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={item.priority} severity={item.severity} />
                  {isAiOriginSuggestionId(item.id) ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7ef4e6]">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Quality review
                    </span>
                  ) : null}
                </div>

                {Array.isArray(item.pendingFieldPaths) && item.pendingFieldPaths.length > 0 && (
                  <p className="mb-2 text-[11px] font-medium text-[#00C9B1]/85">
                    {item.pendingFieldPaths.length} change{item.pendingFieldPaths.length === 1 ? '' : 's'} remaining
                  </p>
                )}

                <p className="text-sm font-semibold leading-snug text-white/92">
                  {normalizeText(item.issue ?? item.message)}
                </p>

                {item.suggestion && (
                  <p className="mt-2 text-xs leading-relaxed text-white/50">{normalizeText(item.suggestion)}</p>
                )}

                {item.example && (
                  <div className="mt-2.5 rounded-md border border-white/[0.06] bg-white/[0.03] p-2.5">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[rgba(0,201,177,0.60)]">
                      Example
                    </p>
                    <p className="whitespace-pre-line text-[11px] leading-relaxed text-white/45">{item.example}</p>
                  </div>
                )}

                {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    data-testid="cv-improvement-apply-ai"
                    onClick={() => void handleApplyWithAI(idx)}
                    disabled={applying}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border-0 bg-[#00C9B1] text-xs font-semibold text-[#080B0A] transition hover:brightness-110 disabled:opacity-50 sm:min-w-[7rem] sm:flex-1"
                  >
                    {applying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-[14px] w-[14px]" />
                    )}
                    {applying ? APPLY_WITH_AI_LOADING_MESSAGES[applyLoadingPhraseIndex] : 'Fix with AI'}
                  </button>
                  <button
                    type="button"
                    data-testid="cv-improvement-self-fix"
                    onClick={() => void handleSelfFix(idx)}
                    disabled={applying}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-transparent text-xs font-medium text-white/55 transition hover:border-white/25 hover:text-white/85 disabled:opacity-50 sm:min-w-[7rem] sm:flex-1"
                  >
                    I&apos;ll fix it myself
                  </button>
                  <button
                    type="button"
                    data-testid="cv-improvement-mark-done"
                    onClick={() => void handleMarkDone(idx)}
                    disabled={applying}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-white/40 transition hover:text-white/65 disabled:opacity-50 sm:min-w-[7rem] sm:flex-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })()}
      </div>
    </GlowCard>
  );
}

export const ImprovementsPanel = memo(ImprovementsPanelInner);
