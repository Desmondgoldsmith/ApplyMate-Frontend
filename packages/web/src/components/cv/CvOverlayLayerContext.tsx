'use client';

import { createContext, useContext } from 'react';

import { CV_CLINIC_PORTAL_Z } from '@/lib/cvOverlayLayer';

const CvOverlayLayerContext = createContext(CV_CLINIC_PORTAL_Z);

export function CvOverlayLayerProvider({
  zIndex,
  children,
}: {
  zIndex: number;
  children: React.ReactNode;
}) {
  return <CvOverlayLayerContext.Provider value={zIndex}>{children}</CvOverlayLayerContext.Provider>;
}

export function useCvOverlayZIndex(): number {
  return useContext(CvOverlayLayerContext);
}
