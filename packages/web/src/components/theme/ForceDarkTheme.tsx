'use client';

import { useLayoutEffect } from 'react';

/** Ensures the app stays on dark theme (light mode removed). Resets any saved preference. */
export function ForceDarkTheme() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
    try {
      window.localStorage.setItem('applymate:theme', 'dark');
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
