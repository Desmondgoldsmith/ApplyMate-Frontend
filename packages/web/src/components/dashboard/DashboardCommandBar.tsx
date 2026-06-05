'use client';

import { Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useId, useMemo } from 'react';

import { InfoHint } from '@/components/ui/InfoHint';
import {
  directiveFromFollowUpIntelligence,
  directiveFromOpportunityDetection,
  directiveFromStrategicRecommendation,
  sanitizeFollowUpDirectiveMessage,
} from '@/lib/dashboardCommandCopy';
import { tooltipCommandBarConfidence } from '@/lib/dashboardIntelligenceTooltips';
import { canonicalDashboardHref } from '@/lib/dashboardHrefDedupe';
import { descriptiveFollowUpLeadIn } from '@/lib/followUpJobsUiCopy';
import { resolveFollowUpJobsListHref } from '@/lib/followUpListRoute';
import { isGenericInterviewCoachingCopy } from '@/lib/genericInterviewCoaching';
import type { DashboardCommandBarSource, TodayPlanPayload } from '@/lib/today-plan';

type Props = {
  plan: TodayPlanPayload | null | undefined;
  /** Hide when the account has no meaningful search activity yet. */
  isBrandNewUser: boolean;
  /** Suppress the command strip when its CTA matches an href already shown in Focus, Continue, or Upcoming Interviews. */
  omitCanonicalCtaHrefs?: ReadonlySet<string>;
  /** When upcoming interview rows exist, hide generic “prepare for interviews” priority copy (Priority Intelligence strip). */
  suppressGenericInterviewPriority?: boolean;
};

type LegacyCandidateSource = 'strategic_recommendation' | 'opportunity_detection' | 'follow_up_intelligence';

type CommandNoticeSource = DashboardCommandBarSource | LegacyCandidateSource;

function noticeEyebrow(source: CommandNoticeSource | undefined): string {
  switch (source) {
    case 'follow_up_intelligence':
      return 'Follow-up';
    case 'opportunity_detection':
      return 'Opportunity';
    case 'strategic_recommendation':
      return 'Recommendation';
    case 'priority_intelligence':
      return 'Priority';
    case 'cv_clinic':
      return 'Resume clinic';
    case 'continuation':
      return 'Continue';
    default:
      return 'Heads-up';
  }
}

type Candidate = {
  confidence: number;
  directive: string;
  ctaLabel: string;
  ctaHref: string;
  source: LegacyCandidateSource;
};

