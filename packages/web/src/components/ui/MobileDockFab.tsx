'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { ScrollContentEnd } from '@/components/ui/ScrollContentEnd';
import { useDraggableFab } from '@/hooks/useDraggableFab';
import { cn } from '@/lib/utils';

type MobileDockFabProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  label: string;
  /** Short visible text on the button ("Tools", "Score"); falls back to icon-only. */
  shortLabel?: string;
  /** Count or value shown after the label. */
  badge?: string | number;
  /** `alert` = red count (things to fix); `neutral` = plain value such as a score. */
  badgeTone?: 'alert' | 'neutral';
  /** Unique key for persisting drag position (mobile only). */
  fabId: string;
  /** Stack above the AI assistant FAB (0 = closest above AI). */
  stackIndex?: number;
  /** `data-tour` value so a guided tour can point at this button. */
  tourAttr?: string;
  children: ReactNode;
};

/** Floating action button + bottom sheet (mobile / tablet below lg only). */
export function MobileDockFab({
  open,
  onOpenChange,
  icon: Icon,
  label,
  shortLabel,
  badge,
  badgeTone = 'alert',
  fabId,
  stackIndex = 0,
  tourAttr,
  children,
}: MobileDockFabProps) {
  const { navBottomOffset } = useMobileShell();
  const drag = useDraggableFab(`applymate:mobileFab:${fabId}`);

  const aiBaseBottom = `calc(${navBottomOffset} + 0.25rem)`;
  const stackStepRem = 3.5;
  const fabBottom = `calc(${aiBaseBottom} + ${(stackIndex + 1) * stackStepRem}rem)`;
  const showBadge = badge != null && badge !== '' && badge !== 0;

  const onFabClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (drag.shouldSuppressClick()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onOpenChange(true);
  };

  return (
    <>
      <button
        type="button"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        onClick={onFabClick}
        aria-label={label}
        aria-expanded={open}
        data-tour={tourAttr}
        style={{
          bottom: fabBottom,
          right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
          transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)`,
        }}
        className="fixed z-[89] inline-flex h-12 min-w-12 touch-none select-none items-center justify-center gap-2 rounded-full border border-border-default bg-bg-raised px-4 text-[14px] font-semibold text-text-primary shadow-overlay transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus lg:hidden"
      >
        <Icon
          className="h-[18px] w-[18px] shrink-0 text-accent-text"
          aria-hidden
        />
        {shortLabel ? <span>{shortLabel}</span> : null}
        {showBadge ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums',
              badgeTone === 'neutral'
                ? 'bg-accent-subtle text-accent-text'
                : 'bg-danger-solid text-white',
            )}
          >
            {badge}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-bg-overlay lg:hidden"
              onClick={() => onOpenChange(false)}
            />
            <motion.div
              role="dialog"
              aria-label={label}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-[121] flex max-h-[min(88dvh,720px)] flex-col overflow-hidden rounded-t-3xl border border-border-subtle bg-bg-surface shadow-overlay lg:hidden"
            >
              <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3">
                <p className="font-display text-[17px] font-bold text-text-primary">
                  {label}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="min-h-[44px] rounded-xl px-3 text-[14px] font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                >
                  Done
                </button>
              </div>
              <div className="app-scrollbar scroll-content-end-pad min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
                {children}
                <ScrollContentEnd />
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
