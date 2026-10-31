'use client';

import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSearch,
  FileText,
  History,
  LayoutTemplate,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Redo2,
  Rows3,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { InfoHint } from '@/components/ui/InfoHint';
import { useUIStore } from '@/store/useUIStore';
import type { CvProfileSummary } from '@/lib/api';
import type { CvBuilderSaveStatus } from '@/lib/cvBuilder';
import { cn } from '@/lib/utils';

/** "Build with AI" was removed from this toolbar — use CV Library / New CV or the mobile overflow menu to start an AI CV. */

const cvProfileSelectClassName = cn(
  'h-8 max-w-[min(11rem,26vw)] min-w-0 flex-1 cursor-pointer truncate rounded-lg border border-border-subtle bg-bg-surface py-0 pl-2 pr-7 text-[12px] font-semibold text-text-primary outline-none transition sm:max-w-[13rem]',
  'hover:border-border-default focus:border-accent-solid focus:ring-2 focus:ring-border-focus',
  'accent-[#17B26A]',
  '[&>option]:bg-bg-surface [&>option]:text-text-primary',
);

export type CvClinicToolbarVisibility = {
  libraryLink: boolean;
  profilePicker: boolean;
  newCvButton: boolean;
  pdfDocx: boolean;
};

const DEFAULT_VISIBILITY: CvClinicToolbarVisibility = {
  libraryLink: true,
  profilePicker: true,
  newCvButton: true,
  pdfDocx: true,
};

export type CvClinicToolbarProps = {
  /** Omit keys to use defaults (all visible). */
  visibility?: Partial<CvClinicToolbarVisibility>;
  libraryHref?: string;
  targetId: string | null;
  profileOptions: CvProfileSummary[];
  onProfileChange: (profileId: string) => void;
  onNewCv: () => void;
  onOpenTemplatePicker: () => void;
  onOpenSectionModal: () => void;
  onOpenSectionOrder?: () => void;
  isSectionOrderPending?: boolean;
  /** Optional — kept for callers that still pass a handler; not used by this toolbar. */
  onOpenAiChat?: () => void;
  isSpellChecking: boolean;
  onSpellCheck: () => void;
  isAtsScanPending: boolean;
  onAtsCheck: () => Promise<void>;
  isExportPending: boolean;
  onExportPdf: () => void;
  onExportDocx: () => void;
  rightPanelCollapsed: boolean;
  onToggleInsights: () => void;
  builderSaveStatus: CvBuilderSaveStatus;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Opens saved CV versions (automatic snapshots before uploads, accept-all, etc.). */
  onOpenVersionHistory?: () => void;
  leftTitle?: string;
  leftSlot?: ReactNode;
  rightAddon?: ReactNode;
  allowWrap?: boolean;
  showInsightsToggle?: boolean;
};

function ToolbarDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'mx-1.5 hidden h-5 w-px shrink-0 self-center bg-bg-hover min-[900px]:block',
        className,
      )}
      aria-hidden
    />
  );
}

const ghostToolClass =
  'inline-flex h-8 max-w-full shrink min-w-0 items-center gap-1 whitespace-nowrap rounded-lg border-0 bg-transparent px-2 text-[12px] font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-40 sm:px-2.5';

function ToolbarToolButton({
  label,
  compact,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(ghostToolClass, compact && 'px-2 sm:px-2', className)}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      {...props}
    >
      {children}
      {compact ? null : <span>{label}</span>}
    </button>
  );
}

