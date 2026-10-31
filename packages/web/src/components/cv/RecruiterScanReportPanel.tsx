'use client';

import { Clock, Copy, Loader2, ScanEye, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  buildApplyRecruiterFindingsPayload,
  type CvGlobalAssistantApplyFindingsPayload,
} from '@/lib/cvGlobalAssistant';
import { CV_ASSISTANT_APPLYING_FIXES_MESSAGE } from '@/lib/cvAssistantLoadingCopy';
import type { CVSectionRecord } from '@/lib/api';
import {
  buildRecruiterScanShareSnippet,
  getRecruiterApplyFindingsFromSession,
  recruiterScanRowIdToPreviewKey,
  type CvRecruiterScanConcernSeverity,
  type CvRecruiterScanSession,
  type CvRecruiterScanVerdict,
} from '@/lib/cvRecruiterScan';
import { cn } from '@/lib/utils';

type RecruiterScanTab = 'impression' | 'standsOut' | 'stronger';

const VERDICT_META: Record<
  CvRecruiterScanVerdict,
  { label: string; className: string }
> = {
  strong: {
    label: 'Strong first impression',
    className: 'border-success-border bg-success-subtle text-success-text',
  },
  mixed: {
    label: 'Mixed first impression',
    className: 'border-warning-border bg-warning-subtle text-warning-text',
  },
  weak: {
    label: 'Weak first impression',
    className: 'border-danger-border bg-danger-subtle text-danger-text',
  },
};

const SEVERITY_META: Record<
  CvRecruiterScanConcernSeverity,
  { label: string; className: string }
> = {
  minor: {
    label: 'Minor',
    className: 'border-border-default bg-bg-surface text-text-tertiary',
  },
  moderate: {
    label: 'Moderate',
    className: 'border-warning-border bg-warning-subtle text-warning-text',
  },
  critical: {
    label: 'Critical',
    className: 'border-danger-border bg-danger-subtle text-danger-text',
  },
};

export type RecruiterScanReportPanelProps = {
  open: boolean;
  busy?: boolean;
  session: CvRecruiterScanSession | null;
  sections: CVSectionRecord[];
  onClose: () => void;
  onScanAgain: () => void;
  onApplyFindings?: (payload: CvGlobalAssistantApplyFindingsPayload) => void;
  onJumpToSection?: (previewSectionId: string) => void;
};

