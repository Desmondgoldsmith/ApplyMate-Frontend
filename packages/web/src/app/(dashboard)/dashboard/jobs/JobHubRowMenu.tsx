'use client';

import { Archive, BookmarkMinus, MoreVertical, Trash2 } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { archivePayloadForTrackedJob, canRemoveTrackedJobFromHub, type TrackedJob } from './jobHubMerge';
import { cn } from '@/lib/utils';

const MENU_W = 240;

type Props = {
  job: TrackedJob;
  /** Soft archive (recover from Archived jobs). */
  onRequestArchive: (job: TrackedJob) => void;
  /** Remove from active pipeline (same archive API; different confirmation copy). */
  onRequestRemoveFromPipeline: (job: TrackedJob) => void;
  onRequestUnbookmark: (job: TrackedJob) => void;
  disabled?: boolean;
};

export function JobHubRowMenu({
  job,
  onRequestArchive,
  onRequestRemoveFromPipeline,
  onRequestUnbookmark,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnId = useId();
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const canAct = canRemoveTrackedJobFromHub(job);
  const payload = archivePayloadForTrackedJob(job);
  const canArchive = Boolean(payload);
  const listingId = job.boardDiscoveryId?.trim() ?? '';
  const canUnbookmarkOnly = Boolean(listingId) && !canArchive;

  const measureMenu = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    let left = r.right - MENU_W;
    left = Math.max(8, Math.min(left, vw - MENU_W - 8));
    const menuH = menuRef.current?.offsetHeight ?? 120;
    let top = r.bottom + 6;
    if (top + menuH > vh - 8) {
      top = Math.max(8, r.top - menuH - 6);
    }
    setMenuPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    measureMenu();
    const r1 = requestAnimationFrame(() => measureMenu());
    const r2 = requestAnimationFrame(() => {
      requestAnimationFrame(measureMenu);
    });
    window.addEventListener('scroll', measureMenu, true);
    window.addEventListener('resize', measureMenu);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.removeEventListener('scroll', measureMenu, true);
      window.removeEventListener('resize', measureMenu);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!canAct) return null;

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-labelledby={btnId}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: MENU_W,
              zIndex: 100_000,
            }}
            className="rounded-xl border border-white/12 bg-[#0f1414] py-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9)]"
          >
            {canArchive ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-white/85 hover:bg-[#00C9B1]/15"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onRequestArchive(job);
                  }}
                >
                  <Archive className="h-4 w-4 shrink-0 text-[#00C9B1]" aria-hidden />
                  <span className="leading-snug">Archive job</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-white/85 hover:bg-rose-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onRequestRemoveFromPipeline(job);
                  }}
                >
                  <Trash2 className="h-4 w-4 shrink-0 text-rose-300/90" aria-hidden />
                  <span className="leading-snug">Remove from pipeline</span>
                </button>
              </>
            ) : null}
            {canUnbookmarkOnly ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-white/85 hover:bg-white/[0.06]"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onRequestUnbookmark(job);
                }}
              >
                <BookmarkMinus className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                <span className="leading-snug">Remove bookmark</span>
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="shrink-0" onPointerDown={(e) => e.stopPropagation()}>
      <button
        id={btnId}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/55 transition-colors',
          'hover:border-[#00C9B1]/40 hover:text-[#00C9B1] disabled:cursor-not-allowed disabled:opacity-40',
          open && 'border-[#00C9B1]/45 text-[#00C9B1]',
        )}
        aria-label="Job actions"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
