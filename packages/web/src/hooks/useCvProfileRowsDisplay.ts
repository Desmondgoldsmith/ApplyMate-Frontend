'use client';

import { useMemo } from 'react';

import { useCVProfile } from '@/hooks/useCVProfile';
import { useCVProfiles } from '@/hooks/useCVProfiles';
import { useCVScore } from '@/hooks/useCVScore';
import type { CvProfileSummary } from '@/lib/api';
import { inferCvProfileNameFromProfile } from '@/lib/infer-cv-profile-name';

/**
 * Merges GET /cv/profiles with GET /cv/profile when the list is empty but a primary CV exists
 * (so overview + CV profiles page stay usable until the list endpoint matches the server).
 */
export function useCvProfileRowsDisplay() {
  const listQ = useCVProfiles();
  const legacy = useCVProfile();
  const apiRows = listQ.data?.rows ?? [];
  const showLegacyAsRow = apiRows.length === 0 && Boolean(legacy.data?.id?.trim());
  const legacyScore = useCVScore(showLegacyAsRow, null);

  const displayRows = useMemo((): CvProfileSummary[] => {
    if (apiRows.length > 0) return apiRows;
    const p = legacy.data;
    if (!p?.id?.trim()) return [];
    const score =
      typeof legacyScore.data?.score === 'number' && Number.isFinite(legacyScore.data.score)
        ? legacyScore.data.score
        : null;
    return [
      {
        id: p.id,
        name: inferCvProfileNameFromProfile(p),
        score,
        isDefault: true,
        template: p.template,
        updatedAt: p.updatedAt,
        headline: p.headline ?? null,
        location: p.location ?? null,
      },
    ];
  }, [apiRows, legacy.data, legacyScore.data?.score]);

  const listInconsistent =
    !listQ.isLoading && !legacy.isLoading && apiRows.length === 0 && Boolean(legacy.data?.id);

  /** Wait for list + legacy profile; do not block on score (score can load in the background). */
  const isBootstrapping = listQ.isPending || (apiRows.length === 0 && legacy.isPending);

  return {
    apiRows,
    displayRows,
    listInconsistent,
    isBootstrapping,
    legacyCv: legacy.data,
  };
}
