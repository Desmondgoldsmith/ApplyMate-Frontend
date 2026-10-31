'use client';

import { Loader2, Sparkles, Wand2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { CvAssistantScopeBadge } from '@/components/cv/CvAssistantScopeBadge';
import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { Button } from '@/components/ui/Button';
import { useDraggableFab } from '@/hooks/useDraggableFab';
import type {
  CvGlobalAssistantOperation,
  CvGlobalAssistantOperationKey,
} from '@/lib/cvGlobalAssistant';
import { resolveGlobalAssistantPresets } from '@/lib/cvGlobalAssistantPresets';
import { CV_ASSISTANT_GENERATING_MESSAGE } from '@/lib/cvAssistantLoadingCopy';
import { cn } from '@/lib/utils';

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

export type AIGlobalAssistantPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  busyLabel?: string | null;
  showFab?: boolean;
  operations: CvGlobalAssistantOperation[];
  operationsLoading?: boolean;
  onSubmit: (
    command: string,
    options?: {
      operation?: CvGlobalAssistantOperationKey;
      clarifications?: Array<{ question: string; answer: string }>;
    },
  ) => Promise<void>;
  seedCommand?: string | null;
  onSeedCommandConsumed?: () => void;
  /** When set (desktop), shift FAB left of a right sidebar (% of viewport). */
  fabRightOffsetPct?: number | null;
};

export function AIGlobalAssistantPanel({
  open,
  onOpenChange,
  busy,
  busyLabel = null,
  showFab = true,
  operations,
  operationsLoading = false,
  onSubmit,
  seedCommand = null,
  onSeedCommandConsumed,
  fabRightOffsetPct = null,
}: AIGlobalAssistantPanelProps) {
  const desktopLg = useDesktopLgMedia();
  const { navBottomOffset } = useMobileShell();
  const [text, setText] = useState('');
  const [pendingScopeLabel, setPendingScopeLabel] = useState('Entire CV');
  const [pendingOperation, setPendingOperation] = useState<
    CvGlobalAssistantOperationKey | undefined
  >(undefined);
  const commandRef = useRef<HTMLTextAreaElement>(null);

  const presetOps = useMemo(
    () => resolveGlobalAssistantPresets(operations),
    [operations],
  );

  useEffect(() => {
    if (!open) return;
    const s = seedCommand?.trim();
    if (!s) return;
    setText(s);
    setPendingOperation(undefined);
    setPendingScopeLabel('Entire CV');
    onSeedCommandConsumed?.();
  }, [open, seedCommand, onSeedCommandConsumed]);

  const desktopDrag = useDraggableFab(FAB_DRAG_STORAGE_KEY);
  const mobileDrag = useDraggableFab(`${FAB_DRAG_STORAGE_KEY}:mobile`);
  const drag = desktopLg ? desktopDrag : mobileDrag;
  const mobileFabBottom = `calc(${navBottomOffset} + 0.25rem)`;

  const scopeVariant = pendingScopeLabel.toLowerCase().includes('finding')
    ? 'findings'
    : 'global';

  const applyPreset = useCallback((op: CvGlobalAssistantOperation) => {
    const cmd = op.exampleCommand.trim() || op.label;
    setText(cmd);
    setPendingScopeLabel(op.affectedScopeLabel);
    setPendingOperation(op.operation);
    requestAnimationFrame(() => {
      commandRef.current?.focus();
      const len = cmd.length;
      commandRef.current?.setSelectionRange(len, len);
    });
  }, []);

  const inProgressLabel = busyLabel?.trim() || CV_ASSISTANT_GENERATING_MESSAGE;

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
          aria-label="Ask AI to change your CV"
          data-tour="cv-ask-ai"
          style={
            desktopLg
              ? {
                  bottom: '0.75rem',
                  right:
                    fabRightOffsetPct != null &&
                    Number.isFinite(fabRightOffsetPct)
                      ? `calc(${fabRightOffsetPct}% + 1rem)`
                      : 'clamp(5.5rem, 22vw, 17.5rem)',
                  transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)`,
                }
              : {
                  transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)`,
                  bottom: mobileFabBottom,
                  right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
                }
          }
          className={cn(
            'fixed z-[90] touch-none touch-manipulation select-none',
            'inline-flex items-center justify-center gap-2 rounded-full border border-border-default bg-bg-raised font-semibold text-text-primary shadow-overlay transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
            desktopLg ? 'h-11 px-4 text-[14px]' : 'h-12 px-4 text-[14px]',
          )}
        >
          <Sparkles
            className="h-[18px] w-[18px] shrink-0 text-accent-text"
            aria-hidden
          />
          <span>Ask AI</span>
        </button>
      ) : null}

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close global assistant overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[121] cursor-default border-0 bg-black/35"
              onClick={() => !busy && onOpenChange(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="fixed z-[122] w-[min(92vw,380px)] max-lg:right-3 max-lg:left-auto lg:bottom-20 lg:right-6"
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
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-[0_14px_32px_rgba(0,0,0,0.45)]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-success-text">
                      Ask AI
                    </p>
                    <CvAssistantScopeBadge
                      label={pendingScopeLabel}
                      variant={scopeVariant}
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-text-tertiary transition hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
                    disabled={busy}
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {operationsLoading && presetOps.length === 0 ? (
                  <p className="mb-2 flex items-center gap-2 text-[11px] text-text-tertiary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading presets…
                  </p>
                ) : (
                  <div
                    className="mb-2 max-h-40 space-y-1 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
                    data-lenis-prevent-wheel
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                      Quick commands
                    </p>
                    {presetOps.map((op) => (
                      <button
                        key={op.operation}
                        type="button"
                        disabled={busy}
                        onClick={() => applyPreset(op)}
                        className={cn(
                          'flex w-full flex-col rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-50',
                          pendingOperation === op.operation
                            ? 'border-accent-border bg-accent-subtle'
                            : 'border-border-subtle hover:border-accent-border hover:bg-accent-subtle',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-text-primary">
                            {op.label}
                          </span>
                          <CvAssistantScopeBadge
                            label={op.affectedScopeLabel}
                            variant={
                              op.scope === 'findings' ? 'findings' : 'global'
                            }
                            className="shrink-0 normal-case"
                          />
                        </span>
                        {op.description ? (
                          <span className="mt-0.5 text-[10px] leading-snug text-text-tertiary">
                            {op.description}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  ref={commandRef}
                  data-testid="cv-global-assistant-command"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setPendingOperation(undefined);
                    setPendingScopeLabel('Entire CV');
                  }}
                  rows={3}
                  disabled={busy}
                  placeholder="e.g. Standardise all date formats across my CV"
                  className="w-full resize-y rounded-xl border border-border-default bg-bg-sunken px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-border-focus disabled:opacity-60"
                />

                {busy ? (
                  <p className="mt-2 flex items-center gap-2 text-[11px] text-text-tertiary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {inProgressLabel}
                  </p>
                ) : null}

                <Button
                  type="button"
                  className="mt-3 w-full gap-2"
                  disabled={busy || text.trim().length < 8}
                  onClick={async () => {
                    const command = text.trim();
                    if (command.length < 8) return;
                    await onSubmit(command, {
                      operation: pendingOperation,
                    });
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
