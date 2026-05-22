'use client';

import Lenis from 'lenis';
import { useLayoutEffect } from 'react';

/**
 * Imperative Lenis (not ReactLenis) so autoRaf + wheel smoothing are reliable.
 * Respects prefers-reduced-motion (native scroll only).
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const lenis = new Lenis({
      smoothWheel: true,
      autoRaf: true,
      lerp: 0.055,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      anchors: true,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
