'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore, type ResolvedGeoLocation } from '@/store/useLocationStore';

function hasUsableGeo(geo: ResolvedGeoLocation | null): boolean {
  if (!geo) return false;
  return Boolean(geo.country?.trim() || geo.city?.trim());
}

export function useLocationBootstrap(enabled: boolean) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const detectedLocation = useLocationStore((s) => s.detectedLocation);
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const promptDismissedAt = useLocationStore((s) => s.promptDismissedAt);
  const setDetectedLocation = useLocationStore((s) => s.setDetectedLocation);
  const setLoading = useLocationStore((s) => s.setLoading);

  const [promptOpen, setPromptOpen] = useState(false);

  const resolveMutation = useMutation({
    mutationFn: () => api.location.resolve(),
    onMutate: () => setLoading(true),
    onSettled: () => setLoading(false),
    onSuccess: (geo) => {
      setDetectedLocation(geo);
      if (!selectedLocation && !promptDismissedAt && hasUsableGeo(geo)) {
        setPromptOpen(true);
      }
    },
  });

  useEffect(() => {
    if (!enabled || !accessToken) return;
    if (detectedLocation) return;
    void resolveMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per session when token present
  }, [enabled, accessToken, detectedLocation]);

  const shouldShowPrompt = useMemo(
    () => promptOpen && hasUsableGeo(detectedLocation) && !selectedLocation,
    [promptOpen, detectedLocation, selectedLocation],
  );

  return {
    shouldShowPrompt,
    detectedLocation,
    closePrompt: () => setPromptOpen(false),
    resolveMutation,
  };
}
