'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { CvSectionAssistantInline } from '@/components/cv/CvSectionAssistantInline';
import { useCVEdit } from '@/components/cv/CVEditContext';
import {
  dispatchSectionReorderDrop,
  getActiveDraggingSectionId,
  SECTION_DRAG_END_EVENT_NAME,
} from '@/components/cv/cvSectionDrag';
import { cn } from '@/lib/utils';

export type CVSectionWrapperProps = {
  sectionId: string;
  children: ReactNode;
  className?: string;
};

export function CVSectionWrapper({ sectionId, children, className }: CVSectionWrapperProps) {
  const ctx = useCVEdit();
  const [isHovered, setIsHovered] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const isEditing = Boolean(ctx?.isEditing);
  const focusedSection = ctx?.focusedSection ?? null;
  const focusedEntryId = ctx?.focusedEntryId ?? null;
  const focusedEntrySection = ctx?.focusedEntrySection ?? null;
  const isFocused = focusedSection === sectionId;
  const isEntryLevelActive = focusedEntryId !== null;
  const thisHasFocus = focusedSection === sectionId || focusedEntrySection === sectionId;
  const shouldDimForEntryLevel = isEntryLevelActive && !thisHasFocus;
  const isSectionLevelActive = focusedSection !== null && focusedEntryId === null;
  const shouldDimForSectionLevel = isSectionLevelActive && focusedSection !== sectionId;
  const dimmed = shouldDimForEntryLevel || shouldDimForSectionLevel;
  const thisContainsFocusedEntry = focusedEntrySection === sectionId;
  const hasIncomplete = ctx?.incompleteSectionIds?.has(sectionId) === true;
  const spellIssues = ctx?.spellIssuesBySection?.[sectionId] ?? 0;

  /** Pin only when this section is the live preview focus target (not merely default accordion `activeSection`). */
  const thisSectionHasAssistantTarget =
    focusedSection === sectionId || focusedEntrySection === sectionId;
  const showAssistantPin =
    Boolean(ctx?.runCvAssistantCommand) && !dimmed && thisSectionHasAssistantTarget;

  /**
   * The drop on the title bar uses `stopPropagation` so the wrapper's `onDrop` never runs.
   * Without this listener, `isDropTarget` could remain stuck after a successful title-bar
   * drop. Listening to `cv:section-drag-end` from the grip guarantees cleanup.
   */
  useEffect(() => {
    const handler = () => setIsDropTarget(false);
    window.addEventListener(SECTION_DRAG_END_EVENT_NAME, handler);
    return () => window.removeEventListener(SECTION_DRAG_END_EVENT_NAME, handler);
  }, []);

  const sectionOutline = isDropTarget
    ? '2px dashed #00C9B1'
    : isFocused && thisContainsFocusedEntry
      ? '1px solid rgba(0,201,177,0.4)'
      : isFocused
        ? '1.5px solid #00C9B1'
        : isHovered
          ? '1.5px dashed rgba(0,201,177,0.5)'
          : 'none';

  return (
    <div
      data-cv-section={sectionId}
      className={cn(className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (!isEditing) return;
        ctx?.setFocusedSection(sectionId);
        if (ctx?.focusedEntrySection !== sectionId) {
          ctx?.setFocusedEntryId(null);
          ctx?.setFocusedEntrySection(null);
        }
      }}
      onDragOver={(e) => {
        if (!isEditing) return;
        const dragging = getActiveDraggingSectionId();
        if (!dragging || dragging === sectionId) return;
        e.preventDefault();
        if (!isDropTarget) setIsDropTarget(true);
      }}
      onDragLeave={(e) => {
        if (!isDropTarget) return;
        /**
         * relatedTarget is the element being entered. If it is still inside this wrapper,
         * we are crossing between children and should not clear the drop highlight.
         */
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        setIsDropTarget(false);
      }}
      onDrop={(e) => {
        if (!isEditing) return;
        const dragging = getActiveDraggingSectionId();
        setIsDropTarget(false);
        if (!dragging || dragging === sectionId) return;
        e.preventDefault();
        dispatchSectionReorderDrop(sectionId);
      }}
      style={{
        outline: sectionOutline,
        outlineOffset: '4px',
        backgroundColor: isDropTarget
          ? 'rgba(0,201,177,0.08)'
          : isHovered || isFocused
            ? 'rgba(0,201,177,0.03)'
            : 'transparent',
        transition: 'outline-color 120ms, background-color 120ms, opacity 120ms',
        opacity: dimmed ? 0.45 : 1,
        borderRadius: '4px',
        position: 'relative',
        boxShadow: hasIncomplete ? 'inset 0 0 0 1px rgba(245, 158, 11, 0.45)' : undefined,
      }}
    >
      {(hasIncomplete || spellIssues > 0) && (
        <div className="pointer-events-none absolute -right-1.5 -top-2 z-[5] flex items-center gap-1">
          {hasIncomplete ? (
            <span className="rounded-full border border-amber-300/50 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
              Incomplete
            </span>
          ) : null}
          {spellIssues > 0 ? (
            <span className="rounded-full border border-rose-300/50 bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-700">
              {spellIssues} issue{spellIssues === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      )}
      {isEditing && showAssistantPin ? <CvSectionAssistantInline sectionId={sectionId} /> : null}
      {children}
    </div>
  );
}