export function RecruiterScanReportPanel({
  open,
  busy = false,
  session,
  sections,
  onClose,
  onScanAgain,
  onApplyFindings,
  onJumpToSection,
}: RecruiterScanReportPanelProps) {
  const [tab, setTab] = useState<RecruiterScanTab>('impression');
  const [copied, setCopied] = useState(false);

  const report = session?.report;
  const applyLines = useMemo(
    () => (session ? getRecruiterApplyFindingsFromSession(session) : []),
    [session],
  );

  if (!open || !session || !report) return null;

  const verdict = VERDICT_META[report.firstImpression.verdict];
  const readingOrder = [...report.readingPath].sort(
    (a, b) => a.readOrder - b.readOrder,
  );

  const applyAll = () => {
    if (!onApplyFindings || applyLines.length === 0) return;
    void onApplyFindings(
      buildApplyRecruiterFindingsPayload(applyLines, session.commandId),
    );
  };

  const copyShare = async () => {
    const text =
      (session as { copyText?: string }).copyText?.trim() ||
      buildRecruiterScanShareSnippet(session);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[126] flex items-stretch justify-end bg-black/45 p-0 sm:p-3"
        onClick={() => !busy && onClose()}
      >
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          className="pointer-events-auto flex h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden border-border-subtle bg-bg-surface shadow-[0_20px_48px_rgba(0,0,0,0.55)] sm:h-full sm:max-h-full sm:rounded-2xl sm:border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-border-subtle px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <ScanEye className="h-4 w-4 shrink-0 text-accent-text" />
                  <p className="text-sm font-semibold text-text-primary">
                    Recruiter Scan
                  </p>
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold',
                      verdict.className,
                    )}
                  >
                    {verdict.label}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug text-text-primary">
                  {report.firstImpression.headline}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
                aria-label="Close recruiter scan"
                disabled={busy}
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-scrolling:touch] [-webkit-overflow-scrolling:touch]">
            {busy ? (
              <p className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-[13px] text-text-tertiary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {CV_ASSISTANT_APPLYING_FIXES_MESSAGE}
              </p>
            ) : null}

            <div className="border-b border-border-subtle px-4 py-3">
              <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-warning-text">
                <Clock className="h-3.5 w-3.5" />
                First 6 seconds
              </p>
              <p className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 font-mono text-[13px] leading-relaxed text-text-secondary">
                {report.firstImpression.sixSecondSnapshot ||
                  'No snapshot returned.'}
              </p>
              <p className="mt-2 text-[12px] text-text-tertiary">
                Orange glow on your CV preview shows where attention landed
                (hover sections for notes).
              </p>
            </div>

            {readingOrder.length > 0 ? (
              <div className="border-b border-border-subtle px-4 py-3">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-text-tertiary">
                  Reading order
                </p>
                <ol className="space-y-1.5">
                  {readingOrder.map((entry) => {
                    const previewKey = recruiterScanRowIdToPreviewKey(
                      entry.sectionId,
                      sections,
                    );
                    return (
                      <li key={`${entry.sectionId}-${entry.readOrder}`}>
                        <button
                          type="button"
                          disabled={!onJumpToSection}
                          onClick={() => onJumpToSection?.(previewKey)}
                          className="flex w-full items-start gap-2 rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 text-left transition hover:border-accent-border disabled:cursor-default"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-subtle text-[12px] font-bold text-warning-text">
                            {entry.readOrder}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-text-primary">
                                {entry.label}
                              </span>
                              <span className="shrink-0 text-[12px] text-warning-text">
                                {entry.attentionScore}%
                              </span>
                            </span>
                            {entry.focalPoint ? (
                              <span className="mt-0.5 block text-[12px] text-text-tertiary">
                                Focus: {entry.focalPoint}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}

            <div className="sticky top-0 z-10 flex shrink-0 gap-1 border-b border-border-subtle bg-bg-surface px-3 py-2">
              {(
                [
                  ['impression', 'First impression'],
                  ['standsOut', 'What stands out'],
                  ['stronger', 'Could be stronger'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition',
                    tab === id
                      ? 'bg-accent-subtle text-accent-text'
                      : 'text-text-tertiary hover:bg-bg-hover hover:text-text-secondary',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="px-4 py-3 pb-6">
              {tab === 'impression' ? (
                <p className="text-sm leading-relaxed text-text-secondary">
                  {report.firstImpression.narrative || 'No narrative returned.'}
                </p>
              ) : null}

              {tab === 'standsOut' ? (
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-success-text">
                      Top 3 takeaways they&apos;d remember
                    </p>
                    <ul className="space-y-2">
                      {report.whatStandsOut.takeaways.map((t, i) => (
                        <li
                          key={`takeaway-${i}`}
                          className="rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-xs text-text-primary"
                        >
                          {t.trim() || '—'}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {report.whatStandsOut.highlights.length > 0 ? (
                    <div>
                      <p className="mb-2 text-[13px] font-semibold text-text-tertiary">
                        Highlights
                      </p>
                      <ul className="space-y-2">
                        {report.whatStandsOut.highlights.map((h, i) => (
                          <li
                            key={`highlight-${i}`}
                            className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2"
                          >
                            <p className="text-xs font-medium text-text-primary">
                              {h.text}
                            </p>
                            {h.why ? (
                              <p className="mt-1 text-[13px] text-text-tertiary">
                                {h.why}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'stronger' ? (
                <div className="space-y-3">
                  {report.whatCouldBeStronger.concerns.length > 0 ? (
                    <ul className="space-y-2">
                      {report.whatCouldBeStronger.concerns.map((c, i) => {
                        const sev =
                          SEVERITY_META[c.severity] ?? SEVERITY_META.moderate;
                        return (
                          <li
                            key={`concern-${i}`}
                            className="rounded-lg border border-border-subtle bg-bg-surface p-3"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase',
                                  sev.className,
                                )}
                              >
                                {sev.label}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-text-primary">
                              {c.text}
                            </p>
                            {c.fix ? (
                              <p className="mt-1.5 text-[13px] text-accent-text">
                                Fix: {c.fix}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-tertiary">
                      No major concerns flagged.
                    </p>
                  )}
                  {report.whatCouldBeStronger.actions.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[13px] font-semibold text-warning-text">
                        Suggested actions
                      </p>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-text-secondary">
                        {report.whatCouldBeStronger.actions.map((a, i) => (
                          <li key={`action-${i}`}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border-subtle bg-bg-surface px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              className="border border-border-subtle text-xs"
              disabled={busy}
              onClick={() => void copyShare()}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Share snippet'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-border-subtle text-xs"
              disabled={busy}
              onClick={onScanAgain}
            >
              Scan again
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-border-subtle text-xs"
              disabled={busy}
              onClick={onClose}
            >
              Done
            </Button>
            {onApplyFindings && applyLines.length > 0 ? (
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
                Apply fixes
              </Button>
            ) : null}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
