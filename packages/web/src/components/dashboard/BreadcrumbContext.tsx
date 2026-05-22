'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbContextValue = {
  /** Replaces or extends the last auto-generated crumb (e.g. job title in Job Hub). */
  trailSuffix: BreadcrumbItem[] | null;
  setTrailSuffix: (items: BreadcrumbItem[] | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trailSuffix, setTrailSuffixState] = useState<BreadcrumbItem[] | null>(null);

  const setTrailSuffix = useCallback((items: BreadcrumbItem[] | null) => {
    setTrailSuffixState(items);
  }, []);

  const value = useMemo(
    () => ({
      trailSuffix,
      setTrailSuffix,
    }),
    [trailSuffix, setTrailSuffix],
  );

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbTrail() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    return {
      trailSuffix: null as BreadcrumbItem[] | null,
      setTrailSuffix: (_items: BreadcrumbItem[] | null) => {},
    };
  }
  return ctx;
}
