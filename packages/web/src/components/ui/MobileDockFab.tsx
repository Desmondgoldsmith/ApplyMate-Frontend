'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { useDraggableFab } from '@/hooks/useDraggableFab';
import { cn } from '@/lib/utils';

type MobileDockFabProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  label: string;
  badge?: string | number;
  /** Unique key for persisting drag position (mobile only). */
  fabId: string;
  /** Stack above the AI assistant FAB (0 = closest above AI). */
  stackIndex?: number;
  children: ReactNode;
};

/** Floating action button + bottom sheet (mobile / tablet below lg only). */
export function MobileDockFab({
  open,
  onOpenChange,
  icon: Icon,
  label,
  badge,
  fabId,
  stackIndex = 0,
  children,
}: MobileDockFabProps) {
  const { navBottomOffset, navVisible } = useMobileShell();
  const drag = useDraggableFab(`applymate:mobileFab:${fabId}`);

  const aiBaseBottom = navVisible
    ? `calc(${navBottomOffset} + 0.25rem)`
    : `calc(${navBottomOffset} + 0.25rem)`;
  const stackStepRem = 3.25;
  const fabBottom = `calc(${aiBaseBottom} + ${(stackIndex + 1) * stackStepRem}rem)`;

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
        aria-label={`${label} — long-press to drag`}
        aria-expanded={open}
        style={{
          bottom: fabBottom,
          right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
          transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)`,
        }}
        className={cn(
          'fixed z-[89] inline-flex h-11 min-w-11 touch-none select-none items-center justify-center gap-1.5 rounded-full border border-[rgba(16,185,129,0.45)] bg-[#0C0F0F] px-3 text-emerald-300 shadow-[0_10px_28px_rgba(0,0,0,0.42)] lg:hidden',
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {badge != null && badge !== '' && badge !== 0 ? (
          <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
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
              className="fixed inset-0 z-[120] bg-black/55 lg:hidden"
              onClick={() => onOpenChange(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-x-0 z-[121] flex max-h-[min(88dvh,720px)] flex-col overflow-hidden rounded-t-2xl border border-[#00C9B1]/25 bg-[#0C0F0F] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] lg:hidden"
              style={{ bottom: navVisible ? navBottomOffset : 0 }}
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
              <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
                {children}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
