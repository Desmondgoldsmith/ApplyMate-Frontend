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
    className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  },
  mixed: {
    label: 'Mixed first impression',
    className: 'border-amber-400/35 bg-amber-500/12 text-amber-100',
  },
  weak: {
    label: 'Weak first impression',
    className: 'border-rose-400/35 bg-rose-500/12 text-rose-200',
  },
};

const SEVERITY_META: Record<
  CvRecruiterScanConcernSeverity,
  { label: string; className: string }
> = {
  minor: {
    label: 'Minor',
    className: 'border-white/15 bg-white/[0.04] text-white/55',
  },
  moderate: {
    label: 'Moderate',
    className: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  },
  critical: {
    label: 'Critical',
    className: 'border-rose-400/35 bg-rose-500/12 text-rose-200',
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
  const readingOrder = [...report.readingPath].sort((a, b) => a.readOrder - b.readOrder);

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
          className="pointer-events-auto flex h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden border-white/[0.08] bg-[#0C0F0F] shadow-[0_20px_48px_rgba(0,0,0,0.55)] sm:h-full sm:max-h-full sm:rounded-2xl sm:border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <ScanEye className="h-4 w-4 shrink-0 text-[#00C9B1]" />
                  <p className="text-sm font-semibold text-white/90">Recruiter Scan</p>
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      verdict.className,
                    )}
                  >
                    {verdict.label}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug text-white/85">
                  {report.firstImpression.headline}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-white/50 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
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
              <p className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2 text-[11px] text-white/55">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {CV_ASSISTANT_APPLYING_FIXES_MESSAGE}
              </p>
            ) : null}

            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300/90">
                <Clock className="h-3.5 w-3.5" />
                First 6 seconds
              </p>
              <p className="rounded-lg border border-orange-400/20 bg-orange-500/[0.06] px-3 py-2 font-mono text-[11px] leading-relaxed text-white/80">
                {report.firstImpression.sixSecondSnapshot || 'No snapshot returned.'}
              </p>
              <p className="mt-2 text-[10px] text-white/40">
                Orange glow on your resume preview shows where attention landed (hover sections for
                notes).
              </p>
            </div>

            {readingOrder.length > 0 ? (
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Reading order
                </p>
                <ol className="space-y-1.5">
                  {readingOrder.map((entry) => {
                    const previewKey = recruiterScanRowIdToPreviewKey(entry.sectionId, sections);
                    return (
                      <li key={`${entry.sectionId}-${entry.readOrder}`}>
                        <button
                          type="button"
                          disabled={!onJumpToSection}
                          onClick={() => onJumpToSection?.(previewKey)}
                          className="flex w-full items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 text-left transition hover:border-[#00C9B1]/35 disabled:cursor-default"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-200">
                            {entry.readOrder}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-white/85">
                                {entry.label}
                              </span>
                              <span className="shrink-0 text-[10px] text-orange-300/80">
                                {entry.attentionScore}%
                              </span>
                            </span>
                            {entry.focalPoint ? (
                              <span className="mt-0.5 block text-[10px] text-white/50">
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

            <div className="sticky top-0 z-10 flex shrink-0 gap-1 border-b border-white/[0.06] bg-[#0C0F0F] px-3 py-2">
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
                    'flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition',
                    tab === id
                      ? 'bg-[#00C9B1]/15 text-[#44E6D6]'
                      : 'text-white/45 hover:bg-white/[0.04] hover:text-white/70',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="px-4 py-3 pb-6">
              {tab === 'impression' ? (
                <p className="text-sm leading-relaxed text-white/75">
                  {report.firstImpression.narrative || 'No narrative returned.'}
                </p>
              ) : null}

              {tab === 'standsOut' ? (
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold text-emerald-300/90">
                      Top 3 takeaways they&apos;d remember
                    </p>
                    <ul className="space-y-2">
                      {report.whatStandsOut.takeaways.map((t, i) => (
                        <li
                          key={`takeaway-${i}`}
                          className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-white/85"
                        >
                          {t.trim() || '—'}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {report.whatStandsOut.highlights.length > 0 ? (
                    <div>
                      <p className="mb-2 text-[11px] font-semibold text-white/50">Highlights</p>
                      <ul className="space-y-2">
                        {report.whatStandsOut.highlights.map((h, i) => (
                          <li
                            key={`highlight-${i}`}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2"
                          >
                            <p className="text-xs font-medium text-white/85">{h.text}</p>
                            {h.why ? (
                              <p className="mt-1 text-[11px] text-white/50">{h.why}</p>
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
                        const sev = SEVERITY_META[c.severity] ?? SEVERITY_META.moderate;
                        return (
                          <li
                            key={`concern-${i}`}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase',
                                  sev.className,
                                )}
                              >
                                {sev.label}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-white/85">{c.text}</p>
                            {c.fix ? (
                              <p className="mt-1.5 text-[11px] text-[#00C9B1]/90">Fix: {c.fix}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-white/55">No major concerns flagged.</p>
                  )}
                  {report.whatCouldBeStronger.actions.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-amber-200/90">
                        Suggested actions
                      </p>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-white/75">
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

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/[0.06] bg-[#0C0F0F] px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10 text-xs"
              disabled={busy}
              onClick={() => void copyShare()}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Share snippet'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10 text-xs"
              disabled={busy}
              onClick={onScanAgain}
            >
              Scan again
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10 text-xs"
              disabled={busy}
              onClick={onClose}
            >
              Done
            </Button>
            {onApplyFindings && applyLines.length > 0 ? (
              <Button type="button" className="gap-1.5 text-xs" disabled={busy} onClick={applyAll}>
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
