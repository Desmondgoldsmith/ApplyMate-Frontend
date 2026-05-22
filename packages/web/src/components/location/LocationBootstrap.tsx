'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { LocationConfirmPrompt } from '@/components/location/LocationConfirmPrompt';
import { useLocationBootstrap } from '@/hooks/useLocationBootstrap';
import { api } from '@/lib/api';
import { useLocationStore } from '@/store/useLocationStore';

function formatDetectedLabel(geo: {
  city: string | null;
  country: string | null;
}): string {
  const city = geo.city?.trim();
  const country = geo.country?.trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || '';
}

export function LocationBootstrap({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const { shouldShowPrompt, detectedLocation, closePrompt } = useLocationBootstrap(enabled);
  const setSelectedLocation = useLocationStore((s) => s.setSelectedLocation);
  const dismissPrompt = useLocationStore((s) => s.dismissPrompt);

  const persistPreference = useMutation({
    mutationFn: async (label: string) => {
      await api.users.updateMe({
        uiPrefs: { jobSearchLocation: label },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const onUseDetected = useCallback(() => {
    if (!detectedLocation) return;
    const label = formatDetectedLabel(detectedLocation);
    if (!label) return;
    setSelectedLocation(label);
    void persistPreference.mutate(label);
    closePrompt();
  }, [detectedLocation, setSelectedLocation, persistPreference, closePrompt]);

  const onChange = useCallback(() => {
    closePrompt();
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard/job-board?focusLocation=1';
    }
  }, [closePrompt]);

  const onDismiss = useCallback(() => {
    dismissPrompt();
    closePrompt();
  }, [dismissPrompt, closePrompt]);

  if (!shouldShowPrompt || !detectedLocation) return null;

  return (
    <LocationConfirmPrompt
      open={shouldShowPrompt}
      detected={detectedLocation}
      onUseDetected={onUseDetected}
      onChange={onChange}
      onDismiss={onDismiss}
    />
  );
}
