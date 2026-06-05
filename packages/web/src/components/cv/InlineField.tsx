'use client';

import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { FocusEvent } from 'react';

import { useCVEdit } from '@/components/cv/CVEditContext';
import type { CvSpellIssue } from '@/lib/api';
import { normalizeEditableHtml, toDisplayRichHtml } from '@/lib/cvRichTextCore';
import { cn } from '@/lib/utils';

const toFormattedHtml = toDisplayRichHtml;

const TEAL_UNDER = 'rgba(0, 174, 175, 0.5)';
const TOOLBAR_INTERACTING_FLAG = '__cvToolbarInteracting';

function isToolbarInteractionActive(): boolean {
  return Boolean((window as unknown as Record<string, unknown>)[TOOLBAR_INTERACTING_FLAG]);
}

function placeCaretAtEnd(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function spellIssueMatchesFieldText(issue: CvSpellIssue, fieldValue: string): boolean {
  const expected = issue.originalText ?? issue.original;
  if (typeof issue.start === 'number' && typeof issue.end === 'number' && issue.end <= fieldValue.length) {
    const slice = fieldValue.slice(issue.start, issue.end);
    if (expected !== undefined && expected !== '') return slice === expected;
    return slice.length > 0;
  }
  const needle = expected?.trim();
  return needle ? fieldValue.includes(needle) : false;
}

export type InlineFieldProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** `inline` = fit content width; `block` = full width of parent (summary, bullets). Default `inline`. */
  layout?: 'inline' | 'block';
  className?: string;
  fieldLabel?: string;
  /** When false, render plain text (read-only preview). */
  editable?: boolean;
  /** Optional key handler while the field is in editing mode. */
  onInputKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  sectionId?: string;
  entryId?: string;
  dataBulletEntry?: string;
  dataBulletIdx?: string;
  fieldPath?: string;
  startEditingWhenEmpty?: boolean;
  /** Placeholder contrast on dark sidebar backgrounds (Onyx). */
  placeholderTone?: 'default' | 'onDark';
};