export function DashboardCommandBar({
  plan,
  isBrandNewUser,
  omitCanonicalCtaHrefs,
  suppressGenericInterviewPriority,
}: Props) {
  const noticeLabelId = useId();
  const fromApi = plan?.commandBar;

  const legacyTop = useMemo(() => {
    if (!plan || isBrandNewUser) return null;
    const list: Candidate[] = [];

    const sr = plan.strategicRecommendation;
    if (
      sr?.headline?.trim() &&
      sr.supporting?.trim() &&
      sr.ctaLabel?.trim() &&
      sr.ctaHref?.trim()
    ) {
      if (
        !suppressGenericInterviewPriority ||
        !isGenericInterviewCoachingCopy(sr.headline.trim(), sr.supporting.trim())
      ) {
        const confidence =
          typeof sr.confidence === 'number' && Number.isFinite(sr.confidence)
            ? Math.min(100, Math.max(0, Math.round(sr.confidence)))
            : 72;
        list.push({
          confidence,
          directive: directiveFromStrategicRecommendation(sr),
          ctaLabel: sr.ctaLabel.trim(),
          ctaHref: sr.ctaHref.trim(),
          source: 'strategic_recommendation',
        });
      }
    }

    const od = plan.opportunityDetection;
    if (od?.headline?.trim() && od.supporting?.trim() && od.ctaLabel?.trim() && od.ctaHref?.trim()) {
      if (
        !suppressGenericInterviewPriority ||
        !isGenericInterviewCoachingCopy(od.headline.trim(), od.supporting.trim())
      ) {
        const confidence =
          typeof od.confidence === 'number' && Number.isFinite(od.confidence)
            ? Math.min(100, Math.max(0, Math.round(od.confidence)))
            : 72;
        list.push({
          confidence,
          directive: directiveFromOpportunityDetection(od),
          ctaLabel: od.ctaLabel.trim(),
          ctaHref: od.ctaHref.trim(),
          source: 'opportunity_detection',
        });
      }
    }

    const fu = plan.followUpIntelligence;
    if (fu?.headline?.trim() && fu.supporting?.trim() && fu.ctaLabel?.trim() && fu.ctaHref?.trim()) {
      const confidence =
        typeof fu.confidence === 'number' && Number.isFinite(fu.confidence)
          ? Math.min(100, Math.max(0, Math.round(fu.confidence)))
          : 72;
      list.push({
        confidence,
        directive: sanitizeFollowUpDirectiveMessage(directiveFromFollowUpIntelligence(fu, null)),
        ctaLabel: fu.ctaLabel.trim(),
        ctaHref: fu.ctaHref.trim(),
        source: 'follow_up_intelligence',
      });
    }

    const omit = omitCanonicalCtaHrefs;
    const filtered =
      omit && omit.size > 0
        ? list.filter((c) => !omit.has(canonicalDashboardHref(c.ctaHref)))
        : list;
    filtered.sort((a, b) => b.confidence - a.confidence);
    return filtered.find((c) => c.confidence >= 70) ?? null;
  }, [plan, isBrandNewUser, omitCanonicalCtaHrefs, suppressGenericInterviewPriority]);

  const fromApiDeduped = useMemo(() => {
    if (!fromApi?.ctaHref?.trim()) return null;
    const omit = omitCanonicalCtaHrefs;
    if (omit && omit.size > 0 && omit.has(canonicalDashboardHref(fromApi.ctaHref))) return null;
    if (
      suppressGenericInterviewPriority &&
      fromApi.message?.trim() &&
      isGenericInterviewCoachingCopy(fromApi.message.trim(), fromApi.ctaLabel ?? '')
    ) {
      return null;
    }
    return fromApi;
  }, [fromApi, omitCanonicalCtaHrefs, suppressGenericInterviewPriority]);

  const fromApiBar = fromApiDeduped;
  const top = fromApiBar ?? legacyTop;

  if (!top || isBrandNewUser) return null;

  const directive = (() => {
    if (fromApiBar != null) {
      const msg = fromApiBar.message?.trim() ?? '';
      if (msg) return sanitizeFollowUpDirectiveMessage(msg);
      if (fromApiBar.source === 'follow_up_intelligence' && plan?.followUpIntelligence) {
        return sanitizeFollowUpDirectiveMessage(directiveFromFollowUpIntelligence(plan.followUpIntelligence, null));
      }
      return '';
    }
    return sanitizeFollowUpDirectiveMessage(legacyTop!.directive);
  })();
  const confidence =
    fromApiBar != null ? fromApiBar.confidence : legacyTop!.confidence;
  const ctaLabel =
    fromApiBar != null ? fromApiBar.ctaLabel : legacyTop!.ctaLabel;
  const ctaHref =
    fromApiBar != null ? fromApiBar.ctaHref : legacyTop!.ctaHref;
  const confidenceTooltipSource =
    fromApiBar != null ? fromApiBar.source : legacyTop!.source;
  const confidenceTooltip = tooltipCommandBarConfidence(confidenceTooltipSource);
  const noticeLabel = noticeEyebrow(confidenceTooltipSource as CommandNoticeSource);

  const followUpQueueJobs = plan?.followUpJobs ?? [];
  const followUpQueueTotal = plan?.followUpJobsTotalCount ?? null;
  const followUpViewAllBackendHref = plan?.followUpJobsViewAllHref?.trim() ?? '';
  const followUpQueueHasSignal =
    followUpViewAllBackendHref.length > 0 || (followUpQueueTotal ?? 0) > 0 || followUpQueueJobs.length > 0;
  const followUpLatest = followUpQueueJobs[0];
  const useRichFollowUpCopy = Boolean(followUpLatest) && followUpQueueHasSignal;
  const directiveDisplay =
    useRichFollowUpCopy && followUpLatest ? descriptiveFollowUpLeadIn(followUpLatest) : directive;
  const followUpSupportingSnippet =
    useRichFollowUpCopy && followUpLatest?.supporting?.trim() ? followUpLatest.supporting.trim() : null;

  const followUpViewAllHrefResolved = followUpQueueHasSignal
    ? resolveFollowUpJobsListHref(followUpViewAllBackendHref || null)
    : '';
  const followUpHasMultiple =
    followUpQueueJobs.length > 1 || (followUpQueueTotal != null && followUpQueueTotal > 1);
  const showFollowUpShowAll = Boolean(followUpViewAllHrefResolved) && followUpHasMultiple;
  const followUpShowAllLabel =
    followUpQueueTotal != null && followUpQueueTotal > followUpQueueJobs.length
      ? `View all (${followUpQueueTotal})`
      : followUpQueueTotal != null && followUpQueueTotal > 1
        ? `View all (${followUpQueueTotal})`
        : followUpQueueJobs.length > 1
          ? `View all (${followUpQueueJobs.length})`
          : 'View all';

  return (
    <div
      className="min-w-0"
      data-command-source={fromApiBar?.source ?? undefined}
      role="region"
      aria-label="Priority notice"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#00C9B1]/22 bg-[rgba(0,201,177,0.07)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#00C9B1_0%,#00C9B1_55%,transparent_100%)] opacity-90"
          aria-hidden
        />
        <div className="flex gap-3.5 px-4 py-4 pl-5 sm:gap-4 sm:px-5 sm:py-4 sm:pl-6">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00C9B1]/25 bg-[#080b0a]/40 text-[#00C9B1]"
            aria-hidden
          >
            <Megaphone className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p
                className="mb-0 min-w-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#00C9B1]/90"
                id={noticeLabelId}
              >
                {noticeLabel}
              </p>
              {showFollowUpShowAll ? (
                <Link
                  href={followUpViewAllHrefResolved}
                  className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-full border border-[#00C9B1]/45 px-3 py-1.5 text-[12px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1]/12"
                >
                  {followUpShowAllLabel}
                </Link>
              ) : null}
            </div>
            <p
              className="mt-2 max-w-prose text-[13px] font-normal leading-relaxed text-[var(--text-primary)] sm:text-[14px]"
              aria-labelledby={noticeLabelId}
            >
              {directiveDisplay}
            </p>
            {followUpSupportingSnippet &&
            !directiveDisplay.toLowerCase().includes(followUpSupportingSnippet.slice(0, 48).toLowerCase()) ? (
              <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-[var(--text-muted)] line-clamp-4">
                {followUpSupportingSnippet}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
              <Link
                href={ctaHref}
                className="inline-flex min-h-[40px] w-full shrink-0 items-center justify-center rounded-full border border-transparent bg-[var(--teal)] px-[18px] py-2 text-[13px] font-semibold text-[#080b0a] transition-[filter,transform] duration-150 hover:brightness-110 hover:[transform:scale(1.01)] active:scale-[0.99] sm:w-auto"
              >
                {ctaLabel}
              </Link>
              <p className="flex flex-wrap items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <span>Priority signal</span>
                  <InfoHint text={confidenceTooltip} buttonAriaLabel="What does priority signal mean?" />
                </span>
                <span className="tabular-nums text-[var(--text-muted)]">{confidence}%</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
