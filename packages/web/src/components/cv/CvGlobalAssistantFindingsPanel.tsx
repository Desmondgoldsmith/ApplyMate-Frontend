'use client';

import { Loader2, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';

import { CvAssistantScopeBadge } from '@/components/cv/CvAssistantScopeBadge';
import { Button } from '@/components/ui/Button';
import {
  buildApplyRecruiterFindingsPayload,
  getRecruiterImprovementFindingsForApply,
  partitionRecruiterScanFindings,
  type CvGlobalAssistantApplyFindingsPayload,
  type CvGlobalAssistantFindingsResult,
} from '@/lib/cvGlobalAssistant';
import { CV_ASSISTANT_APPLYING_FIXES_MESSAGE } from '@/lib/cvAssistantLoadingCopy';
import { cn } from '@/lib/utils';

export { buildGlobalFixPromptFromFindings } from '@/lib/cvGlobalAssistant';

export type CvGlobalAssistantFindingsPanelProps = {
  open: boolean;
  busy?: boolean;
  result: CvGlobalAssistantFindingsResult | null;
  onClose: () => void;
  /** Runs `apply_recruiter_findings` (preferred) for full-CV patch preview. */
  onApplyFindings?: (
    payload: CvGlobalAssistantApplyFindingsPayload,
  ) => void | Promise<void>;
};

export function CvGlobalAssistantFindingsPanel({
  open,
  busy = false,
  result,
  onClose,
  onApplyFindings,
}: CvGlobalAssistantFindingsPanelProps) {
  const [showRawFindings, setShowRawFindings] = useState(false);

  const grouped = useMemo(
    () => (result ? partitionRecruiterScanFindings(result) : null),
    [result],
  );
  const improvementLines = useMemo(
    () => (result ? getRecruiterImprovementFindingsForApply(result) : []),
    [result],
  );
  const actionableForUi = useMemo(() => {
    if (!grouped) return [];
    const displayActionable = improvementLines.filter((line) =>
      grouped.actionable.includes(line),
    );
    return displayActionable.length > 0 ? displayActionable : improvementLines;
  }, [grouped, improvementLines]);

  if (!open || !result || !grouped) return null;

  const title =
    result.operationLabel?.trim() ||
    result.operation.replace(/_/g, ' ');

  const { positives, otherNotes } = grouped;
  const hasActionableFindings = actionableForUi.length > 0;

  const applyAll = () => {
    if (!onApplyFindings || !hasActionableFindings) return;
    void onApplyFindings(
      buildApplyRecruiterFindingsPayload(improvementLines, result.commandId),
    );
  };

  const applyOne = (finding: string) => {
    if (!onApplyFindings) return;
    const line = finding.trim();
    if (!line) return;
    void onApplyFindings(
      buildApplyRecruiterFindingsPayload([line], result.commandId),
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[125] flex items-end justify-center bg-black/40 p-3 sm:items-center"
        onClick={() => !busy && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="max-h-[min(85vh,640px)] w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C0F0F] shadow-[0_20px_48px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <CvAssistantScopeBadge
                  label={result.affectedScopeLabel}
                  variant="findings"
                />
                <p className="text-sm font-semibold text-white/90">{title}</p>
              </div>
              {result.diff.summary ? (
                <p className="text-xs leading-snug text-white/50">
                  {result.diff.summary}
                </p>
              ) : (
                <p className="text-xs leading-snug text-white/45">
                  Review findings below, then apply fixes across your whole CV
                  with the global assistant.
                </p>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-white/50 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              aria-label="Close findings"
              disabled={busy}
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {busy ? (
            <p className="flex items-center justify-center gap-2 border-b border-white/[0.06] px-4 py-2 text-[11px] text-white/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {CV_ASSISTANT_APPLYING_FIXES_MESSAGE}
            </p>
          ) : null}

          <div className="max-h-[min(48vh,400px)] space-y-3 overflow-y-auto px-4 py-3">
            {positives.length > 0 ? (
              <section>
                <p className="mb-1.5 text-[11px] font-semibold text-emerald-300">
                  What is already strong
                </p>
                <ul className="space-y-2">
                  {positives.map((finding, i) => (
                    <li
                      key={`positive-${i}`}
                      className="rounded-lg border border-emerald-300/25 bg-emerald-400/[0.06] p-3"
                    >
                      <p className="text-xs leading-relaxed text-white/80">
                        {finding}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <p className="mb-1.5 text-[11px] font-semibold text-amber-200/90">
                Needs improvement
              </p>
              {hasActionableFindings ? (
                <ul className="space-y-2">
                  {actionableForUi.map((finding, i) => (
                    <li
                      key={`actionable-${i}`}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
                    >
                      <p className="text-xs leading-relaxed text-white/80">
                        {finding}
                      </p>
                      {onApplyFindings ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => applyOne(finding)}
                          className={cn(
                            'mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#00C9B1] transition hover:text-emerald-300 disabled:opacity-50',
                          )}
                        >
                          <Sparkles className="h-3 w-3" />
                          Fix with global assistant
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-white/65">
                  No fixes required right now.
                </p>
              )}
            </section>

            {otherNotes.length > 0 ? (
              <section>
                <p className="mb-1.5 text-[11px] font-semibold text-white/45">
                  Other notes
                </p>
                <ul className="space-y-2">
                  {otherNotes.map((finding, i) => (
                    <li
                      key={`other-${i}`}
                      className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5 text-xs leading-relaxed text-white/65"
                    >
                      {finding}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.findings.length > 0 ? (
              <section>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowRawFindings((prev) => !prev)}
                  className="text-[11px] font-semibold text-white/60 transition hover:text-white/85 disabled:opacity-50"
                >
                  {showRawFindings ? 'Hide raw findings' : 'Show raw findings'}
                </button>
                {showRawFindings ? (
                  <ul className="mt-2 space-y-2">
                    {result.findings.map((finding, i) => (
                      <li
                        key={`raw-${i}`}
                        className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5 text-[11px] leading-relaxed text-white/65"
                      >
                        {finding}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10 text-xs"
              disabled={busy}
              onClick={onClose}
            >
              Done
            </Button>
            {onApplyFindings && hasActionableFindings ? (
              <Button
                type="button"
                className="gap-1.5 text-xs"
                disabled={busy}
                onClick={applyAll}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {busy ? CV_ASSISTANT_APPLYING_FIXES_MESSAGE : 'Apply all fixes (global)'}
              </Button>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
