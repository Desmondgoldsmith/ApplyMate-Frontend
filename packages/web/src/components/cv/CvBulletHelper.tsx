'use client';

import { Loader2, Sparkles, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useCVEdit } from '@/components/cv/CVEditContext';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import type { CVBuilderData } from '@/lib/cvBuilder';
/** Same flag InlineField checks so a bullet does not save and close while the helper has focus. */
const TOOLBAR_INTERACTING_FLAG = '__cvToolbarInteracting';
const DOCUMENT_ROOT = '[data-cv-document-root]';
const BULLET_FIELD = '[contenteditable="true"][data-bullet-entry]';
const MIN_BULLET_CHARS = 10;
const PANEL_WIDTH = 420;
const GAP_PX = 6;

function setToolbarInteracting(value: boolean) {
  (window as unknown as Record<string, unknown>)[TOOLBAR_INTERACTING_FLAG] =
    value;
}

function bulletHost(el: EventTarget | null): HTMLElement | null {
  if (!(el instanceof HTMLElement)) return null;
  const host = el.closest(BULLET_FIELD);
  return host instanceof HTMLElement && host.closest(DOCUMENT_ROOT)
    ? host
    : null;
}

/** "Frontend Developer at Hubtel" for the role a bullet belongs to. */
export function bulletRoleContext(
  data: CVBuilderData | undefined,
  entryId: string | undefined,
): string | undefined {
  const item = data?.experience.items.find((x) => x.id === entryId);
  if (!item) return undefined;
  const title = item.title?.trim();
  const company = item.company?.trim();
  if (title && company) return `${title} at ${company}`;
  return title || company || undefined;
}

type Panel =
  | { status: 'too_short' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; suggestions: string[]; question: string | null };

type Box = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Right edge of the CV page, so the button can sit in the margin instead of on the text. */
  pageRight: number;
};

const BUTTON_SIZE = 30;

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const page = el.closest(DOCUMENT_ROOT)?.getBoundingClientRect();
  return {
    top: r.top,
    bottom: r.bottom,
    left: r.left,
    right: r.right,
    pageRight: page?.right ?? r.right,
  };
}

/** In the page margin beside the bullet when it fits, otherwise just under its right end. */
function buttonPlacement(box: Box): { top: number; left: number } {
  const margin = box.pageRight + GAP_PX;
  if (margin + BUTTON_SIZE <= window.innerWidth - 8) {
    return { top: box.top - 4, left: margin };
  }
  return {
    top: box.bottom + GAP_PX,
    left: Math.max(8, box.right - BUTTON_SIZE),
  };
}

/**
 * Small "Improve" button under the experience bullet being edited. It offers up to three better
 * wordings (never with a number the user did not give) and, when the bullet has no number, asks
 * for the real one. Picking a wording types it into the bullet and saves it like normal editing.
 */
