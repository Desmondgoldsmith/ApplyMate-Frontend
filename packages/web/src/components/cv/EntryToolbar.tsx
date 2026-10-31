'use client';

import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Settings,
  Trash2,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useCvOverlayZIndex } from '@/components/cv/CvOverlayLayerContext';
import { CvEntryDateRangePopover } from '@/components/cv/CvEntryDateRangePopover';
import { useToast } from '@/components/ui/Toast';
import { CV_UNDO_EVENT } from '@/lib/cvUndoRedo';

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
  /** Ask first (whole sections). Entries are removed at once with an Undo toast. */
  confirmBeforeDelete?: boolean;
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
  confirmBeforeDelete = false,
  settingsOptions = [],
}: EntryToolbarProps) {
  const toast = useToast();
  const toolbarAnchorId = anchorSectionId ?? sectionType;
  const overlayZ = useCvOverlayZIndex();
  const rootRef = useRef<HTMLDivElement>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{
    left: number;
    top: number;
    bottom: number;
  }>({ left: 0, top: 0, bottom: 0 });
  const [showDate, setShowDate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [forceBelow, setForceBelow] = useState(false);
  const hasDatePickerByType =
    [
      'experience',
      'education',
      'certifications',
      'achievements',
      'projects',
    ].includes(sectionType) || sectionType.startsWith('custom_');
  const canShowDate = Boolean(
    showDatePicker && hasDatePickerByType && onDatePick,
  );
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
    if (!showDate && !showSettings && !confirmDelete) return;
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
  }, [confirmDelete, mounted, showDate, showSettings]);

  const panelStyle = (width: number): CSSProperties => ({
    zIndex: overlayZ,
    left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - width - 8)),
    top:
      effectivePanelPosition === 'above'
        ? Math.max(8, anchorRect.top - 10)
        : Math.min(window.innerHeight - 8, anchorRect.bottom + 8),
    transform:
      effectivePanelPosition === 'above' ? 'translateY(-100%)' : undefined,
  });

  const toolbarBar = (
    <div
      ref={rootRef}
      data-cv-entry-toolbar=""
      className={
        headerSlot
          ? 'flex w-full max-w-full items-center'
          : `absolute left-0 z-[1000] ${position === 'above' ? '-top-11' : 'top-full mt-2'}`
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex max-w-full flex-nowrap items-center rounded-full border border-border-subtle bg-white shadow-xl">
        {!hideAddButton && addSecondaryEntryLabel && onAddSecondaryEntry ? (
          <>
            <button
              type="button"
              onClick={onAddEntry}
              title={addEntryLabel}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-l-full bg-accent-solid px-3 py-1.5 text-sm font-semibold text-text-on-accent"
            >
              {addEntryLabel}
            </button>
            <button
              type="button"
              onClick={onAddSecondaryEntry}
              title={addSecondaryEntryLabel}
              className="bg-[#4F46E5] px-3 py-1.5 text-sm font-semibold text-text-primary"
            >
              {addSecondaryEntryLabel}
            </button>
          </>
        ) : !hideAddButton ? (
          <button
            type="button"
            onClick={onAddEntry}
            title={addEntryLabel}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-l-full bg-accent-solid px-3 py-1.5 text-sm font-semibold leading-none text-text-on-accent"
          >
            {addEntryLabel}
          </button>
        ) : (
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-l-full bg-accent-solid px-2 py-1.5 text-[10px] font-semibold leading-none text-text-on-accent">
            Edit
          </span>
        )}
        <button
          type="button"
          title="Move up"
          disabled={!showMoveUp}
          onClick={onMoveUp}
          className="px-2 py-1.5 text-black/70 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Move down"
          disabled={!showMoveDown}
          onClick={onMoveDown}
          className="px-2 py-1.5 text-black/70 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
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
          <button
            type="button"
            title="Pick date"
            onClick={() => setShowDate((v) => !v)}
            className="px-2 py-1.5 text-black/70"
          >
            <Calendar className="h-4 w-4" />
          </button>
        ) : null}
        {!hideDelete ? (
          <button
            type="button"
            title={
              confirmBeforeDelete ? 'Remove this section' : 'Remove this entry'
            }
            onClick={() => {
              if (confirmBeforeDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete();
              toast.success('Removed', {
                label: 'Undo',
                onClick: () => window.dispatchEvent(new Event(CV_UNDO_EVENT)),
              });
            }}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-1.5 text-[12px] font-semibold text-[#B42318] hover:bg-[#FEF3F2]"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </button>
        ) : null}
        <button
          type="button"
          title="Settings"
          disabled={!canShowSettings}
          onClick={() => setShowSettings((v) => !v)}
          className="rounded-r-full px-2 py-1.5 text-black/70 disabled:opacity-30"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {headerSlot && mounted
        ? createPortal(toolbarBar, headerSlot)
        : toolbarBar}
      {showDate && onDatePick && mounted
        ? createPortal(
            <div
              className={panelPositionClass}
              style={panelStyle(320)}
              onClick={(e) => e.stopPropagation()}
            >
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
          )
        : null}
      {showSettings && mounted
        ? createPortal(
            <div
              className={`${panelPositionClass} w-[260px] rounded-xl border border-border-subtle bg-white p-2 shadow-xl`}
              style={panelStyle(260)}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[11px] font-semibold text-black/80">
                Section settings
              </p>
              <div className="space-y-1.5">
                {settingsOptions.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-black/5"
                  >
                    <span className="text-xs text-black/80">{opt.label}</span>
                    <input
                      type="checkbox"
                      checked={opt.enabled}
                      onChange={(e) => opt.onToggle(e.target.checked)}
                      className="h-4 w-4 accent-[#17B26A]"
                    />
                  </label>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
      {confirmDelete && mounted
        ? createPortal(
            <div
              className={`${panelPositionClass} w-[280px] rounded-xl border border-black/10 bg-white p-4 shadow-xl`}
              style={panelStyle(280)}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[14px] font-semibold text-[#111827]">
                Remove this whole section?
              </p>
              <p className="mt-1 text-[13px] text-[#4B5563]">
                Everything in it comes off your CV. You can add it again from
                Sections.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-black/10 px-3 py-1.5 text-[13px] font-medium text-[#374151] hover:bg-black/5"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#D92D20] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#B42318]"
                  onClick={() => {
                    onDelete();
                    setConfirmDelete(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
