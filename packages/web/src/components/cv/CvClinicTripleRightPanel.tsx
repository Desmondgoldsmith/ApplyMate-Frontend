'use client';

import { Loader2, Sparkles } from 'lucide-react';
import type { MutableRefObject, ReactNode } from 'react';
import { memo, startTransition } from 'react';

import type { CVBuilderQualitySignals } from '@/components/cv/CVBuilder';
import { CVScoreCard } from '@/components/cv/CVScoreCard';
import { ImprovementsPanel } from '@/components/cv/ImprovementsPanel';
import { Button } from '@/components/ui/Button';
import { ScrollContentEnd } from '@/components/ui/ScrollContentEnd';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  api,
  type CVImprovementItem,
  type CvDiffPreviewOpenParams,
  type CvSpellIssue,
} from '@/lib/api';
import { cn } from '@/lib/utils';

export type CvClinicTripleRightTab = 'analysis' | 'improvements';

export type CvClinicCompletenessGroup = {
  sectionKey: string;
  sectionLabel: string;
  fields: Array<{ fieldPath: string; fieldLabel: string }>;
};

export type CvClinicTripleRightPanelProps = {
  profileId: string;
  tripleRightTab: CvClinicTripleRightTab;
  onTripleRightTabChange: (tab: CvClinicTripleRightTab) => void;
  scoreCardMode: 'compact' | 'full';
  scoreLoading: boolean;
  scoreValue: number | null | undefined;
  scoreBreakdown?: unknown;
  improvementList: CVImprovementItem[];
  analyzeScanPending: boolean;
  onAnalyzeScan: () => Promise<void>;
  improvementsBadgeCount: number;
  formatRecommendation: { label: string; recommended: string; reason: string };
  isOnRecommendedTemplate: boolean;
  onTemplateChange: (template: string) => void | Promise<void>;
  completenessGroups: CvClinicCompletenessGroup[];
  completenessScore: number | null | undefined;
  qualitySignals: CVBuilderQualitySignals;
  bumpSpellCheck: () => void;
  bumpSpellFixAll: () => void;
  jumpToSectionRef: MutableRefObject<
    | ((sid: string, itemId?: string, opts?: { scrollForm?: boolean }) => void)
    | null
  >;
  resolveJumpSectionKey: (rawKey: string) => string;
  onApplySpellIssue: (issue: CvSpellIssue) => void;
  onDismissSpellIssue: (issue: CvSpellIssue) => void;
  onDiffPreview: (params: CvDiffPreviewOpenParams | null) => void;
  /** Optional sticky footer (e.g. onboarding Continue). */
  footerSlot?: ReactNode;
  highlightImprovementsAttention?: boolean;
  /** ATS simulation “Draft in Assistant” — opens panel with a grounded prompt. */
  onAtsKeywordAssist?: (prompt: string) => void;
};

