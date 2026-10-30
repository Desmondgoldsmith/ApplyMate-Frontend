'use client';

import { CircleHelp, Compass, PlayCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { WALKTHROUGH_VIDEO_ID } from '@/lib/walkthroughVideo';
import { openWalkthroughVideo, startWelcomeTour } from '@/lib/welcomeEvents';
import { cn } from '@/lib/utils';

const itemClass =
  'flex min-h-[44px] w-full items-center gap-2.5 px-3 text-left text-[14px] font-medium text-text-primary transition-colors hover:bg-bg-hover focus-visible:bg-bg-hover focus-visible:outline-none';

/** Header "Help" button: replay the welcome tour or watch the walkthrough video. */
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const takeTour = () => {
    setOpen(false);
    if (pathname === '/dashboard') {
      startWelcomeTour();
      return;
    }
    router.push('/dashboard?tour=1');
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        data-tour="help-menu"
        aria-label="Help"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-default text-text-secondary transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
          open && 'bg-bg-hover text-text-primary',
        )}
      >
        <CircleHelp className="h-[18px] w-[18px]" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised py-1.5 shadow-overlay"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={takeTour}
          >
            <Compass className="h-4 w-4 text-accent-text" aria-hidden />
            Take the tour
          </button>
          {WALKTHROUGH_VIDEO_ID ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                openWalkthroughVideo();
              }}
            >
              <PlayCircle className="h-4 w-4 text-accent-text" aria-hidden />
              Watch the walkthrough video
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
