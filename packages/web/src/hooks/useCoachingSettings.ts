'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { interviewPrepApi } from '@/lib/interview-prep-api';
import {
  DEFAULT_COACHING_SETTINGS,
  type CoachingIntensity,
  type CoachingSettings,
} from '@/lib/interview-prep-types';

function normalizeSettings(raw?: CoachingSettings | null): CoachingSettings {
  if (!raw) return { ...DEFAULT_COACHING_SETTINGS };
  return {
    enabled: raw.enabled !== false,
    intensity: raw.intensity ?? 'standard',
    mode: raw.mode ?? 'real_time',
  };
}

export function useCoachingSettings(
  sessionId: string | null,
  initial?: CoachingSettings | null,
) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<CoachingSettings>(() =>
    normalizeSettings(initial),
  );

  useEffect(() => {
    if (initial) setSettings(normalizeSettings(initial));
  }, [initial?.enabled, initial?.intensity, initial?.mode]);

  const patchMutation = useMutation({
    mutationFn: (body: Partial<CoachingSettings>) => {
      if (!sessionId) return Promise.reject(new Error('No session'));
      return interviewPrepApi.patchCoachingSettings(sessionId, body);
    },
    onSuccess: (data) => {
      if (!sessionId) return;
      const next = normalizeSettings(data.coachingSettings);
      setSettings(next);
      queryClient.setQueryData<{ coachingSettings?: CoachingSettings }>(
        ['interview-session', sessionId],
        (old) => (old ? { ...old, coachingSettings: next } : old),
      );
      queryClient.setQueryData(
        ['interview-prep', 'session', sessionId],
        (old: { coachingSettings?: CoachingSettings } | undefined) =>
          old ? { ...old, coachingSettings: next } : old,
      );
    },
  });

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const next = { ...settings, enabled };
      setSettings(next);
      if (sessionId) patchMutation.mutate({ enabled });
    },
    [patchMutation, sessionId, settings],
  );

  const setIntensity = useCallback(
    (intensity: CoachingIntensity) => {
      const next = { ...settings, intensity };
      setSettings(next);
      if (sessionId) patchMutation.mutate({ intensity });
    },
    [patchMutation, sessionId, settings],
  );

  const setMode = useCallback(
    (mode: CoachingSettings['mode']) => {
      const next = { ...settings, mode };
      setSettings(next);
      if (sessionId) patchMutation.mutate({ mode });
    },
    [patchMutation, sessionId, settings],
  );

  const applyLocal = useCallback((partial: Partial<CoachingSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    settings,
    setEnabled,
    setIntensity,
    setMode,
    applyLocal,
    isUpdating: patchMutation.isPending,
    shouldRequestCoachingOnSubmit:
      settings.enabled &&
      (settings.mode === 'real_time' || settings.mode === 'on_demand'),
    showCoachingPanel: settings.enabled,
  };
}
