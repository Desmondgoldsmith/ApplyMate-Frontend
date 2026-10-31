'use client';

import { useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { CareerKiteMark } from '@/components/brand/CareerKiteMark';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';

const LARGE_SCREEN = '(min-width: 1024px)';

function subscribeLargeScreen(onChange: () => void) {
  const media = window.matchMedia(LARGE_SCREEN);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function canRender3d(): boolean {
  if (!window.matchMedia(LARGE_SCREEN).matches) return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

const STATIC_SIZE = 200;
/** After a lost WebGL context, retry the 3D kite a couple of times, then stay static. */
const MAX_CONTEXT_RETRIES = 2;
const CONTEXT_RETRY_MS = 3000;

function StaticKite() {
  return (
    <div className="flex h-full items-center justify-center text-text-primary">
      <CareerKiteMark size={STATIC_SIZE} variant="full" />
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
          onContextLost={() => {
            setContextLost(true);
            setLostCount((n) => n + 1);
          }}
        />
      ) : (
        <StaticKite />
      )}
    </div>
  );
}
