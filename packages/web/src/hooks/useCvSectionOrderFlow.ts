'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import type { CVSectionRecord } from '@/lib/api';
import {
  cvSectionOrderSuggestQueryKey,
  mergeSectionOrderSuggestWithClientFallback,
  readSectionOrderBannerDismissed,
  sectionOrderMatchesSuggested,
  sectionsOrderIsSuboptimal,
  writeSectionOrderBannerDismissed,
  type CvSectionOrderSuggestResult,
} from '@/lib/cvSectionOrderSuggest';

export function useCvSectionOrderFlow(
  profileId: string | null | undefined,
  sections?: CVSectionRecord[] | null,
) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const pid = profileId?.trim() ?? '';
  const sectionRows = sections ?? [];

  const [bannerDismissed, setBannerDismissed] = useState(() =>
    pid ? readSectionOrderBannerDismissed(pid) : true,
  );

  useEffect(() => {
    setBannerDismissed(pid ? readSectionOrderBannerDismissed(pid) : true);
  }, [pid]);

  const suggestQuery = useQuery({
    queryKey: cvSectionOrderSuggestQueryKey(pid),
    queryFn: () => api.cv.suggestSectionOrder(pid),
    enabled: Boolean(pid) && !bannerDismissed,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const effectiveSuggestData = useMemo(
    () => mergeSectionOrderSuggestWithClientFallback(suggestQuery.data, sectionRows),
    [suggestQuery.data, sectionRows],
  );

  const showProactiveBanner = useMemo(() => {
    if (!pid || bannerDismissed) return false;
    const data = effectiveSuggestData;
    if (data?.isOptimal) return false;
    if (data?.suggestedOrder?.length && sectionOrderMatchesSuggested(sectionRows, data.suggestedOrder)) {
      return false;
    }
    if (data && data.showProactiveSuggestion === false) return false;
    if (sectionRows.length > 0 && sectionsOrderIsSuboptimal(sectionRows)) return true;
    if (data && !data.isOptimal) return true;
    return false;
  }, [pid, bannerDismissed, effectiveSuggestData, sectionRows]);

  const invalidateSuggest = useCallback(() => {
    if (!pid) return;
    void queryClient.invalidateQueries({
      queryKey: cvSectionOrderSuggestQueryKey(pid),
    });
  }, [pid, queryClient]);

  const markOrderApplied = useCallback(() => {
    if (!pid) return;
    writeSectionOrderBannerDismissed(pid);
    setBannerDismissed(true);
    invalidateSuggest();
  }, [pid, invalidateSuggest]);

  const openSuggestModal = useCallback(
    (prefetch?: CvSectionOrderSuggestResult | null) => {
      const merged = mergeSectionOrderSuggestWithClientFallback(prefetch, sectionRows);
      if (merged) {
        queryClient.setQueryData(cvSectionOrderSuggestQueryKey(pid), merged);
      }
      setModalOpen(true);
    },
    [pid, queryClient, sectionRows],
  );

  const dismissBanner = useCallback(() => {
    if (!pid) return;
    writeSectionOrderBannerDismissed(pid);
    setBannerDismissed(true);
  }, [pid]);

  return {
    modalOpen,
    setModalOpen,
    suggestQuery,
    suggestData: effectiveSuggestData,
    showProactiveBanner,
    openSuggestModal,
    dismissBanner,
    markOrderApplied,
    invalidateSuggest,
    bannerDismissed,
  };
}
