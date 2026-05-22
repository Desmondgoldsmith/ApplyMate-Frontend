'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useCVEdit } from '@/components/cv/CVEditContext';
import { cn } from '@/lib/utils';

export type InlineLinkFieldProps = {
  /** Unique key for persisting custom label in sessionStorage. */
  fieldKey: string;
  defaultDisplay: string;
  linkHref: string;
  onChangeHref: (val: string) => void;
  /** Build final href for the anchor (mailto / https). */
  hrefBuilder: (raw: string) => string;
  placeholder?: string;
  className?: string;
  linkClassName?: string;
};

function readStoredLabel(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(`applymate:cv:linkLabel:${key}`) ?? '';
  } catch {
    return '';
  }
}

function writeStoredLabel(key: string, v: string) {
  if (typeof window === 'undefined') return;
  try {
    if (v.trim()) window.sessionStorage.setItem(`applymate:cv:linkLabel:${key}`, v.trim());
    else window.sessionStorage.removeItem(`applymate:cv:linkLabel:${key}`);
  } catch {
    /* ignore */
  }
}

export function InlineLinkField({
  fieldKey,
  defaultDisplay,
  linkHref,
  onChangeHref,
  hrefBuilder,
  placeholder = 'URL or email',
  className,
  linkClassName,
}: InlineLinkFieldProps) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing);
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(defaultDisplay);
  const [hrefDraft, setHrefDraft] = useState(linkHref);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const stored = readStoredLabel(fieldKey);
  const displayText = (stored || defaultDisplay).trim() || defaultDisplay;

  useEffect(() => {
    if (!editing) {
      setLabelDraft((stored || defaultDisplay).trim() || defaultDisplay);
      setHrefDraft(linkHref);
    }
  }, [editing, linkHref, defaultDisplay, stored]);

  const commit = useCallback(() => {
    writeStoredLabel(fieldKey, labelDraft.trim() && labelDraft.trim() !== defaultDisplay ? labelDraft : '');
    onChangeHref(hrefDraft);
    setEditing(false);
  }, [fieldKey, labelDraft, hrefDraft, onChangeHref, defaultDisplay]);

  useEffect(() => {
    if (!editing) return;
    const onDoc = (e: MouseEvent) => {
      const el = popoverRef.current;
      const t = e.target as Node;
      if (el && !el.contains(t)) commit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLabelDraft((readStoredLabel(fieldKey) || defaultDisplay).trim() || defaultDisplay);
        setHrefDraft(linkHref);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [editing, commit, fieldKey, defaultDisplay, linkHref]);

  const built = hrefBuilder((linkHref || '').trim());
  const showLink = built.length > 0 && built !== '#';

  if (!inline) {
    if (!showLink) return <span className={className}>{displayText}</span>;
    return (
      <a href={built} className={cn('underline', linkClassName, className)} target="_blank" rel="noreferrer">
        {displayText}
      </a>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={cn('cursor-text bg-transparent p-0 text-inherit underline', linkClassName, className)}
        onClick={(e) => {
          e.stopPropagation();
          setLabelDraft((readStoredLabel(fieldKey) || defaultDisplay).trim() || defaultDisplay);
          setHrefDraft(linkHref);
          setEditing(true);
        }}
      >
        {showLink ? displayText : <span className="text-black/40 italic">{defaultDisplay}</span>}
      </button>
    );
  }

  return (
    <span className={cn('relative inline-block align-baseline', className)}>
      <span
        ref={popoverRef}
        className="absolute bottom-full left-1/2 z-30 mb-1 flex w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 flex-col rounded-lg border border-[#00C9B1]/35 bg-[#0C0F0F] p-2.5 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide text-white/70">Label</span>
        <input
          className="mt-1 rounded border border-black/15 bg-white px-1.5 py-1 text-[11px] text-[#111111] outline-none placeholder:text-black/40 focus:border-[#00C9B1]/60"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
        />
        <span className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-white/70">URL / Email</span>
        <input
          className="mt-1 rounded border border-black/15 bg-white px-1.5 py-1 text-[11px] text-[#111111] outline-none placeholder:text-black/40 focus:border-[#00C9B1]/60"
          value={hrefDraft}
          placeholder={placeholder}
          onChange={(e) => setHrefDraft(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 self-end rounded-md bg-[#00C9B1]/20 px-2 py-1 text-[10px] font-semibold text-[#00C9B1]"
          onClick={() => commit()}
        >
          Done
        </button>
      </span>
      <span className="underline">{displayText}</span>
    </span>
  );
}
