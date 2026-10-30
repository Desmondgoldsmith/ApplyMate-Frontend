'use client';

import { useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';

import { CareerKiteMark } from '@/components/brand/CareerKiteMark';
import { useTheme } from '@/components/theme/ThemeProvider';

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

function StaticKite() {
  return (
    <div className="flex h-full items-center justify-center text-text-primary">
      <CareerKiteMark size={220} variant="full" />
    </div>
  );
}

const Kite3D = dynamic(() => import('@/components/brand/Kite3D'), {
  ssr: false,
  loading: StaticKite,
});

const INK = { light: '#141714', dark: '#f2f4ec' } as const;
const DOT = { light: '#17b26a', dark: '#b9f542' } as const;

/** Right-hand "sky" on the sign-in and sign-up pages: the 3D kite and one line of story. */
export function AuthSkyPanel() {
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const show3d = useSyncExternalStore(
    subscribeLargeScreen,
    canRender3d,
    () => false,
  );

  return (
    <aside className="relative hidden overflow-hidden rounded-[28px] border border-border-subtle bg-bg-sunken lg:flex lg:flex-col">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 78% 22%, var(--ck-glow-a), transparent 70%), radial-gradient(55% 45% at 12% 88%, var(--ck-glow-b), transparent 70%)',
        }}
        aria-hidden
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-text-tertiary"
        viewBox="0 0 600 800"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden
      >
        <path
          className="ck-wind-line"
          d="M-40 210 C 120 170, 260 250, 640 160"
        />
        <path
          className="ck-wind-line ck-wind-line-slow"
          d="M-40 330 C 160 300, 340 380, 640 290"
        />
        <path
          className="ck-wind-line"
          d="M-40 520 C 140 480, 300 560, 640 470"
        />
      </svg>

      <div className="relative min-h-0 flex-1">
        {show3d && !reducedMotion ? (
          <Kite3D inkColor={INK[resolvedTheme]} dotColor={DOT[resolvedTheme]} />
        ) : (
          <StaticKite />
        )}
      </div>

      <div className="relative px-10 pb-10">
        <p className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-text-primary">
          Your career, rising.
        </p>
        <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-text-secondary">
          Build a CV that stands out, find roles that fit and track every
          application in one place.
        </p>
      </div>
    </aside>
  );
}
