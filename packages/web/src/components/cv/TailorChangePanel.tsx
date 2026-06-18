'use client';

import { Check, ChevronDown, Loader2, RotateCcw, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PreTailorGapChecklist, type TailorMissingSkill } from '@/components/dashboard/PreTailorGapChecklist';
import { TailorChangeHighlights } from '@/components/dashboard/TailorChangeHighlights';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api, type CvTailorDraft, type CvTailorDraftEntry, type TailorMutationResponse } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { rehydrateCvBuilderAfterStructuredPersist } from '@/lib/cvStructuredDraftCommit';
import { cn } from '@/lib/utils';

function sectionTitle(sectionType: string): string {
  const s = sectionType.trim().toLowerCase();
  if (!s) return 'Section';
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} section`;
}

function TailorSuggestionCard({
  entry,
  draftId,
  onUpdated,
  onTailorMutation,
  onCvRehydrated,
  onAcceptSucceeded,
  accepting,
  rejecting,
  reverting,
  onAcceptStart,
  onRejectStart,
  onRevertStart,
  onBusyEnd,
}: {
  entry: CvTailorDraftEntry;
  draftId: string;
  onUpdated: (d: CvTailorDraft) => void;
  onTailorMutation?: (result: TailorMutationResponse) => void;
  onCvRehydrated: () => void;
  onAcceptSucceeded?: () => void;
  accepting: boolean;
  rejecting: boolean;
  reverting: boolean;
  onAcceptStart: () => void;
  onRejectStart: () => void;
  onRevertStart: () => void;
  onBusyEnd: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(entry.status === 'pending');

  const invalidateCv = useCallback(
    async (profileId: string) => {
      await rehydrateCvBuilderAfterStructuredPersist(queryClient, profileId, onCvRehydrated);
    },
    [queryClient, onCvRehydrated],
  );

  const accept = async () => {
    onAcceptStart();
    try {
      const result = await api.cv.acceptTailorSection(draftId, entry.sectionId);
      onUpdated(result.draft);
      onTailorMutation?.(result);
      await invalidateCv(result.draft.cvProfileId);
      onAcceptSucceeded?.();
      toast.success('Change applied to your CV');
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not accept change');
    } finally {
      onBusyEnd();
    }
  };

  const reject = async () => {
    onRejectStart();
    try {
      const result = await api.cv.rejectTailorSection(draftId, entry.sectionId);
      onUpdated(result.draft);
      onTailorMutation?.(result);
      toast.success('Suggestion dismissed');
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not reject change');
    } finally {
      onBusyEnd();
    }
  };

  const revert = async () => {
    const patchId = entry.patchId?.trim();
    if (!patchId) {
      toast.error('Revert unavailable — patch id missing (server may have restarted).');
      return;
    }
    onRevertStart();
    try {
      const result = await api.cv.revertPatch(patchId);
      onUpdated(result.draft);
      onTailorMutation?.(result);
      await invalidateCv(result.draft.cvProfileId);
      toast.success('Reverted last accepted change');
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not revert change');
    } finally {
      onBusyEnd();
    }
  };

  const statusBadge =
    entry.status === 'pending' ? (
      <Badge variant="amber">Pending</Badge>
    ) : entry.status === 'accepted' ? (
      <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-300" variant="teal">
        Accepted
      </Badge>
    ) : (
      <Badge variant="muted">Rejected</Badge>
    );

  return (
    <article className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div>
          <p className="text-[14px] font-semibold text-white">{sectionTitle(entry.sectionType)}</p>
          {entry.summary?.trim() ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-white/45">{entry.summary.trim()}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusBadge}
          <ChevronDown className={cn('h-4 w-4 text-white/40 transition', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3">
          <TailorChangeHighlights
            sectionType={entry.sectionType}
            beforeRaw={entry.before}
            afterRaw={entry.after}
            changedFields={entry.changedFields}
            displayDiff={entry.displayDiff}
            summary={entry.summary}
          />
          {entry.status === 'pending' ? (
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={accepting || rejecting || reverting}
                onClick={() => void accept()}
              >
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Accept
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1 gap-1.5 border border-rose-400/30 text-rose-300"
                disabled={accepting || rejecting || reverting}
                onClick={() => void reject()}
              >
                {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Reject
              </Button>
            </div>
          ) : entry.status === 'accepted' && entry.patchId ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 border border-amber-400/35 text-amber-100"
              disabled={accepting || rejecting || reverting}
              onClick={() => void revert()}
            >
              {reverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Undo accept
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export type TailorChangePanelProps = {
  draft: CvTailorDraft | null;
  onDraftUpdate: (draft: CvTailorDraft) => void;
  onTailorMutation?: (result: TailorMutationResponse) => void;
  onCvRehydrated?: () => void;
  onAcceptSucceeded?: () => void;
  jobTitle?: string | null;
  jobCompany?: string | null;
  missingSkills?: TailorMissingSkill[];
  className?: string;
};

export function TailorChangePanel({
  draft,
  onDraftUpdate,
  onTailorMutation,
  onCvRehydrated,
  onAcceptSucceeded,
  jobTitle,
  jobCompany,
  missingSkills = [],
  className,
}: TailorChangePanelProps) {
  const [busySectionId, setBusySectionId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'accept' | 'reject' | 'revert' | null>(null);

  const sorted = useMemo(() => {
    if (!draft?.drafts.length) return [];
    const rank: Record<string, number> = { pending: 0, accepted: 1, rejected: 2 };
    return [...draft.drafts].sort((a, b) => rank[a.status]! - rank[b.status]!);
  }, [draft]);

  const pendingCount = draft?.drafts.filter((d) => d.status === 'pending').length ?? 0;

  const titleLine =
    jobTitle?.trim() || jobCompany?.trim()
      ? `${jobTitle?.trim() || 'Role'} · ${jobCompany?.trim() || 'Company'}`
      : 'Job tailoring';

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col rounded-2xl border border-white/[0.08] bg-[#090C0D]',
        className,
      )}
    >
      <header className="shrink-0 border-b border-white/[0.08] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-white">Tailor suggestions</h2>
        <p className="mt-0.5 text-[12px] text-white/45">{titleLine}</p>
        {draft ? (
          <p className="mt-2 text-[11px] font-medium text-[#00C9B1]">
            {pendingCount} pending · accept updates your CV instantly
          </p>
        ) : null}
      </header>

      <div className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!draft ? (
          <p className="text-sm text-white/45">No tailor draft loaded.</p>
        ) : (
          <>
            <PreTailorGapChecklist
              missingSkills={missingSkills}
              selectedSkills={draft.selectedSkills}
              plannedSections={draft.plannedSections}
            />
            {sorted.length === 0 ? (
              <p className="text-sm text-white/45">No section suggestions in this draft.</p>
            ) : (
              sorted.map((entry) => (
                <TailorSuggestionCard
                  key={entry.sectionId}
                  entry={entry}
                  draftId={draft.id}
                  onUpdated={onDraftUpdate}
                  onTailorMutation={onTailorMutation}
                  onCvRehydrated={() => onCvRehydrated?.()}
                  onAcceptSucceeded={onAcceptSucceeded}
                  accepting={busySectionId === entry.sectionId && busyAction === 'accept'}
                  rejecting={busySectionId === entry.sectionId && busyAction === 'reject'}
                  reverting={busySectionId === entry.sectionId && busyAction === 'revert'}
                  onAcceptStart={() => {
                    setBusySectionId(entry.sectionId);
                    setBusyAction('accept');
                  }}
                  onRejectStart={() => {
                    setBusySectionId(entry.sectionId);
                    setBusyAction('reject');
                  }}
                  onRevertStart={() => {
                    setBusySectionId(entry.sectionId);
                    setBusyAction('revert');
                  }}
                  onBusyEnd={() => {
                    setBusySectionId(null);
                    setBusyAction(null);
                  }}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
