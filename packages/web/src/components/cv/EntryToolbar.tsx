'use client';

import { Bold, Calendar, ChevronDown, ChevronUp, Italic, Link2, Settings, Trash2, Type, Underline } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useCvOverlayZIndex } from '@/components/cv/CvOverlayLayerContext';
import { CvEntryDateRangePopover } from '@/components/cv/CvEntryDateRangePopover';
const TOOLBAR_INTERACTING_FLAG = '__cvToolbarInteracting';

function setToolbarInteracting(value: boolean) {
  (window as unknown as Record<string, unknown>)[TOOLBAR_INTERACTING_FLAG] = value;
}

type EntryToolbarProps = {
  sectionType: string;
  /** DOM `data-cv-section` id for toolbar placement (defaults to `sectionType`). */
  anchorSectionId?: string;
  onAddEntry: () => void;
  onAddBullet?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDatePick?: (start: string, end: string) => void;
  /** Current stored dates for the focused entry (required for picker + preview sync). */
  dateStart?: string;
  dateEnd?: string;
  onAddSecondaryEntry?: () => void;
  showMoveUp: boolean;
  showMoveDown: boolean;
  showDatePicker?: boolean;
  dateMode?: 'range' | 'single';
  showAddBullet?: boolean;
  addEntryLabel?: string;
  addSecondaryEntryLabel?: string;
  position?: 'above' | 'below';
  /** Pin toolbar above the section header instead of overlapping the focused entry. */
  pinToSectionHeader?: boolean;
  hideAddButton?: boolean;
  /** When true, the trash/delete button is omitted entirely (used for core sections that can't be deleted). */
  hideDelete?: boolean;
  settingsOptions?: Array<{
    key: string;
    label: string;
    enabled: boolean;
    onToggle: (next: boolean) => void;
  }>;
};