export function CvBulletHelper() {
  const ctx = useCVEdit();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [fact, setFact] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const panelOpenRef = useRef(false);
  const requestRef = useRef(0);
  hostRef.current = host;
  panelOpenRef.current = panel !== null;

  const closePanel = useCallback((refocus: boolean) => {
    requestRef.current += 1;
    setPanel(null);
    setFact('');
    setToolbarInteracting(false);
    const current = hostRef.current;
    if (refocus && current?.isConnected) current.focus();
  }, []);

  // Follow the bullet being edited.
  useEffect(() => {
    if (!ctx?.isEditing) return;
    const onFocusIn = (e: FocusEvent) => {
      const next = bulletHost(e.target);
      if (next) {
        if (next !== hostRef.current && panelOpenRef.current) closePanel(false);
        setHost(next);
        setBox(boxOf(next));
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (panelOpenRef.current) return;
        const active = document.activeElement;
        if (bulletHost(active)) return;
        if (rootRef.current?.contains(active)) return;
        setHost(null);
      }, 120);
    };
    let frame = 0;
    // Deferred: a state update inside the input event would re-render the answer box with its
    // old value before React reads the keystroke.
    const onMove = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const current = hostRef.current;
        if (!current) return;
        if (!current.isConnected) {
          if (panelOpenRef.current) closePanel(false);
          setHost(null);
          return;
        }
        setBox(boxOf(current));
      });
    };
    const onBulletInput = (e: Event) => {
      if (e.target === hostRef.current) onMove();
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('input', onBulletInput, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('input', onBulletInput, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      setToolbarInteracting(false);
    };
  }, [closePanel, ctx?.isEditing]);

  // Clicking elsewhere while the panel is open: hand focus back to the bullet first, so the click
  // then closes it the normal way and the text is saved.
  useEffect(() => {
    if (!panel) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      closePanel(!hostRef.current?.contains(e.target as Node));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closePanel, panel]);

  useLayoutEffect(() => {
    if (host) setBox(boxOf(host));
  }, [host, panel]);

  const fetchWordings = useCallback(
    async (answer?: string) => {
      const current = hostRef.current;
      if (!current) return;
      const text = (current.innerText || current.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      setToolbarInteracting(true);
      if (text.length < MIN_BULLET_CHARS) {
        setPanel({ status: 'too_short' });
        return;
      }
      const request = ++requestRef.current;
      setPanel({ status: 'loading' });
      try {
        const result = await api.cv.suggestBulletWordings({
          bullet: text,
          context: bulletRoleContext(ctx?.data, current.dataset.bulletEntry),
          ...(answer?.trim() ? { fact: answer.trim() } : {}),
        });
        if (request !== requestRef.current) return;
        setPanel({ status: 'ready', ...result });
      } catch (e) {
        if (request !== requestRef.current) return;
        setPanel({ status: 'error', message: getApiErrorMessage(e) });
      }
    },
    [ctx?.data],
  );

  const applyWording = (wording: string) => {
    const current = hostRef.current;
    closePanel(false);
    if (!current?.isConnected) return;
    current.focus();
    current.textContent = wording;
    current.dispatchEvent(new Event('input', { bubbles: true }));
    // Leaving the field saves it, exactly as if the user had typed the text and clicked away.
    current.blur();
  };

  if (!ctx?.isEditing || !host || !box || typeof document === 'undefined') {
    return null;
  }

  const panelLeft = Math.max(
    8,
    Math.min(box.left, window.innerWidth - PANEL_WIDTH - 8),
  );

  return createPortal(
    <div ref={rootRef} data-cv-bullet-helper="">
      {panel ? (
        <div
          role="dialog"
          aria-label="Better wordings for this bullet"
          className="fixed z-[1200] rounded-xl border border-border-subtle bg-bg-surface p-3 shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
          style={{
            top: box.bottom + GAP_PX,
            left: panelLeft,
            width: Math.min(PANEL_WIDTH, window.innerWidth - 16),
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
              <Sparkles className="h-3.5 w-3.5 text-accent-text" aria-hidden />
              Better wordings
            </p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => closePanel(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {panel.status === 'too_short' ? (
            <p className="text-[13px] text-text-secondary">
              Write a few words about what you did first, like &ldquo;fixed
              checkout bugs&rdquo;, then ask again.
            </p>
          ) : null}

          {panel.status === 'loading' ? (
            <p className="flex items-center gap-2 text-[13px] text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Writing better versions…
            </p>
          ) : null}

          {panel.status === 'error' ? (
            <p role="alert" className="text-[13px] text-danger-text">
              {panel.message}
            </p>
          ) : null}

          {panel.status === 'ready' ? (
            <>
              {panel.suggestions.length === 0 ? (
                <p className="text-[13px] text-text-secondary">
                  {panel.question
                    ? 'No better wording without a real number. Answer the question below and we will rewrite it.'
                    : 'This bullet is already strong. We could not make it better without adding facts you have not given.'}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {panel.suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => applyWording(s)}
                        className="group flex w-full items-start gap-2 rounded-lg border border-border-subtle px-2.5 py-2 text-left text-[13px] leading-snug text-text-primary transition-colors hover:border-accent-border hover:bg-accent-subtle"
                      >
                        <span className="flex-1">{s}</span>
                        <span className="shrink-0 text-[12px] font-semibold text-accent-text">
                          Use
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {panel.question ? (
                <form
                  className="mt-3 border-t border-border-subtle pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (fact.trim()) void fetchWordings(fact);
                  }}
                >
                  <label
                    htmlFor="cv-bullet-helper-fact"
                    className="block text-[13px] font-medium text-text-primary"
                  >
                    {panel.question}
                  </label>
                  <p className="text-[12px] text-text-tertiary">
                    A real number makes this bullet much stronger. We only use
                    what you type.
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="cv-bullet-helper-fact"
                      value={fact}
                      onChange={(e) => setFact(e.target.value)}
                      maxLength={200}
                      placeholder="e.g. about 3,000 users"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border-default bg-bg-surface px-2.5 text-[13px] text-text-primary outline-none focus:border-border-focus"
                    />
                    <button
                      type="submit"
                      disabled={!fact.trim()}
                      className="h-9 shrink-0 rounded-lg bg-accent-solid px-3 text-[13px] font-semibold text-text-on-accent disabled:opacity-50"
                    >
                      Rewrite
                    </button>
                  </div>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Improve this bullet"
          title="Improve this bullet"
          // Keep the bullet focused, so its text stays in edit mode.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void fetchWordings()}
          className="fixed z-[1100] inline-flex items-center justify-center rounded-full border border-accent-border bg-bg-surface text-accent-text shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition-colors hover:bg-accent-subtle"
          style={{
            ...buttonPlacement(box),
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
          }}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>,
    document.body,
  );
}
