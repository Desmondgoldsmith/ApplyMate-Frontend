'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { PortalThemeScope } from '@/components/theme/ThemeScope';
import {
  WALKTHROUGH_VIDEO_ID,
  walkthroughEmbedUrl,
} from '@/lib/walkthroughVideo';
import { WALKTHROUGH_VIDEO_OPEN_EVENT } from '@/lib/welcomeEvents';

/** Plays the walkthrough video in a dialog when anything calls `openWalkthroughVideo()`. */
export function WalkthroughVideoHost() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(WALKTHROUGH_VIDEO_OPEN_EVENT, onOpen);
    return () =>
      window.removeEventListener(WALKTHROUGH_VIDEO_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open || !WALKTHROUGH_VIDEO_ID) return null;

  return createPortal(
    <PortalThemeScope>
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-bg-overlay p-4 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        data-lenis-prevent
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="walkthrough-video-title"
          className="w-full max-w-[960px] overflow-hidden rounded-3xl border border-border-subtle bg-bg-raised shadow-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <h2
                id="walkthrough-video-title"
                className="font-display text-[18px] font-bold tracking-[-0.02em] text-text-primary"
              >
                How CareerKite works
              </h2>
              <p className="text-[13px] text-text-secondary">
                A short tour of everything you can do here.
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close video"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="aspect-video w-full bg-black">
            <iframe
              src={walkthroughEmbedUrl(WALKTHROUGH_VIDEO_ID)}
              title="How CareerKite works"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </div>
    </PortalThemeScope>,
    document.body,
  );
}
