'use client';

import { Loader2, ScanEye, Sparkles } from 'lucide-react';
import { revealSpellIssue } from '@/lib/cvSpellMark';
import type { MutableRefObject, ReactNode } from 'react';
import { memo, startTransition } from 'react';

import type { CVBuilderQualitySignals } from '@/components/cv/CVBuilder';
import { CVScoreCard } from '@/components/cv/CVScoreCard';
import type { CVScorePayload } from '@/lib/api';
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

export type CvClinicTripleRightTab = 'analysis' | 'improvements' | 'changes';

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
  scoreRefreshing?: boolean;
  scoreValue: number | null | undefined;
  scoreBreakdown?: unknown;
  scorePayload?: CVScorePayload | null;
  improvementList: CVImprovementItem[];
  acceptAllQuota?: import('@/lib/cvAcceptAllQuota').CvAcceptAllQuota | null;
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
  onJumpToImprovementTarget?: (
    targetFieldPath: string,
    sectionFallback?: string,
  ) => void;
  /** Suggestion id when diff overlay is open — suppress duplicate Fix with AI. */
  activePreviewSuggestionId?: string | null;
  /** Opens CV version history (post–accept-all "View versions" toast). */
  onViewVersions?: () => void;
  /** Optional sticky footer (e.g. onboarding Continue). */
  footerSlot?: ReactNode;
  highlightImprovementsAttention?: boolean;
  /** ATS simulation “Draft in Assistant” — opens panel with a grounded prompt. */
  onAtsKeywordAssist?: (prompt: string) => void;
  /** Comprehensive recruiter first-impression scan. */
  onRecruiterScan?: () => void;
  recruiterScanPending?: boolean;
  onScoreRefresh?: () => void;
  /**
   * Tailoring mode only: when provided, a "Tailoring changes" tab is shown first
   * (the main view) and renders this slot, while Analysis/Improvements stay
   * available as secondary tabs.
   */
  changesSlot?: ReactNode;
  changesLabel?: string;
  changesBadgeCount?: number;
};

