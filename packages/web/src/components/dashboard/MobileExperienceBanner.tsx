'use client';

import { Monitor, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export type MobileExperienceSurface = 'cv-clinic' | 'interview-prep';

const STORAGE_PREFIX = 'applymate:mobile-desktop-hint:';

const COPY: Record<MobileExperienceSurface, { title: string; body: string }> = {
  'cv-clinic': {
    title: 'Best on desktop',
    body: 'On mobile, some CV editor tools are hidden to fit the screen. Switch to a laptop or desktop for the full layout.',
  },
  'interview-prep': {
    title: 'Best on desktop',
    body: 'On mobile, parts of interview prep are simplified. Use a larger screen for coaching panels and the full practice layout.',
  },
};

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export function MobileExperienceBanner({
  surface,
  className,
}: {
  surface: MobileExperienceSurface;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobileViewport()) return;
    try {
      const dismissed =
        sessionStorage.getItem(`${STORAGE_PREFIX}${surface}`) === '1';
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [surface]);

  if (!visible) return null;

  const copy = COPY[surface];

  return (
    <div
      role="status"
      className={cn(
        'relative flex gap-3 rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/[0.08] px-3.5 py-3 pr-10 shadow-[0_8px_24px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-[#00C9B1]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-white">{copy.title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/60">
          {copy.body}
        </p>
      </div>
      <button
        type="button"
        className="absolute right-2 top-2 rounded-md p-1.5 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
        aria-label="Dismiss"
        onClick={() => {
          try {
            sessionStorage.setItem(`${STORAGE_PREFIX}${surface}`, '1');
          } catch {
            /* ignore */
          }
          setVisible(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
