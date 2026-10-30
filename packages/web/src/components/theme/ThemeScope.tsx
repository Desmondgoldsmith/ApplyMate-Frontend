'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { ResolvedTheme } from '@/lib/theme/themePreference';
import { cn } from '@/lib/utils';

const ForcedThemeContext = createContext<ResolvedTheme | null>(null);

/** Theme a subtree is pinned to (e.g. inside `LegacyDarkScope`), or null to follow the user. */
export function useForcedTheme(): ResolvedTheme | null {
  return useContext(ForcedThemeContext);
}

/**
 * Pins a subtree to one theme. Context carries the choice through React
 * portals, so dialogs opened from inside keep the same look.
 */
export function ForcedThemeScope({
  theme,
  className,
  children,
}: {
  /** `null` keeps the same wrapper but follows the user's theme (avoids remounts when toggling). */
  theme: ResolvedTheme | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ForcedThemeContext.Provider value={theme}>
      <div
        data-theme={theme ?? undefined}
        className={cn('contents', className)}
      >
        {children}
      </div>
    </ForcedThemeContext.Provider>
  );
}

/** Wrap portal content so it inherits the theme of the scope it was opened from. */
export function PortalThemeScope({ children }: { children: ReactNode }) {
  const forced = useForcedTheme();
  if (!forced) return <>{children}</>;
  return (
    <div data-theme={forced} className="contents">
      {children}
    </div>
  );
}
