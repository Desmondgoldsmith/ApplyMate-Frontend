'use client';

import { Loader2, X } from 'lucide-react';

import { CvAssistantScopeBadge } from '@/components/cv/CvAssistantScopeBadge';
import { CvDiffActionPair } from '@/components/cv/cvDiffImprovementActions';
import { CV_ASSISTANT_VALIDATING_MESSAGE } from '@/lib/cvAssistantLoadingCopy';
import type {
  CvGlobalAssistantChangedField,
  CvGlobalAssistantFullCvResult,
} from '@/lib/cvGlobalAssistant';
import { assistantChangedFieldLabel } from '@/lib/cvAssistantDiffDisplay';
import { cn } from '@/lib/utils';

export type CvGlobalAssistantReviewPanelProps = {
  open: boolean;
  busy: boolean;
  busyLabel?: string | null;
  result: CvGlobalAssistantFullCvResult | null;
  changedFields: CvGlobalAssistantChangedField[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptSection: (changeIndex: number) => void;
  onRejectSection: (changeIndex: number) => void;
  onClose: () => void;
};

/** Summary + bulk actions only — per-section before/after lives inline on the CV builder. */
export function CvGlobalAssistantReviewPanel({
  open,
  busy,
  busyLabel = null,
  result,
  changedFields,
  onAcceptAll,
  onRejectAll,
  onClose,
}: CvGlobalAssistantReviewPanelProps) {
  if (!open || !result) return null;

  const title =
    result.operationLabel?.trim() ||
    result.operation.replace(/_/g, ' ');

  const sectionLabels = changedFields.map((cf) =>
    assistantChangedFieldLabel(cf.fieldPath),
  );

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-3 right-3 top-3 z-20 rounded-xl border border-[#10B981]/35',
        'bg-[#0C1010]/95 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md',
        'lg:left-4 lg:right-4',
      )}
      role="region"
      aria-label="Global assistant review"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <CvAssistantScopeBadge
              label={result.affectedScopeLabel}
              variant="global"
            />
            <p className="text-xs font-semibold text-white/90">{title}</p>
          </div>
          {result.diff.summary ? (
            <p className="text-[11px] leading-snug text-white/60">
              {result.diff.summary}
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] leading-snug text-white/45">
            Review each highlighted section in your CV below, then accept or
            reject changes inline.
          </p>
          {sectionLabels.length > 0 ? (
            <p className="mt-2 text-[10px] text-emerald-300/80">
              Sections with changes: {sectionLabels.join(' · ')}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-white/50 hover:bg-white/[0.06] hover:text-white"
          aria-label="Dismiss review summary"
          onClick={onClose}
          disabled={busy}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
        {busy ? (
          <p className="flex items-center gap-2 text-[11px] text-white/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {busyLabel?.trim() || CV_ASSISTANT_VALIDATING_MESSAGE}
          </p>
        ) : (
          <span className="text-[10px] text-white/35" />
        )}
        <CvDiffActionPair
          className="flex flex-wrap items-center justify-end gap-1.5"
          rejectLabel="Reject all"
          acceptLabel="Accept all"
          onReject={onRejectAll}
          onAccept={onAcceptAll}
        />
      </div>
    </div>
  );
}
