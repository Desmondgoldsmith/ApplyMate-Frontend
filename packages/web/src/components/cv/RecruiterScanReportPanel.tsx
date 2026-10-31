'use client';

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  ScanEye,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';

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

const VERDICT_META: Record<
  CvRecruiterScanVerdict,
  { label: string; className: string; dot: string }
> = {
  strong: {
    label: 'Strong first impression',
    className: 'border-success-border bg-success-subtle text-success-text',
    dot: 'bg-success-text',
  },
  mixed: {
    label: 'Mixed first impression',
    className: 'border-warning-border bg-warning-subtle text-warning-text',
    dot: 'bg-warning-text',
  },
  weak: {
    label: 'Weak first impression',
    className: 'border-danger-border bg-danger-subtle text-danger-text',
    dot: 'bg-danger-text',
  },
};

const SEVERITY_META: Record<
  CvRecruiterScanConcernSeverity,
  { label: string; dot: string; rank: number }
> = {
  critical: { label: 'Fix first', dot: 'bg-danger-text', rank: 0 },
  moderate: { label: 'Worth fixing', dot: 'bg-warning-text', rank: 1 },
  minor: { label: 'Small polish', dot: 'bg-text-tertiary', rank: 2 },
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[13px] font-semibold text-text-primary">
      {children}
    </h3>
  );
}

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

  const concerns = [...report.whatCouldBeStronger.concerns].sort(
    (a, b) =>
      (SEVERITY_META[a.severity]?.rank ?? 1) -
      (SEVERITY_META[b.severity]?.rank ?? 1),
  );
  const takeaways = report.whatStandsOut.takeaways.filter((t) => t.trim());

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[126] flex items-stretch justify-end bg-black/40 p-0 sm:p-3"
        onClick={() => !busy && onClose()}
      >
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          role="dialog"
          aria-label="Recruiter Scan"
          className="pointer-events-auto flex h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden border-border-subtle bg-bg-surface shadow-2xl sm:h-full sm:max-h-full sm:rounded-2xl sm:border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
              <ScanEye className="h-4 w-4 text-accent-text" aria-hidden />
              Recruiter Scan
            </p>
            <button
              type="button"
              className="rounded-lg p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
              aria-label="Close recruiter scan"
              disabled={busy}
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="app-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-5 py-5">
            {busy ? (
              <p className="flex items-center gap-2 rounded-lg bg-bg-sunken px-3 py-2 text-[13px] text-text-secondary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {CV_ASSISTANT_APPLYING_FIXES_MESSAGE}
              </p>
            ) : null}

            <section>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold',
                  verdict.className,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', verdict.dot)} />
                {verdict.label}
              </span>
              <p className="mt-3 font-display text-[20px] font-bold leading-snug text-text-primary">
                {report.firstImpression.headline}
              </p>
              {report.firstImpression.narrative ? (
                <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                  {report.firstImpression.narrative}
                </p>
              ) : null}
            </section>

            {report.firstImpression.sixSecondSnapshot ? (
              <section className="rounded-xl border border-border-subtle bg-bg-sunken p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-text-tertiary">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  In the first 6 seconds, a recruiter sees
                </p>
                <p className="text-[14px] italic leading-relaxed text-text-primary">
                  “{report.firstImpression.sixSecondSnapshot.trim()}”
                </p>
              </section>
            ) : null}

            {takeaways.length > 0 ? (
              <section>
                <SectionTitle>What they&apos;ll remember</SectionTitle>
                <ul className="space-y-2">
                  {takeaways.map((t, i) => (
                    <li
                      key={`takeaway-${i}`}
                      className="flex gap-2.5 text-[14px] leading-snug text-text-primary"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-success-text"
                        aria-hidden
                      />
                      {t.trim()}
                    </li>
                  ))}
                </ul>
                {report.whatStandsOut.highlights.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {report.whatStandsOut.highlights.map((h, i) => (
                      <li
                        key={`highlight-${i}`}
                        className="rounded-lg bg-bg-sunken px-3 py-2"
                      >
                        <p className="text-[13px] font-medium text-text-primary">
                          {h.text}
                        </p>
                        {h.why ? (
                          <p className="mt-0.5 text-[13px] text-text-tertiary">
                            {h.why}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            <section>
              <SectionTitle>What to fix</SectionTitle>
              {concerns.length > 0 ? (
                <ul className="space-y-2.5">
                  {concerns.map((c, i) => {
                    const sev =
                      SEVERITY_META[c.severity] ?? SEVERITY_META.moderate;
                    return (
                      <li
                        key={`concern-${i}`}
                        className="rounded-xl border border-border-subtle p-3.5"
                      >
                        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-text-tertiary">
                          <span
                            className={cn('h-1.5 w-1.5 rounded-full', sev.dot)}
                          />
                          {sev.label}
                        </p>
                        <p className="text-[14px] leading-snug text-text-primary">
                          {c.text}
                        </p>
                        {c.fix ? (
                          <p className="mt-1.5 flex gap-1.5 text-[13px] leading-snug text-text-secondary">
                            <ArrowRight
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-text"
                              aria-hidden
                            />
                            {c.fix}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-[14px] text-text-secondary">
                  <CheckCircle2
                    className="h-4 w-4 text-success-text"
                    aria-hidden
                  />
                  Nothing major to fix.
                </p>
              )}
              {report.whatCouldBeStronger.actions.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-text-secondary">
                  {report.whatCouldBeStronger.actions.map((a, i) => (
                    <li key={`action-${i}`}>{a}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            {readingOrder.length > 0 ? (
              <section>
                <SectionTitle>Where their eyes went</SectionTitle>
                <ol className="space-y-1.5">
                  {readingOrder.map((entry) => {
                    const previewKey = recruiterScanRowIdToPreviewKey(
                      entry.sectionId,
                      sections,
                    );
                    const pct = Math.max(
                      0,
                      Math.min(100, entry.attentionScore ?? 0),
                    );
                    return (
                      <li key={`${entry.sectionId}-${entry.readOrder}`}>
                        <button
                          type="button"
                          disabled={!onJumpToSection}
                          onClick={() => onJumpToSection?.(previewKey)}
                          title={
                            entry.focalPoint
                              ? `Focus: ${entry.focalPoint}`
                              : undefined
                          }
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-bg-hover disabled:cursor-default"
                        >
                          <span className="w-5 shrink-0 text-center text-[12px] font-semibold text-text-tertiary">
                            {entry.readOrder}
                          </span>
                          <span className="w-24 shrink-0 truncate text-[13px] font-medium text-text-primary">
                            {entry.label}
                          </span>
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-sunken">
                            <span
                              className="block h-full rounded-full bg-accent-solid"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-text-tertiary">
                            {pct}%
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-2 text-[12px] text-text-tertiary">
                  The glow on your CV shows the same. Tap a row to jump there.
                </p>
              </section>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle px-5 py-3.5">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
              disabled={busy}
              onClick={() => void copyShare()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? 'Copied' : 'Copy summary'}
            </button>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-4 text-[13px]"
                disabled={busy}
                onClick={onScanAgain}
              >
                Scan again
              </Button>
              {onApplyFindings && applyLines.length > 0 ? (
                <Button
                  type="button"
                  variant="accent"
                  className="h-10 gap-1.5 px-4 text-[13px]"
                  disabled={busy}
                  onClick={applyAll}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Fix these for me
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="accent"
                  className="h-10 px-4 text-[13px]"
                  onClick={onClose}
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
