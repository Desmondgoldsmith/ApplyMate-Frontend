'use client';

import { Bold, Italic, Link2, Underline } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { normalizeEditableHtml, toDisplayRichHtml } from '@/lib/cvRichTextCore';
import { cn } from '@/lib/utils';

function normalizedUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const BuilderRichTextField = memo(function BuilderRichTextField({
  value,
  onChange,
  placeholder,
  className,
  minHeightClass = 'min-h-[72px]',
  onFocus,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
  onFocus?: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('https://');
  const [hasAnchor, setHasAnchor] = useState(false);
  const lastRangeRef = useRef<Range | null>(null);

  const syncAnchorState = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setHasAnchor(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    setHasAnchor(Boolean(el?.closest('a[href]')));
    if (el?.closest('[contenteditable="true"]') === editorRef.current) {
      lastRangeRef.current = range.cloneRange();
    }
  }, []);

  /**
   * Capture the user's live highlight at the exact moment a toolbar button is pressed.
   * Runs on `mousedown` (before focus moves / the click side-effects collapse the
   * selection), so the formatting/link commands always see the real range — this
   * is what fixes the false "highlight the text first" alert.
   */
  const captureSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const el = editorRef.current;
    if (el && el.contains(range.commonAncestorContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  }, []);

  const onToolbarMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      captureSelection();
    },
    [captureSelection],
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el || document.activeElement === el) return;
    const html = toDisplayRichHtml(value || '');
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  useEffect(() => {
    document.addEventListener('selectionchange', syncAnchorState);
    return () =>
      document.removeEventListener('selectionchange', syncAnchorState);
  }, [syncAnchorState]);

  const commit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    onChange(normalizeEditableHtml(el.innerHTML));
  }, [onChange]);

  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return null;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return null;
    const range =
      sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
        ? sel.getRangeAt(0)
        : lastRangeRef.current;
    if (!range || range.collapsed) return null;
    if (!el.contains(range.commonAncestorContainer)) return null;
    sel.removeAllRanges();
    sel.addRange(range.cloneRange());
    return sel.getRangeAt(0);
  };

  const runCommand = (command: string, value?: string) => {
    const range = restoreSelection();
    if (!range) return false;
    const ok = document.execCommand(command, false, value);
    commit();
    return ok;
  };

  const wrapSelection = (command: 'bold' | 'italic' | 'underline') => {
    if (!runCommand(command)) {
      window.alert('Highlight the text you want to format first.');
    }
  };

  const applyLink = () => {
    const href = normalizedUrl(linkDraft);
    if (!href) {
      window.alert('Enter a valid http(s) URL.');
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    const range = restoreSelection();
    if (!range || range.collapsed) {
      window.alert('Highlight the text you want to link first.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.appendChild(range.extractContents());
    range.insertNode(anchor);
    commit();
    setShowLink(false);
  };

  const removeLink = () => {
    const sel = window.getSelection();
    const range =
      sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : lastRangeRef.current;
    if (!range) return;
    const node = range.commonAncestorContainer;
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    const anchor = el?.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const text = anchor.textContent ?? '';
    anchor.replaceWith(document.createTextNode(text));
    commit();
    setShowLink(false);
    setHasAnchor(false);
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#0a0e0e] px-1.5 py-1">
        <button
          type="button"
          title="Bold"
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          onMouseDown={onToolbarMouseDown}
          onClick={() => wrapSelection('bold')}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Italic"
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          onMouseDown={onToolbarMouseDown}
          onClick={() => wrapSelection('italic')}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Underline"
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          onMouseDown={onToolbarMouseDown}
          onClick={() => wrapSelection('underline')}
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Insert link"
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          onMouseDown={onToolbarMouseDown}
          onClick={() => {
            syncAnchorState();
            setShowLink((v) => !v);
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        {hasAnchor ? (
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/10"
            onMouseDown={(e) => e.preventDefault()}
            onClick={removeLink}
          >
            Unlink
          </button>
        ) : null}
      </div>
      {showLink ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder="https://example.com"
            className="h-8 min-w-0 flex-1 rounded-md border border-white/15 bg-[#111616] px-2 text-xs text-white outline-none focus:border-[#00C9B1]"
          />
          <button
            type="button"
            className="text-xs font-semibold text-[#00C9B1]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyLink}
          >
            Apply link
          </button>
          <button
            type="button"
            className="text-xs text-white/45"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowLink(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
      <div
        ref={editorRef}
        role="textbox"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={cn(
          'rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0c1010] px-3 py-2 text-sm max-lg:text-base text-white outline-none',
          'empty:before:pointer-events-none empty:before:text-white/30 empty:before:content-[attr(data-placeholder)]',
          '[&_a]:text-[#00C9B1] [&_a]:underline',
          minHeightClass,
        )}
        onFocus={() => {
          onFocus?.();
          const el = editorRef.current;
          if (el && !el.innerHTML.trim()) {
            el.innerHTML = toDisplayRichHtml(value || '');
          }
        }}
        onInput={() => syncAnchorState()}
        onBlur={commit}
      />
    </div>
  );
});
