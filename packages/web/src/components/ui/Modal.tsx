'use client';

import { X } from 'lucide-react';
import type { ReactNode, WheelEvent } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Extra classes for the title heading (when `title` is set). */
  titleClassName?: string;
  /**
   * When true, the dialog uses a max height and only the body (below title/description) scrolls.
   * Title and description stay fixed at the top of the card.
   */
  scrollBody?: boolean;
  /** Stop overlay click from closing (e.g. while a form is dirty) */
  closeOnOverlayClick?: boolean;
  /** When false, no header close control is shown (Escape still runs unless you handle it outside). */
  showCloseButton?: boolean;
  /** Stack order when nested inside another overlay (e.g. CV tailoring shell). */
  layerZIndex?: number;
  /** Extra classes for the scrollable body wrapper (below title/description). */
  bodyClassName?: string;
};

/**
 * Scroll model: when `scrollBody` is true, only the body region scrolls (overlay stays fixed).
 * Lock document scroll while open so nested modals do not show a third page scrollbar.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  titleClassName,
  scrollBody = false,
  closeOnOverlayClick = true,
  showCloseButton = true,
  layerZIndex,
  bodyClassName,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const onOverlayWheelCapture = (e: WheelEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('[role="dialog"]')) return;
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex bg-black/60 p-4 backdrop-blur-sm',
        scrollBody ? 'overflow-hidden' : 'overflow-y-auto',
        layerZIndex == null && 'z-[100]',
      )}
      style={layerZIndex != null ? { zIndex: layerZIndex } : undefined}
      data-lenis-prevent
      data-lenis-prevent-wheel
      onWheelCapture={onOverlayWheelCapture}
    >
      <div
        className={cn(
          'relative flex w-full items-center justify-center py-6',
          scrollBody ? 'h-full min-h-0' : 'min-h-full',
        )}
      >
        <button
          type="button"
          aria-label="Close dialog"
          className="absolute inset-0"
          onClick={() => (closeOnOverlayClick ? onOpenChange(false) : undefined)}
        />
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#00C9B1]/20 bg-[#0C0F0F] shadow-xl',
            scrollBody && 'max-h-[85vh] sm:max-h-[min(90dvh,880px)]',
            !scrollBody && 'app-scrollbar',
            className,
          )}
        >
          {showCloseButton && !(title || description) ? (
            <button
              type="button"
              aria-label="Close dialog"
              className="absolute right-3 top-3 z-20 rounded-lg border border-white/[0.08] bg-[#111616] p-1.5 text-white/70 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {title || description ? (
            <div
              className={cn(
                'relative shrink-0 border-b border-white/[0.06] px-6 pb-4 pt-6 pr-14',
                scrollBody && 'sticky top-0 z-[1] bg-inherit',
              )}
            >
              {showCloseButton ? (
                <button
                  type="button"
                  aria-label="Close dialog"
                  className="absolute right-4 top-4 z-20 rounded-lg border border-white/[0.08] bg-[#111616]/90 p-1.5 text-white/70 backdrop-blur-sm transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
              {title ? (
                <h2 className={cn('text-lg font-bold text-white', titleClassName)}>{title}</h2>
              ) : null}
              {description ? <p className="mt-2 text-sm text-white/55">{description}</p> : null}
            </div>
          ) : null}
          <div
            className={cn(
              'px-6 pb-6',
              title || description ? 'pt-4' : 'pt-6',
              scrollBody &&
                'app-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain',
              bodyClassName,
            )}
            data-lenis-prevent
            data-lenis-prevent-wheel
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
