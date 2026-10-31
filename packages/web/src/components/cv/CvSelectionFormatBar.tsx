'use client';

import { Bold, Check, Italic, Link2, Underline, Unlink, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

/** Same flag InlineField checks so a field does not save and close while the link box has focus. */
const TOOLBAR_INTERACTING_FLAG = '__cvToolbarInteracting';
const DOCUMENT_ROOT = '[data-cv-document-root]';
const BAR_GAP_PX = 8;

type Format = 'bold' | 'italic' | 'underline';

type Selected = {
  host: HTMLElement;
  range: Range;
  rect: { top: number; bottom: number; left: number; width: number };
  active: Record<Format, boolean>;
  link: HTMLAnchorElement | null;
};

function setToolbarInteracting(value: boolean) {
  (window as unknown as Record<string, unknown>)[TOOLBAR_INTERACTING_FLAG] =
    value;
}

function editableHost(node: Node | null): HTMLElement | null {
  const el =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node?.parentElement ?? null);
  const host = el?.closest('[contenteditable="true"]');
  return host instanceof HTMLElement && host.closest(DOCUMENT_ROOT)
    ? host
    : null;
}

function linkInRange(range: Range): HTMLAnchorElement | null {
  const node = range.commonAncestorContainer;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  const link = el?.closest('a[href]') ?? el?.querySelector('a[href]') ?? null;
  return link instanceof HTMLAnchorElement ? link : null;
}

/** `https://` URL from what the user typed, or null when it is not a web address. */
export function normalizeLinkUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (!/^https?:$/i.test(url.protocol) || !url.hostname.includes('.')) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function readSelection(): Selected | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const host = editableHost(range.startContainer);
  if (!host || editableHost(range.endContainer) !== host) return null;
  const box = range.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return {
    host,
    range: range.cloneRange(),
    rect: {
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      width: box.width,
    },
    active: {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    },
    link: linkInRange(range),
  };
}

function restoreSelection(selected: Selected) {
  selected.host.focus();
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(selected.range);
}