function InlineFieldInner({
  value,
  onChange,
  placeholder = '',
  multiline = false,
  layout = 'inline',
  className,
  fieldLabel: _fieldLabel,
  editable = true,
  onInputKeyDown,
  onKeyDown,
  sectionId,
  entryId,
  dataBulletEntry,
  dataBulletIdx,
  fieldPath = 'text',
  startEditingWhenEmpty = false,
  placeholderTone = 'default',
}: InlineFieldProps) {
  const ctx = useCVEdit();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSpanElement | HTMLDivElement | null>(null);
  const autoStartedRef = useRef(false);
  const didInitEditRef = useRef(false);
  const liveHtmlRef = useRef('');
  const editSessionDirtyRef = useRef(false);
  const editSessionStartRef = useRef('');
  const commitInFlightRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep draft synced when parent value changes
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!startEditingWhenEmpty) return;
    if (autoStartedRef.current) return;
    if (value.trim().length > 0) return;
    autoStartedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time UX auto-focus for empty freshly added rows
    setEditing(true);
  }, [startEditingWhenEmpty, value]);

  useEffect(() => {
    if (!editing) {
      didInitEditRef.current = false;
      liveHtmlRef.current = '';
      editSessionDirtyRef.current = false;
      return;
    }
    const el = inputRef.current;
    if (!(el instanceof HTMLSpanElement || el instanceof HTMLDivElement)) return;
    if (didInitEditRef.current) return;
    const initial = toFormattedHtml(value || '');
    el.innerHTML = initial;
    liveHtmlRef.current = initial;
    editSessionStartRef.current = normalizeEditableHtml(initial);
    editSessionDirtyRef.current = false;
    didInitEditRef.current = true;
    el.focus();
    placeCaretAtEnd(el);
  }, [editing, value]);

  const activateEntryFocus = useCallback(() => {
    if (!ctx?.isEditing) return;
    if (sectionId) ctx.setFocusedSection(sectionId);
    if (entryId) {
      ctx.setFocusedEntryId(entryId);
      ctx.setFocusedEntrySection(sectionId ?? null);
    }
  }, [ctx, entryId, sectionId]);

  const commit = useCallback(() => {
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    window.setTimeout(() => {
      commitInFlightRef.current = false;
    }, 0);
    if (!editSessionDirtyRef.current) {
      setEditing(false);
      return;
    }
    const el = inputRef.current;
    const source =
      el instanceof HTMLSpanElement || el instanceof HTMLDivElement
        ? (liveHtmlRef.current || el.innerHTML)
        : draft;
    const normalizedNext = normalizeEditableHtml(source);
    if (normalizedNext !== editSessionStartRef.current) {
      onChange(normalizedNext);
    }
    setEditing(false);
  }, [draft, onChange]);

  const displayText = value;
  const empty = !displayText.trim();
  const showPlaceholder = empty && !editing;
  const sectionSpellIssues = sectionId ? (ctx?.spellIssueEntriesBySection?.[sectionId] ?? []) : [];
  const fieldIssues = sectionId ? (ctx?.spellIssuesByField?.[`${sectionId}::${fieldPath}`] ?? []) : [];
  const matchedIssue =
    fieldIssues.find((x) => spellIssueMatchesFieldText(x, displayText)) ??
    sectionSpellIssues.find(
      (x) => (x.fieldPath ?? 'text') === fieldPath && spellIssueMatchesFieldText(x, displayText),
    );
  const showSpellUnderline =
    fieldIssues.some((x) => spellIssueMatchesFieldText(x, displayText)) ||
    sectionSpellIssues.some(
      (x) => (x.fieldPath ?? 'text') === fieldPath && spellIssueMatchesFieldText(x, displayText),
    );

  const placeholderDisplayClass =
    placeholderTone === 'onDark' ? 'text-white/45 italic' : 'text-black/40 italic';
  const placeholderBeforeClass =
    placeholderTone === 'onDark' ? 'empty:before:text-white/45' : 'empty:before:text-gray-400';

  if (!editable) {
    return (
      <span className={cn(className, '[&_a]:text-[#1D4ED8] [&_a]:underline')}>
        {empty ? <span className={placeholderDisplayClass}>{placeholder}</span> : <span dangerouslySetInnerHTML={{ __html: toFormattedHtml(displayText) }} />}
      </span>
    );
  }

  if (!editing) {
    return (
      <span className={cn(layout === 'block' ? 'block' : 'inline-flex', 'items-center gap-1')}>
        <span
          role="button"
          tabIndex={0}
          data-entry-id={entryId}
          title={placeholder}
          className={cn(
            'cursor-text rounded-sm px-0.5 outline-none transition-colors',
            'hover:bg-[rgba(0,201,177,0.06)] focus-visible:ring-1 focus-visible:ring-[#00C9B1]/50',
            showSpellUnderline &&
              'decoration-rose-500/90 underline decoration-wavy decoration-1 underline-offset-2',
            layout === 'block' && 'block w-full min-w-0 max-w-full',
            layout === 'inline' && 'inline max-w-full align-baseline',
            '[&_a]:text-[#1D4ED8] [&_a]:underline',
            className,
          )}
          onClick={(e) => {
            // A link inside the field would otherwise navigate (open a new tab)
            // on click, making it impossible to edit/format linked text. While
            // the CV is editable, clicking enters edit mode instead.
            e.preventDefault();
            e.stopPropagation();
            activateEntryFocus();
            setDraft(value);
            setEditing(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              activateEntryFocus();
              setDraft(value);
              setEditing(true);
            }
          }}
        >
          {showPlaceholder ? <span className={placeholderDisplayClass}>{placeholder}</span> : <span dangerouslySetInnerHTML={{ __html: toFormattedHtml(displayText) }} />}
        </span>
        {matchedIssue && ctx?.isEditing ? (
          <span className="inline-flex items-center gap-1">
            {matchedIssue.suggestion ? (
              <button
                type="button"
                className="rounded border border-emerald-300/70 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.onApplySpellIssue?.(matchedIssue);
                }}
                title={matchedIssue.suggestion}
              >
                Apply
              </button>
            ) : null}
            <button
              type="button"
              className="rounded border border-rose-300/70 bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700"
              onClick={(e) => {
                e.stopPropagation();
                ctx.onDismissSpellIssue?.(matchedIssue);
              }}
            >
              Dismiss
            </button>
          </span>
        ) : null}
      </span>
    );
  }

  const editSurface =
    'm-0 border-0 border-b px-0 py-0 font-[inherit] text-inherit shadow-none outline-none ring-0 bg-transparent box-border placeholder:text-gray-400 placeholder:italic';
  const onFieldFocus = (e: FocusEvent<HTMLElement>) => {
    if (!ctx?.isEditing) return;
    const inferredSection = sectionId ?? e.currentTarget.closest('[data-cv-section]')?.getAttribute('data-cv-section') ?? null;
    const inferredEntry = entryId ?? e.currentTarget.closest('[data-entry-id]')?.getAttribute('data-entry-id') ?? null;
    if (inferredSection) ctx.setFocusedSection(inferredSection);
    if (inferredEntry) {
      ctx.setFocusedEntryId(inferredEntry);
      ctx.setFocusedEntrySection(inferredSection ?? null);
    }
  };

  if (multiline || layout === 'block') {
    return (
      <span className={cn('block min-w-0 max-w-full', layout === 'block' && 'w-full', className)}>
        {/* Use block-level span (not div) so parents may legally wrap this in <p> without hydration errors. */}
        <span
          key={`edit-block-${entryId ?? fieldPath}`}
          ref={(el) => {
            inputRef.current = el;
          }}
          role="textbox"
          aria-label={placeholder}
          data-entry-id={entryId}
          contentEditable
          suppressContentEditableWarning
          className={cn(
            editSurface,
            'block min-h-[1.25em] w-full min-w-0 max-w-full border-b text-inherit whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:italic empty:before:pointer-events-none [&_a]:text-[#1D4ED8] [&_a]:underline',
            placeholderBeforeClass,
          )}
          style={{ borderBottomColor: TEAL_UNDER, caretColor: '#111111' }}
          data-placeholder={placeholder}
          data-bullet-entry={dataBulletEntry}
          data-bullet-idx={dataBulletIdx}
          onInput={(e) => {
            const next = (e.currentTarget as HTMLSpanElement).innerHTML;
            liveHtmlRef.current = next;
            editSessionDirtyRef.current = true;
          }}
          onFocus={onFieldFocus}
          onBlur={() => {
            if (isToolbarInteractionActive()) {
              return;
            }
            commit();
          }}
          onKeyDown={(e) => {
            onInputKeyDown?.(e);
            onKeyDown?.(e);
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
        />
      </span>
    );
  }

  return (
    <span className={cn('inline-block align-baseline', className)}>
      <span
        key={`edit-inline-${entryId ?? fieldPath}`}
        ref={(el) => {
          inputRef.current = el;
        }}
        data-entry-id={entryId}
        contentEditable
        suppressContentEditableWarning
          className={cn(
          editSurface,
            'inline-block min-w-[2ch] max-w-full border-b text-inherit empty:before:content-[attr(data-placeholder)] empty:before:italic empty:before:pointer-events-none [&_a]:text-[#1D4ED8] [&_a]:underline',
            placeholderBeforeClass,
        )}
        style={{ borderBottomColor: TEAL_UNDER, caretColor: '#111111' }}
        data-placeholder={placeholder}
        data-bullet-entry={dataBulletEntry}
        data-bullet-idx={dataBulletIdx}
        onInput={(e) => {
          const next = (e.currentTarget as HTMLSpanElement).innerHTML;
          liveHtmlRef.current = next;
          editSessionDirtyRef.current = true;
        }}
        onFocus={onFieldFocus}
        onBlur={() => {
          if (isToolbarInteractionActive()) {
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          onInputKeyDown?.(e);
          onKeyDown?.(e);
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    </span>
  );
}

function inlineFieldPropsEqual(prev: Readonly<InlineFieldProps>, next: Readonly<InlineFieldProps>): boolean {
  return (
    prev.value === next.value &&
    prev.placeholder === next.placeholder &&
    prev.multiline === next.multiline &&
    prev.layout === next.layout &&
    prev.className === next.className &&
    prev.editable === next.editable &&
    prev.sectionId === next.sectionId &&
    prev.entryId === next.entryId &&
    prev.fieldPath === next.fieldPath &&
    prev.startEditingWhenEmpty === next.startEditingWhenEmpty &&
    prev.placeholderTone === next.placeholderTone &&
    prev.onChange === next.onChange &&
    prev.onInputKeyDown === next.onInputKeyDown &&
    prev.onKeyDown === next.onKeyDown &&
    prev.dataBulletEntry === next.dataBulletEntry &&
    prev.dataBulletIdx === next.dataBulletIdx
  );
}

export const InlineField = memo(InlineFieldInner, inlineFieldPropsEqual);
InlineField.displayName = 'InlineField';