export function CvClinicToolbar({
  visibility,
  libraryHref = '/dashboard/cv',
  targetId,
  profileOptions,
  onProfileChange,
  onNewCv,
  onOpenTemplatePicker,
  onOpenSectionModal,
  onOpenSectionOrder,
  isSectionOrderPending = false,
  isSpellChecking,
  onSpellCheck,
  isAtsScanPending,
  onAtsCheck,
  isExportPending,
  onExportPdf,
  onExportDocx,
  rightPanelCollapsed,
  onToggleInsights,
  builderSaveStatus,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onOpenVersionHistory,
  leftTitle,
  leftSlot,
  rightAddon,
  allowWrap,
  showInsightsToggle = true,
}: CvClinicToolbarProps) {
  const v = { ...DEFAULT_VISIBILITY, ...visibility };
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const compactToolLabels = !sidebarCollapsed;
  const showLeftCluster = v.libraryLink || v.profilePicker || v.newCvButton;
  const hasProfileSelect =
    v.profilePicker && profileOptions.length > 0 && targetId;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [moreMenuPos, setMoreMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!moreOpen || !moreRef.current) {
      setMoreMenuPos(null);
      return;
    }
    const rect = moreRef.current.getBoundingClientRect();
    setMoreMenuPos({ top: rect.bottom + 6, left: rect.left });
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (moreRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-cv-toolbar-more-menu]'))
        return;
      setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  return (
    <div
      data-testid="cv-clinic-toolbar"
      className={cn(
        'sticky top-0 z-50 flex min-h-[52px] shrink-0 items-center overflow-x-hidden border-b border-border-subtle bg-bg-surface px-3 sm:px-4',
        allowWrap && 'min-h-0 flex-wrap gap-y-2 py-2',
      )}
    >
      <div
        className={cn(
          'flex w-full min-w-0 items-center gap-0',
          allowWrap ? 'flex-wrap' : 'flex-nowrap',
        )}
      >
        {/* Group 1 — Navigation & identity */}
        <div className="flex min-w-0 max-w-[min(100%,36%)] shrink items-center gap-1 sm:max-w-none sm:shrink-0 sm:gap-1.5">
          {leftSlot ?? (
            <>
              {v.libraryLink ? (
                <Link
                  href={libraryHref}
                  className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg pl-0.5 pr-1.5 py-0 text-[12px] font-medium text-text-tertiary transition hover:bg-bg-hover hover:text-text-secondary sm:pr-2 sm:text-[13px]"
                  title="Back to CV library"
                >
                  <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-accent-text" />
                  <span className="hidden sm:inline">Library</span>
                </Link>
              ) : null}
              {hasProfileSelect ? (
                <select
                  value={targetId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) onProfileChange(id);
                  }}
                  className={cvProfileSelectClassName}
                  style={{ colorScheme: 'dark' }}
                  aria-label="Current CV"
                >
                  {profileOptions.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      style={{ background: '#0F1512', color: '#fff' }}
                    >
                      {p.name}
                      {p.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              ) : null}
              {v.newCvButton ? (
                <button
                  type="button"
                  onClick={onNewCv}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border-default bg-transparent px-2.5 text-[12px] font-medium text-text-secondary transition hover:border-border-strong hover:bg-bg-hover sm:px-3 sm:text-[13px]"
                >
                  + New resume
                </button>
              ) : null}
              {!showLeftCluster && leftTitle ? (
                <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                  {leftTitle}
                </p>
              ) : !showLeftCluster ? (
                <div className="min-w-0 flex-1" aria-hidden />
              ) : null}
            </>
          )}
        </div>

        <ToolbarDivider />

        {/* Group 2 — Edit tools (centre) */}
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-0 px-0 sm:gap-0.5',
            allowWrap &&
              'basis-full justify-start min-[900px]:basis-auto min-[900px]:justify-center',
          )}
        >
          {onUndo || onRedo ? (
            <span
              data-tour="cv-undo"
              className="mr-0.5 inline-flex items-center"
            >
              <button
                type="button"
                className={cn(ghostToolClass, 'px-2 sm:px-2')}
                disabled={!canUndo}
                onClick={onUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo2 className="h-4 w-4 shrink-0 text-accent-text" />
              </button>
              <button
                type="button"
                className={cn(ghostToolClass, 'px-2 sm:px-2')}
                disabled={!canRedo}
                onClick={onRedo}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <Redo2 className="h-4 w-4 shrink-0 text-accent-text" />
              </button>
            </span>
          ) : null}
          <span data-tour="cv-template" className="inline-flex">
            <ToolbarToolButton
              label="Design"
              compact={compactToolLabels}
              onClick={onOpenTemplatePicker}
            >
              <LayoutTemplate className="h-3.5 w-3.5 shrink-0 text-accent-text" />
            </ToolbarToolButton>
          </span>
          <ToolbarToolButton
            label="Sections"
            compact={compactToolLabels}
            onClick={onOpenSectionModal}
          >
            <ListPlus className="h-3.5 w-3.5 shrink-0 text-accent-text" />
          </ToolbarToolButton>
          <ToolbarToolButton
            label="Scan"
            data-tour="cv-scan"
            compact={compactToolLabels}
            disabled={isAtsScanPending}
            onClick={() => void onAtsCheck()}
            className={compactToolLabels ? 'gap-0' : undefined}
          >
            {isAtsScanPending ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent-text" />
            ) : (
              <FileSearch className="h-3.5 w-3.5 shrink-0 text-accent-text" />
            )}
            {!compactToolLabels ? (
              <InfoHint text="Runs a full CV scan with formatting recommendations and suggestions — heuristic checks, not a guarantee of employer ATS behavior." />
            ) : null}
          </ToolbarToolButton>
          <div className="relative" ref={moreRef}>
            <ToolbarToolButton
              label="More"
              data-tour="cv-more"
              compact={compactToolLabels}
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="h-3.5 w-3.5 shrink-0 text-accent-text" />
            </ToolbarToolButton>
            {moreOpen && moreMenuPos
              ? createPortal(
                  <div
                    data-cv-toolbar-more-menu
                    role="menu"
                    className="fixed z-[500] min-w-[11rem] rounded-xl border border-border-subtle bg-bg-surface py-1 shadow-xl"
                    style={{ top: moreMenuPos.top, left: moreMenuPos.left }}
                  >
                    {onOpenSectionOrder ? (
                      <button
                        type="button"
                        disabled={isSectionOrderPending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary hover:bg-bg-hover disabled:opacity-40"
                        onClick={() => {
                          setMoreOpen(false);
                          onOpenSectionOrder();
                        }}
                      >
                        <Rows3 className="h-3.5 w-3.5 shrink-0 text-accent-text" />
                        Reorder
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={isSpellChecking}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary hover:bg-bg-hover disabled:opacity-40"
                      onClick={() => {
                        setMoreOpen(false);
                        onSpellCheck();
                      }}
                    >
                      {isSpellChecking ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent-text" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-accent-text" />
                      )}
                      Spelling
                    </button>
                    {onOpenVersionHistory ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary hover:bg-bg-hover"
                        onClick={() => {
                          setMoreOpen(false);
                          onOpenVersionHistory();
                        }}
                      >
                        <History className="h-3.5 w-3.5 shrink-0 text-accent-text" />
                        Version history
                      </button>
                    ) : null}
                  </div>,
                  document.body,
                )
              : null}
          </div>
        </div>

        <ToolbarDivider />

        {/* Group 3 — Export & view */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-1.5 sm:gap-2',
            allowWrap &&
              'ml-auto w-full justify-end min-[900px]:ml-0 min-[900px]:w-auto',
          )}
        >
          {rightAddon ? (
            <div className="mr-1 flex shrink-0 flex-wrap items-center gap-1.5">
              {rightAddon}
            </div>
          ) : null}
          {v.pdfDocx ? (
            <span
              data-tour="cv-download"
              className="inline-flex items-center gap-1.5"
            >
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-accent-solid px-3.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-solid-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:pointer-events-none disabled:opacity-50"
                disabled={isExportPending}
                onClick={onExportPdf}
              >
                {isExportPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileDown className="h-4 w-4" aria-hidden />
                )}
                Download PDF
              </button>
              <button
                type="button"
                title="Download as a Word document"
                className="inline-flex h-9 shrink-0 items-center rounded-xl border border-border-default bg-bg-surface px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:pointer-events-none disabled:opacity-50"
                disabled={isExportPending}
                onClick={onExportDocx}
              >
                Word
              </button>
            </span>
          ) : null}
          {showInsightsToggle ? (
            <button
              type="button"
              className={cn(
                ghostToolClass,
                'border border-transparent',
                !rightPanelCollapsed && 'bg-accent-subtle text-accent-text',
              )}
              onClick={onToggleInsights}
              title={rightPanelCollapsed ? 'Show insights' : 'Hide insights'}
            >
              {rightPanelCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-accent-text" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-accent-text" />
              )}
              Insights
            </button>
          ) : null}
          {builderSaveStatus !== 'idle' ? (
            <span
              data-testid="cv-builder-save-status"
              className="shrink-0 text-[11px] text-text-tertiary"
            >
              {builderSaveStatus === 'saving' ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </span>
              ) : builderSaveStatus === 'saved' ? (
                <span className="text-success-text">Saved</span>
              ) : builderSaveStatus === 'dirty' ? (
                <span className="text-warning-text">Unsaved</span>
              ) : builderSaveStatus === 'error' ? (
                <span className="text-danger-text">Save error</span>
              ) : null}
            </span>
          ) : (
            <span
              className="relative hidden shrink-0 pl-2.5 text-[11px] text-text-disabled before:absolute before:left-0 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-accent-subtle before:content-[''] sm:inline"
              data-testid="cv-toolbar-autosave-idle"
            >
              All changes saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