export function EntryToolbar({
  sectionType,
  anchorSectionId,
  onAddEntry,
  onAddBullet,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDatePick,
  dateStart = '',
  dateEnd = '',
  onAddSecondaryEntry,
  showMoveUp,
  showMoveDown,
  showDatePicker,
  dateMode = 'range',
  showAddBullet = false,
  addEntryLabel = '+ Entry',
  addSecondaryEntryLabel,
  position = 'above',
  pinToSectionHeader = true,
  hideAddButton = false,
  hideDelete = false,
  settingsOptions = [],
}: EntryToolbarProps) {
  const toolbarAnchorId = anchorSectionId ?? sectionType;
  const overlayZ = useCvOverlayZIndex();
  const rootRef = useRef<HTMLDivElement>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ left: number; top: number; bottom: number }>({ left: 0, top: 0, bottom: 0 });
  const [showDate, setShowDate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTextTools, setShowTextTools] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkDraft, setLinkDraft] = useState('https://');
  const [anchorHref, setAnchorHref] = useState<string | null>(null);
  const [forceBelow, setForceBelow] = useState(false);
  const lastSelectionRef = useRef<{
    el: HTMLInputElement | HTMLTextAreaElement | null;
    start: number;
    end: number;
  }>({ el: null, start: 0, end: 0 });
  const lastContentEditableRangeRef = useRef<Range | null>(null);
  const hasDatePickerByType =
    ['experience', 'education', 'certifications', 'achievements', 'projects'].includes(sectionType) ||
    sectionType.startsWith('custom_');
  const canShowDate = Boolean(showDatePicker && hasDatePickerByType && onDatePick);
  const canShowSettings = settingsOptions.length > 0;
  const effectivePanelPosition = useMemo(
    () => (position === 'above' && forceBelow ? 'below' : position),
    [forceBelow, position],
  );
  const panelPositionClass = 'fixed';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pinToSectionHeader || typeof document === 'undefined') {
      setHeaderSlot(null);
      return;
    }
    const slot = document.querySelector(
      `[data-cv-section="${toolbarAnchorId}"] [data-cv-entry-toolbar-slot]`,
    );
    setHeaderSlot(slot instanceof HTMLElement ? slot : null);
  }, [pinToSectionHeader, toolbarAnchorId, mounted]);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
      // Only remember real highlights; a collapsed caret must not clobber the saved range.
      if (element?.closest('[contenteditable="true"]') && !range.collapsed) {
        lastContentEditableRangeRef.current = range.cloneRange();
      }
      const anchor = element?.closest('a[href]');
      setAnchorHref(anchor?.getAttribute('href')?.trim() || null);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  useEffect(() => {
    if (position !== 'above') {
      setForceBelow(false);
      return;
    }
    const measure = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setForceBelow(rect.top < 120);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [position]);

  useEffect(() => {
    if (!mounted) return;
    if (!showTextTools && !showDate && !showSettings && !confirmDelete) return;
    const sync = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchorRect({ left: rect.left, top: rect.top, bottom: rect.bottom });
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [confirmDelete, mounted, showDate, showSettings, showTextTools]);

  const panelStyle = (width: number): CSSProperties => ({
    zIndex: overlayZ,
    left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - width - 8)),
    top: effectivePanelPosition === 'above' ? Math.max(8, anchorRect.top - 10) : Math.min(window.innerHeight - 8, anchorRect.bottom + 8),
    transform: effectivePanelPosition === 'above' ? 'translateY(-100%)' : undefined,
  });

  const captureSelection = () => {
    const active = document.activeElement;
    // Ignore the toolbar's own URL input so it never becomes the format target.
    if (
      (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
      active.dataset.cvToolbarLinkInput !== 'true'
    ) {
      lastSelectionRef.current = {
        el: active,
        start: active.selectionStart ?? 0,
        end: active.selectionEnd ?? 0,
      };
      // An input/textarea is now the target — drop any stale contentEditable range.
      lastContentEditableRangeRef.current = null;
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Never overwrite a good saved highlight with a collapsed (caret-only) range —
      // doing so caused the false "please highlight the text" alert.
      if (range.collapsed) return;
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
      if (element?.closest('[contenteditable="true"]')) {
        lastContentEditableRangeRef.current = range.cloneRange();
        // A contentEditable field is now the target — drop any stale input selection.
        lastSelectionRef.current = { el: null, start: 0, end: 0 };
      }
    }
  };

  const onToolbarActionMouseDown = () => {
    setToolbarInteracting(true);
    captureSelection();
  };

  const onToolbarActionMouseUp = () => {
    setTimeout(() => setToolbarInteracting(false), 0);
  };

  const applyTextFormat = (kind: 'bold' | 'italic' | 'underline') => {
    captureSelection();
    const active = document.activeElement;
    const selectedEl = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : lastSelectionRef.current.el;
    if (!(selectedEl instanceof HTMLInputElement || selectedEl instanceof HTMLTextAreaElement)) {
      applyContentEditableFormat(kind);
      return;
    }
    const liveStart = selectedEl.selectionStart ?? 0;
    const liveEnd = selectedEl.selectionEnd ?? 0;
    const canUseSavedRange = lastSelectionRef.current.el === selectedEl && lastSelectionRef.current.end > lastSelectionRef.current.start;
    const start = liveEnd > liveStart ? liveStart : canUseSavedRange ? lastSelectionRef.current.start : liveStart;
    const end = liveEnd > liveStart ? liveEnd : canUseSavedRange ? lastSelectionRef.current.end : liveEnd;
    if (start === end) {
      window.alert('Please highlight the text you want to format.');
      return;
    }
    const raw = selectedEl.value;
    const selected = raw.slice(start, end);
    const wrapped =
      kind === 'bold'
        ? `<strong>${selected}</strong>`
        : kind === 'italic'
          ? `<em>${selected}</em>`
          : `<u>${selected}</u>`;
    const next = `${raw.slice(0, start)}${wrapped}${raw.slice(end)}`;
    selectedEl.value = next;
    selectedEl.dispatchEvent(new Event('input', { bubbles: true }));
    lastSelectionRef.current = { el: selectedEl, start: start + wrapped.length, end: start + wrapped.length };
    setShowTextTools(false);
    return;
  };

  const applyContentEditableFormat = (kind: 'bold' | 'italic' | 'underline') => {
    const sel = window.getSelection();
    const range =
      sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
        ? sel.getRangeAt(0)
        : lastContentEditableRangeRef.current;
    if (!range || range.collapsed) {
      window.alert('Please highlight the text you want to format.');
      return;
    }
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
    if (!element?.closest('[contenteditable="true"]')) {
      window.alert('Please click into a text field and highlight text first.');
      return;
    }
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range.cloneRange());
    document.execCommand(kind);
    const host = element.closest('[contenteditable="true"]');
    if (host instanceof HTMLElement) {
      host.dispatchEvent(new Event('input', { bubbles: true }));
      host.focus();
    }
    setShowTextTools(false);
  };

  const normalizedUrl = (raw: string): string | null => {
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
  };

  const removeLink = () => {
    const sel = window.getSelection();
    // Prefer the saved highlight; a live caret may have collapsed off the link
    // after the toolbar button took focus.
    const range =
      sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
        ? sel.getRangeAt(0)
        : lastContentEditableRangeRef.current;
    if (!range) {
      window.alert('Highlight the linked text first, then choose Unlink.');
      return;
    }
    const node = range.commonAncestorContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    // The selection may wrap (not be inside) the anchor — search descendants too.
    const anchor =
      element?.closest('a[href]') ??
      element?.querySelector('a[href]') ??
      null;
    const host = anchor?.closest('[contenteditable="true"]');
    if (!(anchor instanceof HTMLAnchorElement) || !(host instanceof HTMLElement)) {
      window.alert('Highlight the linked text first, then choose Unlink.');
      return;
    }
    const text = anchor.textContent ?? '';
    const replacement = document.createTextNode(text);
    anchor.replaceWith(replacement);
    host.dispatchEvent(new Event('input', { bubbles: true }));
    host.focus();
    setShowLinkInput(false);
    setLinkDraft('https://');
  };

  const applyLink = () => {
    const href = normalizedUrl(linkDraft);
    if (!href) {
      window.alert('Please enter a valid URL (http/https).');
      return;
    }
    // Use the field selection captured when the toolbar was pressed. We must not
    // read document.activeElement here: focus is on the toolbar's own URL input
    // or the OK button, which would otherwise hijack the link target.
    const savedInput = lastSelectionRef.current;
    if (
      (savedInput.el instanceof HTMLInputElement ||
        savedInput.el instanceof HTMLTextAreaElement) &&
      savedInput.end > savedInput.start &&
      document.body.contains(savedInput.el)
    ) {
      const el = savedInput.el;
      const { start, end } = savedInput;
      const raw = el.value;
      const selected = raw.slice(start, end);
      const wrapped = `<a href="${href}" target="_blank" rel="noreferrer">${selected}</a>`;
      el.value = `${raw.slice(0, start)}${wrapped}${raw.slice(end)}`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      setShowLinkInput(false);
      setShowTextTools(false);
      setLinkDraft('https://');
      return;
    }
    const range = lastContentEditableRangeRef.current;
    if (!range || range.collapsed) {
      window.alert('Please highlight the text you want to link.');
      return;
    }
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
    const host = element?.closest('[contenteditable="true"]');
    if (!(host instanceof HTMLElement)) {
      window.alert('Please highlight text inside an editable field first.');
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range.cloneRange());
    const safeRange = selection.getRangeAt(0);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.style.color = '#1D4ED8';
    anchor.style.textDecoration = 'underline';
    anchor.appendChild(safeRange.extractContents());
    safeRange.insertNode(anchor);
    host.dispatchEvent(new Event('input', { bubbles: true }));
    host.focus();
    setShowLinkInput(false);
    setShowTextTools(false);
    setLinkDraft('https://');
  };

  const selectedAnchorHref = (): string | null => {
    const sel = window.getSelection();
    const range =
      sel && sel.rangeCount > 0
        ? sel.getRangeAt(0)
        : lastContentEditableRangeRef.current;
    if (!range) return null;
    const node = range.commonAncestorContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const anchor = element?.closest('a[href]');
    return anchor?.getAttribute('href')?.trim() || null;
  };

  const toolbarBar = (
    <div
      ref={rootRef}
      className={
        headerSlot
          ? 'flex w-full max-w-full items-center'
          : `absolute left-0 z-[1000] ${position === 'above' ? '-top-11' : 'top-full mt-2'}`
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex max-w-full flex-nowrap items-center rounded-full border border-white/10 bg-white shadow-xl">
        {!hideAddButton && addSecondaryEntryLabel && onAddSecondaryEntry ? (
          <>
            <button
              type="button"
              onClick={onAddEntry}
              title={addEntryLabel}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-l-full bg-[#00C9B1] px-3 py-1.5 text-sm font-semibold text-white"
            >
              {addEntryLabel}
            </button>
            <button
              type="button"
              onClick={onAddSecondaryEntry}
              title={addSecondaryEntryLabel}
              className="bg-[#4F46E5] px-3 py-1.5 text-sm font-semibold text-white"
            >
              {addSecondaryEntryLabel}
            </button>
          </>
        ) : !hideAddButton ? (
          <button
            type="button"
            onClick={onAddEntry}
            title={addEntryLabel}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-l-full bg-[#00C9B1] px-3 py-1.5 text-sm font-semibold leading-none text-white"
          >
            {addEntryLabel}
          </button>
        ) : (
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-l-full bg-[#00C9B1] px-2 py-1.5 text-[10px] font-semibold leading-none text-white">
            Edit
          </span>
        )}
        <button type="button" title="Move up" disabled={!showMoveUp} onClick={onMoveUp} className="px-2 py-1.5 text-black/70 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
        <button type="button" title="Move down" disabled={!showMoveDown} onClick={onMoveDown} className="px-2 py-1.5 text-black/70 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
        <button
          type="button"
          title="Text formatting"
          onMouseDown={onToolbarActionMouseDown}
          onMouseUp={onToolbarActionMouseUp}
          onClick={() => setShowTextTools((v) => !v)}
          className="px-2 py-1.5 text-black/70"
        >
          <Type className="h-4 w-4" />
        </button>
        {showAddBullet ? (
          <button
            type="button"
            onClick={onAddBullet}
            title="Add bullet"
            className="px-2 py-1.5 text-black/70"
          >
            • +
          </button>
        ) : null}
        {canShowDate ? (
          <button type="button" title="Pick date" onClick={() => setShowDate((v) => !v)} className="px-2 py-1.5 text-black/70"><Calendar className="h-4 w-4" /></button>
        ) : null}
        {!hideDelete ? (
          <button type="button" title="Delete" onClick={() => setConfirmDelete(true)} className="px-2 py-1.5 text-black/70"><Trash2 className="h-4 w-4" /></button>
        ) : null}
        <button type="button" title="Settings" disabled={!canShowSettings} onClick={() => setShowSettings((v) => !v)} className="rounded-r-full px-2 py-1.5 text-black/70 disabled:opacity-30"><Settings className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <>
      {headerSlot && mounted ? createPortal(toolbarBar, headerSlot) : toolbarBar}
      {showTextTools && mounted ? createPortal(
        <div className={`${panelPositionClass} w-[340px] rounded-xl border border-white/10 bg-white p-3 shadow-xl`} style={panelStyle(340)} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button type="button" title="Bold" className="rounded-md border border-black/10 p-1.5 text-black hover:bg-black/5" onMouseDown={onToolbarActionMouseDown} onMouseUp={onToolbarActionMouseUp} onClick={() => applyTextFormat('bold')}><Bold className="h-4 w-4" /></button>
            <button type="button" title="Underline" className="rounded-md border border-black/10 p-1.5 text-black hover:bg-black/5" onMouseDown={onToolbarActionMouseDown} onMouseUp={onToolbarActionMouseUp} onClick={() => applyTextFormat('underline')}><Underline className="h-4 w-4" /></button>
            <button type="button" title="Italic" className="rounded-md border border-black/10 p-1.5 text-black hover:bg-black/5" onMouseDown={onToolbarActionMouseDown} onMouseUp={onToolbarActionMouseUp} onClick={() => applyTextFormat('italic')}><Italic className="h-4 w-4" /></button>
            <button
              type="button"
              title="Insert link"
              className="rounded-md border border-black/10 p-1.5 text-black hover:bg-black/5"
              onMouseDown={onToolbarActionMouseDown}
              onMouseUp={onToolbarActionMouseUp}
              onClick={() => {
                setLinkDraft(anchorHref || 'https://');
                setShowLinkInput((v) => !v);
              }}
            >
              <Link2 className="h-4 w-4" />
            </button>
            {anchorHref ? (
              <button
                type="button"
                title="Remove link"
                className="rounded-md border border-black/10 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                onMouseDown={onToolbarActionMouseDown}
                onMouseUp={onToolbarActionMouseUp}
                onClick={removeLink}
              >
                Unlink
              </button>
            ) : null}
          </div>
          {showLinkInput ? (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  data-cv-toolbar-link-input="true"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="https://example.com"
                  className="h-9 flex-1 rounded-md border border-black/15 bg-white px-2 text-sm text-[#111111] outline-none placeholder:text-black/40 focus:border-[#00C9B1]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyLink();
                    }
                  }}
                />
                <button type="button" className="h-9 rounded-md border border-black/15 px-3 text-xs font-semibold text-black/70" onClick={() => setShowLinkInput(false)}>Cancel</button>
                <button type="button" className="h-9 rounded-md bg-[#10B981] px-3 text-xs font-semibold text-white" onClick={applyLink}>OK</button>
              </div>
              {anchorHref ? (
                <button
                  type="button"
                  className="self-start text-xs font-semibold text-rose-700 hover:underline"
                  onClick={() => {
                    setLinkDraft('');
                    removeLink();
                  }}
                >
                  Remove hyperlink
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-black/55">Highlight text, then choose a style.</p>
          )}
        </div>,
        document.body,
      ) : null}
      {showDate && onDatePick && mounted ? createPortal(
        <div className={panelPositionClass} style={panelStyle(320)} onClick={(e) => e.stopPropagation()}>
          <CvEntryDateRangePopover
            start={dateStart}
            end={dateEnd}
            mode={dateMode}
            preferYear={sectionType === 'education'}
            onApply={(s, e) => {
              onDatePick(s, e);
              setShowDate(false);
            }}
            onClose={() => setShowDate(false)}
          />
        </div>,
        document.body,
      ) : null}
      {showSettings && mounted ? createPortal(
        <div className={`${panelPositionClass} w-[260px] rounded-xl border border-white/10 bg-white p-2 shadow-xl`} style={panelStyle(260)} onClick={(e) => e.stopPropagation()}>
          <p className="mb-2 text-[11px] font-semibold text-black/80">Section settings</p>
          <div className="space-y-1.5">
            {settingsOptions.map((opt) => (
              <label key={opt.key} className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-black/5">
                <span className="text-xs text-black/80">{opt.label}</span>
                <input
                  type="checkbox"
                  checked={opt.enabled}
                  onChange={(e) => opt.onToggle(e.target.checked)}
                  className="h-4 w-4 accent-[#00C9B1]"
                />
              </label>
            ))}
          </div>
        </div>,
        document.body,
      ) : null}
      {confirmDelete && mounted ? createPortal(
        <div className={`${panelPositionClass} w-[260px] rounded-xl border border-rose-200 bg-white p-3 shadow-xl`} style={panelStyle(260)} onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold text-black">Delete confirmation</p>
          <p className="mt-1 text-[11px] text-black/70">Are you sure you want to delete this item?</p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="rounded-md border border-black/10 px-2 py-1 text-xs text-black/70" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button type="button" className="rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold text-white" onClick={() => { onDelete(); setConfirmDelete(false); }}>Delete</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