function CvClinicTripleRightPanelInner({
  profileId,
  tripleRightTab,
  onTripleRightTabChange,
  scoreCardMode,
  scoreLoading,
  scoreRefreshing = false,
  scoreValue,
  scoreBreakdown,
  scorePayload,
  improvementList,
  acceptAllQuota = null,
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
  onJumpToImprovementTarget,
  activePreviewSuggestionId = null,
  onViewVersions,
  footerSlot,
  analyzeScanPending,
  onAnalyzeScan,
  highlightImprovementsAttention = false,
  onAtsKeywordAssist,
  onRecruiterScan,
  recruiterScanPending = false,
  onScoreRefresh,
  changesSlot,
  changesLabel = 'Tailoring changes',
  changesBadgeCount = 0,
}: CvClinicTripleRightPanelProps) {
  const selectTab = (tab: CvClinicTripleRightTab) => {
    startTransition(() => onTripleRightTabChange(tab));
  };
  const hasChanges = Boolean(changesSlot);
  const activeTab: CvClinicTripleRightTab =
    tripleRightTab === 'changes' && !hasChanges ? 'analysis' : tripleRightTab;

  return (
    <div
      data-tour="cv-insights"
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl',
        highlightImprovementsAttention &&
          'ring-2 ring-border-focus shadow-[0_0_0_6px_rgba(23,178,106,0.14)]',
      )}
    >
      <div
        className={cn(
          'grid h-11 w-full min-w-0 shrink-0 border-b border-border-subtle',
          hasChanges ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {hasChanges ? (
          <button
            type="button"
            data-testid="cv-tab-changes"
            onClick={() => selectTab('changes')}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1 border-b-2 px-1.5 text-[12px] font-medium transition-colors duration-150 sm:gap-1.5 sm:px-2.5 sm:text-[13px]',
              activeTab === 'changes'
                ? 'border-accent-solid text-accent-text'
                : 'border-transparent text-text-tertiary hover:text-text-secondary',
            )}
          >
            <span className="truncate">{changesLabel}</span>
            {changesBadgeCount > 0 ? (
              <span
                className="pointer-events-none inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-accent-solid px-1.5 py-0.5 text-[12px] font-bold leading-none text-text-on-accent shadow-sm"
                aria-label={`${changesBadgeCount} pending changes`}
              >
                {changesBadgeCount > 99 ? '99+' : changesBadgeCount}
              </span>
            ) : null}
          </button>
        ) : null}
        <button
          type="button"
          data-testid="cv-tab-analysis"
          onClick={() => selectTab('analysis')}
          className={cn(
            'flex min-w-0 items-center justify-center gap-1 border-b-2 px-1.5 text-[12px] font-medium transition-colors duration-150 sm:gap-1.5 sm:px-2.5 sm:text-[13px]',
            activeTab === 'analysis'
              ? 'border-accent-solid text-accent-text'
              : 'border-transparent text-text-tertiary hover:text-text-secondary',
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
            activeTab === 'improvements'
              ? 'border-accent-solid text-accent-text'
              : 'border-transparent text-text-tertiary hover:text-text-secondary',
          )}
        >
          <span className="whitespace-nowrap">Improvements</span>
          {improvementsBadgeCount > 0 ? (
            <span
              className={cn(
                'pointer-events-none inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[12px] font-bold leading-none text-text-primary shadow-sm',
                highlightImprovementsAttention && 'animate-pulse',
              )}
              aria-label={`${improvementsBadgeCount} pending fixes`}
            >
              {improvementsBadgeCount > 99 ? '99+' : improvementsBadgeCount}
            </span>
          ) : null}
        </button>
      </div>
      {activeTab === 'changes' && hasChanges ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {changesSlot}
        </div>
      ) : (
        <div
          data-lenis-prevent-wheel
          className="app-scrollbar scroll-content-end-pad min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0 pt-1 lg:pb-6"
        >
          {activeTab === 'analysis' ? (
            <div className="space-y-3 px-3">
              {!scoreLoading ? (
                scoreValue !== null && scoreValue !== undefined ? (
                  <div className="space-y-2">
                    {scoreRefreshing ? (
                      <p className="text-[12px] font-medium text-text-tertiary">
                        Updating score…
                      </p>
                    ) : null}
                    <div
                      className={
                        scoreRefreshing
                          ? 'opacity-50 transition-opacity duration-200'
                          : undefined
                      }
                    >
                      <CVScoreCard
                        mode={scoreCardMode}
                        score={scoreValue}
                        breakdown={scoreBreakdown as never}
                        scorePayload={scorePayload ?? undefined}
                        cvProfileId={profileId}
                        pendingImprovements={improvementList}
                        onDiffPreview={onDiffPreview}
                        onScoreRefresh={onScoreRefresh}
                        activePreviewSuggestionId={activePreviewSuggestionId}
                        hideJobMatch
                        onAtsKeywordAssist={onAtsKeywordAssist}
                      />
                    </div>
                  </div>
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

              {onRecruiterScan ? (
                <div className="rounded-xl border border-warning-border bg-warning-subtle p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-subtle text-warning-text">
                      <ScanEye className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-warning-text">
                        Recruiter Scan
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-text-tertiary">
                        See what a recruiter notices in the first 6 seconds —
                        reading order, takeaways, and honest concerns.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-3 h-8 border border-warning-border px-3 text-xs text-warning-text hover:bg-warning-subtle"
                        disabled={recruiterScanPending}
                        onClick={onRecruiterScan}
                      >
                        {recruiterScanPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />{' '}
                            Scanning…
                          </>
                        ) : (
                          <>
                            <ScanEye className="h-3.5 w-3.5" /> Run Recruiter
                            Scan
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {!isOnRecommendedTemplate ? (
                <div className="flex flex-col gap-3 rounded-xl border border-accent-border bg-bg-surface p-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-accent-text">
                      Format suggestion for {formatRecommendation.label}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-tertiary">
                      {formatRecommendation.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void onTemplateChange(formatRecommendation.recommended)
                    }
                    className="inline-flex shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-subtle px-4 py-1.5 text-xs font-semibold text-accent-text transition hover:border-accent-border"
                  >
                    Try {formatRecommendation.recommended}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {completenessGroups.length > 0 ? (
                <div className="mx-3 mt-3 rounded-[10px] border border-warning-border bg-warning-subtle px-3.5 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-text-primary">
                      Sections to complete
                    </p>
                  </div>
                  <p className="mb-2.5 text-[13px] text-text-tertiary">
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
                        <span className="text-xs text-text-secondary">
                          {sec.sectionLabel}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-6 shrink-0 items-center rounded-md border border-border-default bg-transparent px-2.5 text-[13px] font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary"
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
                <div className="mx-3 mb-3 rounded-[10px] border border-success-border bg-success-subtle px-3.5 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text-primary">
                        Spelling & grammar
                      </p>
                      <p className="mt-0.5 text-[13px] text-text-tertiary">
                        {qualitySignals.isSpellChecking
                          ? 'Checking…'
                          : `${qualitySignals.spellIssueCount} spelling · ${qualitySignals.grammarIssueCount} grammar`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        title="Apply every spelling suggestion"
                        className="rounded-md border border-success-border bg-success-subtle px-2 py-1 text-[12px] font-semibold text-success-text disabled:cursor-not-allowed disabled:opacity-40"
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
                        className="inline-flex h-[26px] items-center rounded-md border border-success-border bg-transparent px-3 text-[13px] font-medium text-success-text transition hover:bg-success-subtle disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={qualitySignals.isSpellChecking}
                        onClick={bumpSpellCheck}
                      >
                        Re-check
                      </button>
                    </div>
                  </div>
                  {qualitySignals.isSpellChecking ? (
                    <p className="mt-2 text-[12px] text-text-tertiary">
                      Looking through your CV…
                    </p>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {Object.entries(
                        qualitySignals.spellIssueEntriesBySection,
                      ).map(([sectionKey, issues]) => {
                        if (!issues.length) return null;
                        const sectionLabel =
                          qualitySignals.sectionLabels[sectionKey] ??
                          sectionKey;
                        return (
                          <div key={sectionKey}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold text-text-primary">
                                {sectionLabel}
                              </p>
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
                                    className="rounded-lg border border-border-subtle bg-bg-sunken p-2"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[12px] font-semibold uppercase tracking-wide text-danger-text">
                                          {kind}
                                        </p>
                                        <p className="mt-0.5 break-words text-[13px] text-text-primary">
                                          <span className="rounded bg-danger-subtle px-1 text-danger-text line-through decoration-rose-400/70">
                                            {original}
                                          </span>
                                          {suggestion ? (
                                            <>
                                              <span className="mx-1 text-text-tertiary">
                                                →
                                              </span>
                                              <span className="rounded bg-success-subtle px-1 text-success-text">
                                                {suggestion}
                                              </span>
                                            </>
                                          ) : null}
                                        </p>
                                        {issue.message ? (
                                          <p className="mt-1 text-[12px] text-text-tertiary">
                                            {issue.message}
                                          </p>
                                        ) : null}
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                          type="button"
                                          title="Scroll to this word on your CV"
                                          className="rounded-md border border-border-default bg-bg-surface px-2 py-0.5 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                                          onClick={() => {
                                            if (revealSpellIssue(issue)) return;
                                            jumpToSectionRef.current?.(
                                              resolveJumpSectionKey(sectionKey),
                                              undefined,
                                              { scrollForm: false },
                                            );
                                            window.setTimeout(
                                              () => revealSpellIssue(issue),
                                              600,
                                            );
                                          }}
                                        >
                                          Show me
                                        </button>
                                        {suggestion ? (
                                          <button
                                            type="button"
                                            className="rounded-md border border-success-border bg-success-subtle px-2 py-0.5 text-[12px] font-semibold text-success-text"
                                            onClick={() =>
                                              onApplySpellIssue(issue)
                                            }
                                          >
                                            Apply
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          className="rounded-md border border-border-default bg-bg-surface px-2 py-0.5 text-[12px] font-semibold text-text-secondary"
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
                <div className="mx-3 mb-3 flex flex-wrap items-start justify-between gap-2 rounded-[10px] border border-success-border bg-success-subtle px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text-primary">
                      Spelling & grammar
                    </p>
                    <p className="mt-0.5 text-[13px] text-text-tertiary">
                      Run Re-check to scan this CV for spelling and grammar. No
                      issues right now.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-[26px] shrink-0 items-center rounded-md border border-success-border bg-transparent px-3 text-[13px] font-medium text-success-text transition hover:bg-success-subtle"
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
                acceptAllQuota={acceptAllQuota}
                onDiffPreview={onDiffPreview}
                onJumpToTarget={onJumpToImprovementTarget}
                activePreviewSuggestionId={activePreviewSuggestionId}
                onViewVersions={onViewVersions}
              />
            </>
          )}
          <ScrollContentEnd />
        </div>
      )}
      {footerSlot ? (
        <div className="shrink-0 border-t border-border-subtle bg-bg-surface p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
          {footerSlot}
        </div>
      ) : null}
    </div>
  );
}

export const CvClinicTripleRightPanel = memo(CvClinicTripleRightPanelInner);
