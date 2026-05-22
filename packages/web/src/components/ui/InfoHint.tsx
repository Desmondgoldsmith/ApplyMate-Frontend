'use client';

import { Info } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

type InfoHintProps = {
  text: string;
  className?: string;
  buttonClassName?: string;
  /** Accessible name for the info control (tooltip content is linked via aria-describedby when open). */
  buttonAriaLabel?: string;
  /** Merged onto the tooltip panel (e.g. max width for multi-line section copy). */
  tooltipClassName?: string;
  /** Default is teal accent (consistent across dashboard). Use `muted` for the legacy neutral panel only if needed. */
  variant?: 'accent' | 'muted';
};

const VARIANT_PANEL: Record<NonNullable<InfoHintProps['variant']>, string> = {
  accent:
    'border-[#00C9B1]/50 bg-[#051815] text-[#e6fdf9]/95 shadow-[0_10px_40px_rgba(0,201,177,0.18)] ring-1 ring-[#00C9B1]/20',
  muted: 'border-white/12 bg-[#0b1111] text-white/75 shadow-xl',
};

const CLOSE_DELAY_MS = 140;
const GAP_PX = 6;
const VIEWPORT_MARGIN = 8;

export function InfoHint({
  text,
  className,
  buttonClassName,
  buttonAriaLabel,
  tooltipClassName,
  variant = 'accent',
}: InfoHintProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const layoutRetries = useRef(0);

  const measureAndPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const tr = trigger.getBoundingClientRect();
    let pw = panel.offsetWidth;
    let ph = panel.offsetHeight;
    if (pw < 8 && layoutRetries.current < 5) {
      layoutRetries.current += 1;
      requestAnimationFrame(() => measureAndPosition());
      return;
    }
    layoutRetries.current = 0;
    if (pw < 8) pw = 272;
    if (ph < 8) ph = 48;

    let top = tr.bottom + GAP_PX;
    let left = tr.left + tr.width / 2 - pw / 2;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - pw - VIEWPORT_MARGIN),
    );
    if (top + ph > window.innerHeight - VIEWPORT_MARGIN && tr.top - ph - GAP_PX >= VIEWPORT_MARGIN) {
      top = tr.top - ph - GAP_PX;
    }

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    layoutRetries.current = 0;
    measureAndPosition();
    const id = requestAnimationFrame(() => measureAndPosition());
    return () => cancelAnimationFrame(id);
  }, [open, text, measureAndPosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => measureAndPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, measureAndPosition]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const tooltip =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={tooltipId}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 9999,
            }}
            className={cn(
              'pointer-events-auto w-max max-w-[min(17rem,85vw)] whitespace-pre-line rounded-md border px-2.5 py-2 text-left text-[11px] font-medium leading-snug',
              VARIANT_PANEL[variant],
              tooltipClassName,
            )}
            onPointerEnter={clearCloseTimer}
            onPointerLeave={scheduleClose}
          >
            {text}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('relative inline-flex items-center', className)}
        onPointerEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onPointerLeave={scheduleClose}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label={buttonAriaLabel ?? 'More information'}
          aria-expanded={open}
          aria-describedby={open ? tooltipId : undefined}
          onClick={() => {
            clearCloseTimer();
            setOpen((v) => !v);
          }}
          onFocus={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onBlur={() => scheduleClose()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              clearCloseTimer();
              setOpen((v) => !v);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              clearCloseTimer();
              setOpen(false);
            }
          }}
          className={cn(
            'inline-flex h-4.5 w-4.5 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9B1]/40',
            variant === 'accent'
              ? 'text-[#7ef4e6]/90 hover:text-[#00C9B1]'
              : 'text-white/45 hover:text-[#00C9B1]',
            buttonClassName,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
      </span>
      {tooltip}
    </>
  );
}
