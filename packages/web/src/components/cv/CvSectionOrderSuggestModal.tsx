'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api, type CVSectionRecord } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import {
  changeBySectionId,
  labelForSectionId,
  mergeSectionOrderSuggestWithClientFallback,
  sectionsOrderIsSuboptimal,
  splitSuggestedOrder,
  writeSectionOrderBannerDismissed,
  type CvSectionOrderSuggestResult,
} from '@/lib/cvSectionOrderSuggest';
import { refreshCvState } from '@/lib/refreshCvState';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

type CvSectionOrderSuggestModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  existingSections: CVSectionRecord[];
  /** Reuse proactive fetch when opening from the banner. */
  initialSuggest?: CvSectionOrderSuggestResult | null;
  onApplied?: () => void;
  /** Override modal stacking (e.g. when hosted inside a very-high-z overlay). */
  layerZIndex?: number;
};

function OrderColumn({
  title,
  sectionIds,
  sections,
  changes,
}: {
  title: string;
  sectionIds: string[];
  sections: CVSectionRecord[];
  changes: CvSectionOrderSuggestResult['changes'];
}) {
  const rows = sectionIds;

  return (
    <div className="min-w-0 flex-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{title}</h3>
      <ol className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <li className="text-xs text-white/35">No sections</li>
        ) : (
          rows.map((id, idx) => {
            const change = changeBySectionId(changes, id);
            return (
              <li
                key={id}
                className={cn(
                  'rounded-lg border px-3 py-2',
                  change
                    ? 'border-[#00C9B1]/35 bg-[#00C9B1]/8'
                    : 'border-white/[0.08] bg-[#080b0b]/80',
                )}
              >
                <p className="text-sm font-medium text-white/90">
                  {idx + 1}. {labelForSectionId(id, sections, changes)}
                </p>
                {change?.explanation ? (
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{change.explanation}</p>
                ) : null}
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}

export function CvSectionOrderSuggestModal({
  open,
  onOpenChange,
  profileId,
  existingSections,
  initialSuggest = null,
  onApplied,
  layerZIndex,
}: CvSectionOrderSuggestModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [suggest, setSuggest] = useState<CvSectionOrderSuggestResult | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustedVisible, setAdjustedVisible] = useState<string[]>([]);

  const fetchSuggest = useMutation({
    mutationFn: () => api.cv.suggestSectionOrder(profileId),
    onSuccess: (data) => {
      const merged = mergeSectionOrderSuggestWithClientFallback(data, existingSections) ?? data;
      setSuggest(merged);
      const { visible } = splitSuggestedOrder(merged.currentOrder, merged.suggestedOrder);
      setAdjustedVisible(visible);
      setAdjusting(false);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const applyOrder = useMutation({
    mutationFn: async (sectionIds: string[]) => {
      return api.cv.reorderSections(sectionIds, profileId);
    },
    onSuccess: async (result) => {
      const rows = result.sections;
      if (rows.length > 0) {
        queryClient.setQueryData(queryKeys.cv.sections(profileId), rows);
      }
      await refreshCvState(queryClient, profileId, {
        refreshProfile: true,
        refreshSections: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv.sectionOrderSuggest(profileId),
      });
      writeSectionOrderBannerDismissed(profileId);
      toast.success('Section order updated');
      onApplied?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  useEffect(() => {
    if (!open) {
      setSuggest(null);
      setAdjusting(false);
      setAdjustedVisible([]);
      return;
    }
    const seed = initialSuggest
      ? mergeSectionOrderSuggestWithClientFallback(initialSuggest, existingSections)
      : null;
    if (seed) {
      setSuggest(seed);
      const { visible } = splitSuggestedOrder(seed.currentOrder, seed.suggestedOrder);
      setAdjustedVisible(visible);
      setAdjusting(false);
      return;
    }
    void fetchSuggest.mutateAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once when modal opens without seed data
  }, [open, initialSuggest, existingSections]);

  const split = useMemo(() => {
    if (!suggest) return null;
    return splitSuggestedOrder(suggest.currentOrder, suggest.suggestedOrder);
  }, [suggest]);

  const finalSectionIds = useMemo(() => {
    if (!suggest || !split) return [];
    const visible = adjusting ? adjustedVisible : split.visible;
    return [...visible, ...split.hiddenTail];
  }, [adjusting, adjustedVisible, split, suggest]);

  const moveVisible = useCallback((index: number, direction: -1 | 1) => {
    setAdjustedVisible((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  }, []);

  const busy = fetchSuggest.isPending || applyOrder.isPending;
  const frontendSuboptimal = sectionsOrderIsSuboptimal(existingSections);
  const isOptimal = suggest?.isOptimal === true && !frontendSuboptimal;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Professional section order"
      description="Suggested arrangement based on your experience level and industry — nothing changes until you accept."
      scrollBody
      className="max-w-3xl"
      layerZIndex={layerZIndex}
    >
      {fetchSuggest.isPending && !suggest ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/50">
          <Loader2 className="h-5 w-5 animate-spin text-[#00C9B1]" />
          Analyzing section order…
        </div>
      ) : suggest ? (
        <div className="space-y-4">
          {suggest.industryLabel || suggest.careerStage ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
              {suggest.careerStage} career
              {suggest.industryLabel ? ` · ${suggest.industryLabel}` : ''}
            </p>
          ) : null}
          {isOptimal ? (
            <p className="rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-4 py-3 text-sm text-white/80">
              Your sections are already in a strong order for this profile. No changes are
              needed.
            </p>
          ) : (
            <>
              {suggest.overview ? (
                <p className="text-sm leading-relaxed text-white/75">{suggest.overview}</p>
              ) : null}
              {!adjusting ? (
                <div className="flex flex-col gap-4 sm:flex-row">
                  <OrderColumn
                    title="Current"
                    sectionIds={suggest.currentOrder}
                    sections={existingSections}
                    changes={suggest.changes}
                  />
                  <OrderColumn
                    title="Suggested"
                    sectionIds={split?.visible ?? []}
                    sections={existingSections}
                    changes={suggest.changes}
                  />
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs text-white/45">
                    Drag order with the arrows, then apply. Hidden sections stay at the end of your
                    CV automatically.
                  </p>
                  <ol className="space-y-2">
                    {adjustedVisible.map((id, idx) => {
                      const change = changeBySectionId(suggest.changes, id);
                      return (
                        <li
                          key={id}
                          className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-[#080b0b]/80 px-2 py-2"
                        >
                          <GripVertical className="mt-1 h-4 w-4 shrink-0 text-white/25" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white/90">
                              {labelForSectionId(id, existingSections, suggest.changes)}
                            </p>
                            {change?.explanation ? (
                              <p className="mt-0.5 text-xs text-white/50">{change.explanation}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col gap-0.5">
                            <button
                              type="button"
                              className="rounded border border-white/10 p-1 text-white/55 hover:border-[#00C9B1]/40 disabled:opacity-30"
                              disabled={idx === 0 || busy}
                              onClick={() => moveVisible(idx, -1)}
                              aria-label="Move up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="rounded border border-white/10 p-1 text-white/55 hover:border-[#00C9B1]/40 disabled:opacity-30"
                              disabled={idx >= adjustedVisible.length - 1 || busy}
                              onClick={() => moveVisible(idx, 1)}
                              aria-label="Move down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-4">
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {!isOptimal ? (
              <>
                {adjusting ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-white/10"
                    disabled={busy}
                    onClick={() => setAdjusting(false)}
                  >
                    Back
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-white/10"
                    disabled={busy}
                    onClick={() => setAdjusting(true)}
                  >
                    Adjust order
                  </Button>
                )}
                <Button
                  type="button"
                  className="gap-1.5 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]/90"
                  disabled={busy || finalSectionIds.length === 0}
                  onClick={() => applyOrder.mutate(finalSectionIds)}
                >
                  {applyOrder.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Accept {adjusting ? 'custom' : 'suggested'} order
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
