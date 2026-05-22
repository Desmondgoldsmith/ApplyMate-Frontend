'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GeoLocationConfidence = 'high' | 'medium' | 'low';

export type ResolvedGeoLocation = {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  confidence: GeoLocationConfidence;
};

type LocationStoreState = {
  detectedLocation: ResolvedGeoLocation | null;
  selectedLocation: string | null;
  /** User dismissed the confirmation prompt without choosing. */
  promptDismissedAt: string | null;
  loading: boolean;
  setDetectedLocation: (loc: ResolvedGeoLocation | null) => void;
  setSelectedLocation: (label: string | null) => void;
  setLoading: (loading: boolean) => void;
  dismissPrompt: () => void;
  clearDismissed: () => void;
  reset: () => void;
};

const initialState = {
  detectedLocation: null as ResolvedGeoLocation | null,
  selectedLocation: null as string | null,
  promptDismissedAt: null as string | null,
  loading: false,
};

export const useLocationStore = create<LocationStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      setDetectedLocation: (loc) => set({ detectedLocation: loc }),
      setSelectedLocation: (label) =>
        set({ selectedLocation: label?.trim() || null, promptDismissedAt: null }),
      setLoading: (loading) => set({ loading }),
      dismissPrompt: () => set({ promptDismissedAt: new Date().toISOString() }),
      clearDismissed: () => set({ promptDismissedAt: null }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'applymate:location-store',
      partialize: (s) => ({
        selectedLocation: s.selectedLocation,
        promptDismissedAt: s.promptDismissedAt,
      }),
    },
  ),
);