function CvClinicTripleRightPanelInner({
  profileId,
  tripleRightTab,
  onTripleRightTabChange,
  scoreCardMode,
  scoreLoading,
  scoreValue,
  scoreBreakdown,
  improvementList,
  improvementsBadgeCount,
  formatRecommendation,
  isOnRecommendedTemplate,
  onTemplateChange,
  completenessGroups,
  completenessScore,
  qualitySignals,
  bumpSpellCheck,
  bumpSpellFixAll,
  jumpToSectionRef,
  resolveJumpSectionKey,
  onApplySpellIssue,
  onDismissSpellIssue,
  onDiffPreview,
  footerSlot,
  analyzeScanPending,
  onAnalyzeScan,
  highlightImprovementsAttention = false,
  onAtsKeywordAssist,
}: CvClinicTripleRightPanelProps) {
  const selectTab = (tab: CvClinicTripleRightTab) => {
    startTransition(() => onTripleRightTabChange(tab));
  };

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl transition-all duration-300',
        highlightImprovementsAttention &&
          'ring-2 ring-[#00C9B1]/65 shadow-[0_0_0_6px_rgba(0,201,177,0.14)]',
      )}
    >
      <div className="grid h-11 w-full min-w-0 shrink-0 grid-cols-2 border-b border-white/[0.07]">
        <button
          type="button"
          data-testid="cv-tab-analysis"
          onClick={() => selectTab('analysis')}
          className={cn(
            'flex min-w-0 items-center justify-center gap-1 border-b-2 px-1.5 text-[12px] font-medium transition-colors duration-150 sm:gap-1.5 sm:px-2.5 sm:text-[13px]',
            tripleRightTab === 'analysis'
              ? 'border-[#00C9B1] text-[#00C9B1]'
              : 'border-transparent text-white/40 hover:text-white/70',
          )}
        >
          <span className="whitespace-nowrap">Analysis</span>
        </button>
        <button
          type="button"
          data-testid="cv-tab-improvements"
          onClick={() => selectTab('improvements')}
          className={cn(
            'flex min-w-0 items-center justify-center gap-1 border-b-2 px-1.5 text-[12px] font-medium transition-colors duration-150 sm:gap-1.5 sm:px-2.5 sm:text-[13px]',
            tripleRightTab === 'improvements'
              ? 'border-[#00C9B1] text-[#00C9B1]'
              : 'border-transparent text-white/40 hover:text-white/70',
          )}
        >
          <span className="whitespace-nowrap">Improvements</span>
          {improvementsBadgeCount > 0 ? (
            <span
              className={cn(
                'pointer-events-none inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm',
                'animate-pulse',
              )}
              aria-label={`${improvementsBadgeCount} pending fixes`}
            >
              {improvementsBadgeCount > 99 ? '99+' : improvementsBadgeCount}
            </span>
          ) : null}
        </button>
      </div>
      <div
        data-lenis-prevent-wheel
        className="app-scrollbar scroll-content-end-pad min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0 pt-1 lg:pb-6"
      >
        {tripleRightTab === 'analysis' ? (
          <div className="space-y-3 px-3">
            {!scoreLoading ? (
              scoreValue !== null && scoreValue !== undefined ? (
                <CVScoreCard
                  mode={scoreCardMode}
                  score={scoreValue}
                  breakdown={scoreBreakdown as never}
                  hideJobMatch
                  onAtsKeywordAssist={onAtsKeywordAssist}
                />
              ) : (
                <Button
                  type="button"
                  className="w-full gap-2"
                  disabled={analyzeScanPending}
                  onClick={() => void onAnalyzeScan()}
                >
                  {analyzeScanPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Scan…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Analyze this CV
                    </>
                  )}
                </Button>
              )
            ) : (
              <Skeleton height={120} borderRadius={12} />
            )}

            {!isOnRecommendedTemplate ? (
              <div className="flex flex-col gap-3 rounded-xl border border-[rgba(0,201,177,0.15)] bg-white/[0.02] p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#00C9B1]">
                    Format suggestion for {formatRecommendation.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                    {formatRecommendation.reason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void onTemplateChange(formatRecommendation.recommended)
                  }
                  className="inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.12)] px-4 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:border-[#00C9B1]/50"
                >
                  Try {formatRecommendation.recommended}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {completenessGroups.length > 0 ? (
              <div className="mx-3 mt-3 rounded-[10px] border border-[rgba(251,191,36,0.20)] bg-[rgba(251,191,36,0.07)] px-3.5 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white/85">
                    Sections to complete
                  </p>
                </div>
                <p className="mb-2.5 text-[11px] text-white/40">
                  {completenessScore != null
                    ? `Completeness ${completenessScore}% · ${completenessGroups.length} section${
                        completenessGroups.length === 1 ? '' : 's'
                      } need details`
                    : `${completenessGroups.length} section${completenessGroups.length === 1 ? '' : 's'} need details`}
                </p>
                <ul className="divide-y divide-white/[0.06]">
                  {completenessGroups.map((sec) => (
                    <li
                      key={sec.sectionKey}
                      className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0"
                    >
                      <span className="text-xs text-white/70">
                        {sec.sectionLabel}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-6 shrink-0 items-center rounded-md border border-white/[0.12] bg-transparent px-2.5 text-[11px] font-medium text-white/60 transition hover:border-white/25 hover:text-white"
                        onClick={() =>
                          jumpToSectionRef.current?.(
                            resolveJumpSectionKey(sec.sectionKey),
                            undefined,
                            {
                              scrollForm: false,
                            },
                          )
                        }
                      >
                        Open
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {qualitySignals.spellIssueCount > 0 ||
            qualitySignals.grammarIssueCount > 0 ||
            qualitySignals.isSpellChecking ? (
              <div className="mx-3 mb-3 rounded-[10px] border border-[rgba(52,211,153,0.18)] bg-[rgba(52,211,153,0.06)] px-3.5 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white/85">
                      Spelling & grammar
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {qualitySignals.isSpellChecking
                        ? 'Checking…'
                        : `${qualitySignals.spellIssueCount} spelling · ${qualitySignals.grammarIssueCount} grammar`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      title="Apply every spelling suggestion"
                      className="rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={
                        qualitySignals.spellIssueCount <= 0 ||
                        qualitySignals.isSpellChecking
                      }
                      onClick={bumpSpellFixAll}
                    >
                      Fix all
                    </button>
                    <button
                      type="button"
                      title="Re-run spell + grammar check"
                      className="inline-flex h-[26px] items-center rounded-md border border-[rgba(52,211,153,0.30)] bg-transparent px-3 text-[11px] font-medium text-[#34D399] transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={qualitySignals.isSpellChecking}
                      onClick={bumpSpellCheck}
                    >
                      Re-check
                    </button>
                  </div>
                </div>
                {qualitySignals.isSpellChecking ? (
                  <p className="mt-2 text-[10px] text-white/40">
                    Looking through your CV…
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {Object.entries(
                      qualitySignals.spellIssueEntriesBySection,
                    ).map(([sectionKey, issues]) => {
                      if (!issues.length) return null;
                      const sectionLabel =
                        qualitySignals.sectionLabels[sectionKey] ?? sectionKey;
                      return (
                        <div key={sectionKey}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold text-white/85">
                              {sectionLabel}
                            </p>
                            <button
                              type="button"
                              className="rounded-md border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-white/60 transition hover:border-white/[0.2]"
                              onClick={() =>
                                jumpToSectionRef.current?.(
                                  resolveJumpSectionKey(sectionKey),
                                  undefined,
                                  {
                                    scrollForm: false,
                                  },
                                )
                              }
                            >
                              Open
                            </button>
                          </div>
                          <ul className="mt-1 space-y-1.5">
                            {issues.map((issue, idx) => {
                              const kind =
                                issue.type === 'grammar' ||
                                issue.type === 'style'
                                  ? 'grammar'
                                  : 'spelling';
                              const original = (issue.original ?? '').trim();
                              const suggestion = (
                                issue.suggestion ?? ''
                              ).trim();
                              return (
                                <li
                                  key={
                                    issue.issueId
                                      ? `${sectionKey}-${issue.issueId}`
                                      : `${sectionKey}-${idx}-${original}`
                                  }
                                  className="rounded-lg border border-white/[0.08] bg-[#111616] p-2"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                                        {kind}
                                      </p>
                                      <p className="mt-0.5 break-words text-[11px] text-white/85">
                                        <span className="rounded bg-rose-500/15 px-1 text-rose-200 line-through decoration-rose-400/70">
                                          {original}
                                        </span>
                                        {suggestion ? (
                                          <>
                                            <span className="mx-1 text-white/40">
                                              →
                                            </span>
                                            <span className="rounded bg-emerald-500/15 px-1 text-emerald-200">
                                              {suggestion}
                                            </span>
                                          </>
                                        ) : null}
                                      </p>
                                      {issue.message ? (
                                        <p className="mt-1 text-[10px] text-white/50">
                                          {issue.message}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      {suggestion ? (
                                        <button
                                          type="button"
                                          className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                                          onClick={() =>
                                            onApplySpellIssue(issue)
                                          }
                                        >
                                          Apply
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/60"
                                        onClick={() =>
                                          onDismissSpellIssue(issue)
                                        }
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-3 mb-3 flex flex-wrap items-start justify-between gap-2 rounded-[10px] border border-[rgba(52,211,153,0.18)] bg-[rgba(52,211,153,0.06)] px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/85">
                    Spelling & grammar
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    Run Re-check to scan this CV for spelling and grammar. No
                    issues right now.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-[26px] shrink-0 items-center rounded-md border border-[rgba(52,211,153,0.30)] bg-transparent px-3 text-[11px] font-medium text-[#34D399] transition hover:bg-emerald-500/10"
                  onClick={bumpSpellCheck}
                  disabled={qualitySignals.isSpellChecking}
                >
                  Re-check
                </button>
              </div>
            )}

            <ImprovementsPanel
              improvements={improvementList}
              profileId={profileId}
              onDiffPreview={onDiffPreview}
            />
          </>
        )}
        <ScrollContentEnd />
      </div>
      {footerSlot ? (
        <div className="shrink-0 border-t border-white/[0.08] bg-[#080A0A] p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
          {footerSlot}
        </div>
      ) : null}
    </div>
  );
}

export const CvClinicTripleRightPanel = memo(CvClinicTripleRightPanelInner);
