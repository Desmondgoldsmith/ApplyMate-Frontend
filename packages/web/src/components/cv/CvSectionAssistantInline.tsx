'use client';

import { Bot, Loader2, Smile, Sparkles, Wand2, X } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useCVEdit } from '@/components/cv/CVEditContext';
import { useCvOverlayZIndex } from '@/components/cv/CvOverlayLayerContext';
import { CvAssistantScopeBadge } from '@/components/cv/CvAssistantScopeBadge';
import { Button } from '@/components/ui/Button';
import { cvSectionAssistantPopoverTitle } from '@/lib/cvSectionAssistantBranding';
import { getCvSectionAssistantSuggestions } from '@/lib/cvSectionAssistantSuggestions';
import { cn } from '@/lib/utils';

const POPOVER_W = 248;
const GAP = 8;

type CvSectionAssistantInlineProps = {
  sectionId: string;
};

export function CvSectionAssistantInline({ sectionId }: CvSectionAssistantInlineProps) {
  const ctx = useCVEdit();
  const overlayZ = useCvOverlayZIndex();
  const pinWrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const titleId = useId();

  const run = ctx?.runCvAssistantCommand;
  const busy = ctx?.cvAssistantBusy === true;
  const busyMessage = ctx?.cvAssistantBusyMessage ?? null;

  const bundle = ctx?.data ? getCvSectionAssistantSuggestions(sectionId, ctx.data) : { suggestions: [] };
  const sectionTitle = cvSectionAssistantPopoverTitle(sectionId, ctx?.data);

  useLayoutEffect(() => {
    // Portal to <body> (not the CV paper root) so the popover escapes the paper's
    // stacking context and layers above the sticky options/templates bar.
    setPortalHost(document.body);
  }, []);

  const syncPopoverPosition = useCallback(() => {
    const pin = pinWrapRef.current;
    const pop = popoverRef.current;
    if (!pin) return;

    // Anchor to the (always-visible) trigger pin and clamp to the viewport, so the
    // popover never lands at the bottom of a long section out of view.
    const pr = pin.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = Math.min(POPOVER_W, Math.max(200, vw - GAP * 2));
    const ph = pop?.offsetHeight ?? 280;

    let top = pr.bottom + GAP;
    if (top + ph > vh - GAP) {
      const above = pr.top - ph - GAP;
      top = above >= GAP ? above : Math.max(GAP, vh - ph - GAP);
    }
    // Final clamp guarantees the popover stays fully within the viewport.
    top = Math.max(GAP, Math.min(top, vh - ph - GAP));

    let left = pr.right - pw;
    left = Math.max(GAP, Math.min(left, vw - pw - GAP));

    setPopoverPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    // Bring the trigger into view first, then position the popover beside it.
    pinWrapRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    syncPopoverPosition();
    const pop = popoverRef.current;
    const ro = pop ? new ResizeObserver(() => syncPopoverPosition()) : null;
    if (pop && ro) ro.observe(pop);

    const onScroll = () => syncPopoverPosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);

    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, syncPopoverPosition, text, bundle.hint, bundle.suggestions.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pinWrapRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    setText('');
    setOpen(false);
  }, [sectionId]);

  const onRun = useCallback(async () => {
    if (!run) return;
    const command = text.trim();
    if (command.length < 8) return;
    try {
      const result = await run(command, undefined, sectionId);
      if (result === 'ok') {
        setOpen(false);
      }
    } catch {
      /* parent toasts errors */
    }
  }, [run, text, sectionId]);

  if (!run) return null;

  const popover = (
    <div
      ref={popoverRef}
      id={titleId}
      role="dialog"
      aria-label={sectionTitle}
      className="fixed w-[min(248px,calc(100vw-24px))] max-h-[min(420px,52vh)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-2.5 text-slate-800 shadow-[0_12px_40px_rgba(15,23,42,0.22)]"
      style={{ top: popoverPos.top, left: popoverPos.left, zIndex: overlayZ + 5 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00C9B1]" />
          <p className="text-[10px] font-semibold tracking-tight text-slate-700">
            {sectionTitle}
          </p>
          <CvAssistantScopeBadge
            label="This section"
            variant="section"
            className="normal-case"
          />
        </div>
        <button
          type="button"
          className="rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {bundle.hint ? (
        <p className="mb-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2 py-1.5 text-[10px] leading-snug text-amber-950">
          {bundle.hint}
        </p>
      ) : null}

      <ul className="mb-2 space-y-1">
        {bundle.suggestions.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setText(s.prompt)}
              className="flex w-full items-start gap-2 rounded-lg border border-transparent px-1.5 py-1 text-left text-[11px] leading-snug text-slate-700 transition hover:border-[#00C9B1]/25 hover:bg-[#00C9B1]/08"
            >
              <span className="mt-0.5 shrink-0 text-[#00C9B1]">
                {i % 3 === 0 ? (
                  <Wand2 className="h-3.5 w-3.5" />
                ) : i % 3 === 1 ? (
                  <Smile className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1 font-medium">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="relative mb-2 text-center text-[10px] text-slate-400 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-slate-200 before:content-['']">
        <span className="relative bg-white px-2">or</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Enter a custom request…"
        className="mb-2 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-[11px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#00C9B1]/50 focus:ring-2 focus:ring-[#00C9B1]/25"
      />

      {busy && busyMessage ? (
        <p className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          {busyMessage}
        </p>
      ) : null}

      <Button
        type="button"
        className="h-8 w-full gap-1.5 text-[11px]"
        disabled={busy || text.trim().length < 8}
        onClick={() => void onRun()}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        Run command
      </Button>
    </div>
  );

  return (
    <>
      <div ref={pinWrapRef} className="pointer-events-auto absolute right-2 top-2 z-[1002]">
        <button
          type="button"
          title={sectionTitle}
          aria-expanded={open}
          aria-controls={open ? titleId : undefined}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen((v) => !v);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-white',
            'bg-[#00C9B1] text-white shadow-[0_2px_10px_rgba(0,0,0,0.22)] ring-2 ring-[#007a7b]/35',
            'transition-shadow hover:shadow-[0_3px_14px_rgba(0,0,0,0.28)] hover:ring-[#005f60]/45',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C9B1]',
            'animate-cv-assistant-pin',
          )}
        >
          <Bot className="relative z-[1] h-[17px] w-[17px]" strokeWidth={2.25} />
        </button>
      </div>

      {portalHost && open ? createPortal(popover, portalHost) : null}
    </>
  );
}
