'use client';

import { useMemo } from 'react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  jobAnalyzeCandidateLocationFields,
  type JobAnalyzeCandidateLocationFields,
} from '@/lib/jobAnalyzeCandidateLocation';
import { useLocationStore } from '@/store/useLocationStore';

/** Location hints for POST /jobs/analyze (local-currency AI salary fallback). */
export function useJobAnalyzeLocationPayload(
  cvProfileLocation?: string | null,
): JobAnalyzeCandidateLocationFields {
  const { data: me } = useCurrentUser();
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const detectedCountryCode = useLocationStore(
    (s) => s.detectedLocation?.countryCode ?? null,
  );

  return useMemo(() => {
    const uiPrefs = me?.uiPrefs as { jobSearchLocation?: string } | null | undefined;
    return jobAnalyzeCandidateLocationFields({
      userLocation: me?.location,
      jobSearchLocation: uiPrefs?.jobSearchLocation,
      selectedLocation,
      detectedCountryCode,
      cvProfileLocation,
    });
  }, [me?.location, me?.uiPrefs, selectedLocation, detectedCountryCode, cvProfileLocation]);
}