function BarButton({
  label,
  active = false,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the text selected and the field focused.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors',
        active ? 'bg-white/25' : 'hover:bg-white/15',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Floating bar over highlighted CV text: bold, italic, underline and links, like a word
 * processor. Ctrl/Cmd+B, I and U work as usual; Ctrl/Cmd+K adds a link.
 */
export function CvSelectionFormatBar() {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [placement, setPlacement] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const linkOpenRef = useRef(false);
  const selectedRef = useRef<Selected | null>(null);
  selectedRef.current = selected;

  const closeLink = useCallback((refocus: boolean) => {
    const current = selectedRef.current;
    linkOpenRef.current = false;
    setLinkOpen(false);
    setLinkError(false);
    setToolbarInteracting(false);
    if (refocus && current?.host.isConnected) restoreSelection(current);
  }, []);

  const openLink = useCallback(() => {
    const current = selectedRef.current ?? readSelection();
    if (!current) return;
    setSelected(current);
    setLinkDraft(current.link?.getAttribute('href') ?? '');
    setLinkError(false);
    setToolbarInteracting(true);
    linkOpenRef.current = true;
    setLinkOpen(true);
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      if (linkOpenRef.current) {
        // The field closed while the link box was open: never leave the busy flag set.
        if (selectedRef.current?.host.isConnected) return;
        closeLink(false);
      }
      setSelected(readSelection());
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
      if (!readSelection()) return;
      e.preventDefault();
      openLink();
    };
    const onViewportChange = () => {
      if (linkOpenRef.current) {
        const current = selectedRef.current;
        if (!current?.host.isConnected) {
          closeLink(false);
          setSelected(null);
          return;
        }
        const box = current.range.getBoundingClientRect();
        setSelected({
          ...current,
          rect: {
            top: box.top,
            bottom: box.bottom,
            left: box.left,
            width: box.width,
          },
        });
        return;
      }
      setSelected(readSelection());
    };
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      setToolbarInteracting(false);
    };
  }, [closeLink, openLink]);

  // Clicking elsewhere while the link box is open: put focus back on the field first, so the
  // click then closes the field the normal way and the text is saved.
  useEffect(() => {
    if (!linkOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      closeLink(true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [closeLink, linkOpen]);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!selected || !bar) {
      setPlacement(null);
      return;
    }
    const { width, height } = bar.getBoundingClientRect();
    // Phones show their own copy/paste menu above the selection, so go below there.
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const above = selected.rect.top - BAR_GAP_PX - height;
    const below = selected.rect.bottom + BAR_GAP_PX;
    const top = !coarse && above >= 8 ? above : below;
    const centre = selected.rect.left + selected.rect.width / 2;
    const left = Math.max(
      8,
      Math.min(centre - width / 2, window.innerWidth - width - 8),
    );
    setPlacement({ top, left });
  }, [selected, linkOpen]);

  const applyFormat = (kind: Format) => {
    document.execCommand(kind);
    setSelected(readSelection());
  };

  const applyLink = () => {
    const current = selectedRef.current;
    const href = normalizeLinkUrl(linkDraft);
    if (!href) {
      setLinkError(true);
      return;
    }
    if (!current?.host.isConnected) {
      closeLink(false);
      return;
    }
    restoreSelection(current);
    if (current.link && current.host.contains(current.link)) {
      current.link.setAttribute('href', href);
      current.host.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('createLink', false, href);
    }
    closeLink(false);
    setSelected(readSelection());
  };

  const removeLink = () => {
    const current = selectedRef.current;
    if (!current) return;
    if (linkOpenRef.current) closeLink(true);
    const link = current.link;
    if (link && current.host.contains(link)) {
      link.replaceWith(...Array.from(link.childNodes));
      current.host.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('unlink');
    }
    setSelected(readSelection());
  };

  if (!selected || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Text style"
      data-cv-selection-format-bar=""
      className="fixed z-[1200] flex items-center gap-0.5 rounded-xl bg-[#111827] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
      style={{
        top: placement?.top ?? -9999,
        left: placement?.left ?? -9999,
      }}
    >
      {linkOpen ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            type="text"
            inputMode="url"
            aria-label="Link address"
            aria-invalid={linkError}
            placeholder="Paste a link, e.g. linkedin.com/in/you"
            value={linkDraft}
            onChange={(e) => {
              setLinkDraft(e.target.value);
              setLinkError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                closeLink(true);
              }
            }}
            className={cn(
              'h-9 w-[240px] rounded-lg border bg-white px-2.5 text-[14px] text-[#111827] outline-none placeholder:text-[#6B7280]',
              linkError ? 'border-[#F04438]' : 'border-transparent',
            )}
          />
          <BarButton label="Add link" onPress={applyLink}>
            <Check className="h-4 w-4" />
          </BarButton>
          <BarButton label="Cancel" onPress={() => closeLink(true)}>
            <X className="h-4 w-4" />
          </BarButton>
          {linkError ? (
            <span
              role="alert"
              className="absolute left-1 top-full mt-1 rounded-md bg-[#111827] px-2 py-1 text-[12px] text-white"
            >
              That doesn&apos;t look like a web address.
            </span>
          ) : null}
        </form>
      ) : (
        <>
          <BarButton
            label="Bold (Ctrl+B)"
            active={selected.active.bold}
            onPress={() => applyFormat('bold')}
          >
            <Bold className="h-4 w-4" />
          </BarButton>
          <BarButton
            label="Italic (Ctrl+I)"
            active={selected.active.italic}
            onPress={() => applyFormat('italic')}
          >
            <Italic className="h-4 w-4" />
          </BarButton>
          <BarButton
            label="Underline (Ctrl+U)"
            active={selected.active.underline}
            onPress={() => applyFormat('underline')}
          >
            <Underline className="h-4 w-4" />
          </BarButton>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-white/20" />
          <BarButton
            label={selected.link ? 'Edit link (Ctrl+K)' : 'Add link (Ctrl+K)'}
            active={Boolean(selected.link)}
            onPress={openLink}
          >
            <Link2 className="h-4 w-4" />
          </BarButton>
          {selected.link ? (
            <BarButton label="Remove link" onPress={removeLink}>
              <Unlink className="h-4 w-4" />
            </BarButton>
          ) : null}
        </>
      )}
    </div>,
    document.body,
  );
}
