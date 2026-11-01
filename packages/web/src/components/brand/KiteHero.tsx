'use client';

import { useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { CareerKiteMark } from '@/components/brand/CareerKiteMark';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';

const LARGE_SCREEN = '(min-width: 1024px)';

function subscribeLargeScreen(onChange: () => void) {
  const media = window.matchMedia(LARGE_SCREEN);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

let webgl2Supported: boolean | null = null;

/**
 * Probed once: this runs on every render, and each probe would open a WebGL context. Browsers
 * cap live contexts and drop the oldest (the kite's), so re-probing made the kite blink.
 */
function hasWebgl2(): boolean {
  if (webgl2Supported !== null) return webgl2Supported;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl2Supported = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Supported = false;
  }
  return webgl2Supported;
}

function canRender3d(): boolean {
  return window.matchMedia(LARGE_SCREEN).matches && hasWebgl2();
}

/** After a lost WebGL context, retry the 3D kite a couple of times, then stay static. */
const MAX_CONTEXT_RETRIES = 2;
const CONTEXT_RETRY_MS = 3000;

/** Scales with its box so the flat logo takes the same space as the 3D kite. */
function StaticKite() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center text-text-primary">
      <CareerKiteMark
        size={400}
        variant="full"
        className="aspect-square h-auto max-h-[78%] w-[min(70%,26rem)]"
      />
    </div>
  );
}

const Kite3D = dynamic(() => import('@/components/brand/Kite3D'), {
  ssr: false,
  loading: StaticKite,
});

const INK = { light: '#141714', dark: '#f2f4ec' } as const;
const DOT = { light: '#17b26a', dark: '#b9f542' } as const;

/**
 * The 3D kite when it can run (large screen, WebGL2, motion allowed),
 * otherwise the static mark in the same box. Give it a height.
 */
export function KiteHero({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const show3d = useSyncExternalStore(
    subscribeLargeScreen,
    canRender3d,
    () => false,
  );
  const [lostCount, setLostCount] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const handleContextLost = useCallback(() => {
    setContextLost(true);
    setLostCount((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!contextLost || lostCount > MAX_CONTEXT_RETRIES) return;
    const id = window.setTimeout(() => setContextLost(false), CONTEXT_RETRY_MS);
    return () => window.clearTimeout(id);
  }, [contextLost, lostCount]);

  return (
    <div className={cn('relative', className)}>
      {show3d && !reducedMotion && !contextLost ? (
        <Kite3D
          key={lostCount}
          inkColor={INK[resolvedTheme]}
          dotColor={DOT[resolvedTheme]}
          onContextLost={handleContextLost}
        />
      ) : (
        <StaticKite />
      )}
    </div>
  );
}
