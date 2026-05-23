'use client';

import { Loader2, Sparkles, Wand2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { CvAssistantRunResult } from '@/components/cv/CVEditContext';
import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { Button } from '@/components/ui/Button';
import { useDraggableFab } from '@/hooks/useDraggableFab';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS = [
  'Complete my summary for a frontend developer role',
  'Improve bullet 2 in my latest experience entry',
  'Make my achievements section more quantifiable',
];

const FAB_DRAG_STORAGE_KEY = 'applymate:cv:assistantFabOffset';

function useDesktopLgMedia(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia('(min-width: 1024px)');
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () =>
      typeof window !== 'undefined'
        ? window.matchMedia('(min-width: 1024px)').matches
        : false,
    () => false,
  );
}

export type AISectionAssistantPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  clarificationQuestion?: string | null;
  /** When false, the floating Assistant button is hidden (e.g. another right-side drawer is open). */
  showFab?: boolean;
  onSubmit: (
    command: string,
    clarifications?: Array<{ question: string; answer: string }>,
  ) => Promise<void | CvAssistantRunResult> | void;
  /** When the drawer opens with a non-empty value, replaces the command textarea once; parent clears via {@link onSeedCommandConsumed}. */
  seedCommand?: string | null;
  onSeedCommandConsumed?: () => void;
};

export function AISectionAssistantPanel({
  open,
  onOpenChange,
  busy,
  clarificationQuestion,
  showFab = true,
  onSubmit,
  seedCommand = null,
  onSeedCommandConsumed,
}: AISectionAssistantPanelProps) {
  const desktopLg = useDesktopLgMedia();
  const { navBottomOffset } = useMobileShell();
  const [text, setText] = useState('');
  const [clarifyAnswer, setClarifyAnswer] = useState('');

  useEffect(() => {
    if (!open) return;
    const s = seedCommand?.trim();
    if (!s) return;
    setText(s);
    onSeedCommandConsumed?.();
  }, [open, seedCommand, onSeedCommandConsumed]);
  const desktopDrag = useDraggableFab(FAB_DRAG_STORAGE_KEY);
  const mobileDrag = useDraggableFab(`${FAB_DRAG_STORAGE_KEY}:mobile`);
  const drag = desktopLg ? desktopDrag : mobileDrag;

  const mobileFabBottom = `calc(${navBottomOffset} + 0.25rem)`;

  return (
    <>
      {showFab ? (
        <button
          type="button"
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
          onClick={(e) => {
            if (drag.shouldSuppressClick()) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            onOpenChange(true);
          }}
          title="AI Section Assistant — long-press to drag"
          aria-label="Open AI section assistant"
          style={
            desktopLg
              ? {
                  bottom: '0.75rem',
                  right: 'clamp(5.5rem, 22vw, 17.5rem)',
                  transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)`,
                }
              : {
                  transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)`,
                  bottom: mobileFabBottom,
                  right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
                }
          }
          className={cn(
            'fixed z-[90] touch-none select-none',
            'inline-flex items-center justify-center rounded-full border border-[rgba(16,185,129,0.45)] bg-[#0C0F0F] text-emerald-300 shadow-[0_10px_28px_rgba(0,0,0,0.42)] transition-[border-color,box-shadow] hover:border-emerald-300/75 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]',
            desktopLg
              ? 'h-10 min-w-0 gap-1.5 px-3 text-xs font-semibold touch-manipulation'
              : 'h-11 w-11 touch-manipulation',
          )}
        >
          <Sparkles
            className={cn(
              'shrink-0',
              desktopLg ? 'h-4 w-4' : 'h-[18px] w-[18px]',
            )}
          />
          <span className={cn(desktopLg ? 'inline' : 'hidden')}>Assistant</span>
        </button>
      ) : null}
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close AI assistant overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[121] cursor-default border-0 bg-black/35"
              onClick={() => onOpenChange(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="fixed z-[122] w-[min(92vw,360px)] max-lg:right-3 max-lg:left-auto lg:bottom-20 lg:right-6"
              style={
                desktopLg
                  ? undefined
                  : {
                      bottom: `calc(${mobileFabBottom} + 3.5rem)`,
                      right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
                    }
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-white/[0.08] bg-[#0C0F0F] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.45)]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    AI Section Assistant
                  </p>
                  <button
                    type="button"
                    className="rounded-md p-1 text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {clarificationQuestion ? (
                  <div className="mb-2 rounded-lg border border-amber-400/35 bg-amber-500/10 p-2">
                    <p className="text-[11px] font-semibold text-amber-300">
                      Clarification needed
                    </p>
                    <p className="mt-1 text-xs text-white/80">
                      {clarificationQuestion}
                    </p>
                    <input
                      value={clarifyAnswer}
                      onChange={(e) => setClarifyAnswer(e.target.value)}
                      placeholder="Type your answer..."
                      className="mt-2 h-9 w-full rounded-lg border border-white/[0.12] bg-[#111616] px-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-[#00C9B1]/35"
                    />
                  </div>
                ) : null}
                <textarea
                  data-testid="cv-assistant-command"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder="e.g. Complete my summary using my experience and skills"
                  className="w-full resize-y rounded-xl border border-white/[0.12] bg-[#111616] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#00C9B1]/35"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setText(q)}
                      className={cn(
                        'rounded-full border border-white/[0.10] px-2 py-1 text-[10px] text-white/65 transition hover:border-[#00C9B1]/55 hover:text-white',
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  className="mt-3 w-full gap-2"
                  disabled={busy || text.trim().length < 8}
                  onClick={async () => {
                    const command = text.trim();
                    if (command.length < 8) return;
                    if (
                      clarificationQuestion &&
                      clarifyAnswer.trim().length > 0
                    ) {
                      await onSubmit(command, [
                        {
                          question: clarificationQuestion,
                          answer: clarifyAnswer.trim(),
                        },
                      ]);
                      setClarifyAnswer('');
                      return;
                    }
                    await onSubmit(command);
                  }}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Run command
                </Button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
