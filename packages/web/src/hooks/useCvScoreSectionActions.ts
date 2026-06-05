'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useToast } from '@/components/ui/Toast';
import { useCvSuggestionMutations } from '@/hooks/useCvSuggestionMutations';
import { api, type CvDiffPreviewOpenParams, type CvImprovementsPayload } from '@/lib/api';
import { isCvApplyImprovementTerminalNoDiff, toastCopyForTerminalNoDiffApply } from '@/lib/cvApplyImprovementQueue';
import { cvOpenParamsFromApplyResult } from '@/lib/cvDiffPreviewMap';
import { getApiErrorMessage, isDailyAiLimitApiError } from '@/lib/axios';
import { logCvMutationErrorDev } from '@/lib/cvMutationDevLog';
import { logCvSuggestionMutationClientPerf } from '@/lib/cvSuggestionMutationReconcile';
import {
  applySuggestionAcceptToImprovementsCache,
  applySuggestionSelfFixToImprovementsCache,
} from '@/lib/cvSuggestionsMutationApply';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { shouldShowTruthfulnessAdjustNotice } from '@/lib/cvTruthfulnessUi';
export function useCvScoreSectionActions(
  profileId: string | null | undefined,
  onDiffPreview?: (params: CvDiffPreviewOpenParams | null) => void,
  onScoreUpdated?: () => void,
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { reconcileAfterMutation } = useCvSuggestionMutations();

  const fixWithAi = useCallback(
    async (suggestionId: string) => {
      const id = suggestionId.trim();
      if (!id) {
        toast.error('Missing suggestion id.');
        return;
      }
      const qk = cvSuggestionsQueryKey(profileId);
      const t0 = performance.now();
      try {
        const result = await api.cv.applyImprovement(id, profileId ?? undefined);
        if (isCvApplyImprovementTerminalNoDiff(result)) {
          const rid = String(result.suggestionId || result.improvementId || id).trim();
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
          toast.success(toastCopyForTerminalNoDiffApply(result));
          reconcileAfterMutation(profileId, 'queueOnly');
          onScoreUpdated?.();
          return;
        }
        onDiffPreview?.(cvOpenParamsFromApplyResult(result, id));
        if (shouldShowTruthfulnessAdjustNotice(result)) {
          toast.info('Some suggested edits were adjusted to match your CV. See the preview note for details.');
        }
      } catch (e) {
        logCvMutationErrorDev('scoreSection.fixWithAi', e);
        const msg = getApiErrorMessage(e) || 'AI could not start this fix. Try again.';
        if (!isDailyAiLimitApiError(e)) toast.error(msg);
        else toast.error(msg);
      } finally {
        logCvSuggestionMutationClientPerf('scoreSection.fixWithAi', t0);
      }
    },
    [profileId, queryClient, toast, reconcileAfterMutation, onDiffPreview, onScoreUpdated],
  );

  const fixMyself = useCallback(
    async (suggestionId: string) => {
      const id = suggestionId.trim();
      if (!id) {
        toast.error('Missing suggestion id.');
        return;
      }
      const qk = cvSuggestionsQueryKey(profileId);
      const prev = queryClient.getQueryData<CvImprovementsPayload>(qk);
      const t0 = Date.now();
      try {
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
        toast.success("Marked as in progress — we'll credit this section when you save.");
        const inv = reconcileAfterMutation(profileId, 'queueOnly');
        logCvSuggestionMutationClientPerf('scoreSection.fixMyself', t0, { invalidations: inv, cacheWrites: 2 });
        onScoreUpdated?.();
      } catch (e) {
        logCvMutationErrorDev('scoreSection.selfFix', e);
        if (prev !== undefined) queryClient.setQueryData(qk, prev);
        toast.error(getApiErrorMessage(e) || 'Could not update this suggestion. Try again.');
      }
    },
    [profileId, queryClient, toast, reconcileAfterMutation, onScoreUpdated],
  );

  return { fixWithAi, fixMyself };
}
