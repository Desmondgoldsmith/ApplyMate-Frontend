'use client';

import Link from 'next/link';

import { InfoHint } from '@/components/ui/InfoHint';
import {
  directiveFromFollowUpIntelligence,
  isFollowUpCoachingSubmitted,
  sanitizeFollowUpDirectiveMessage,
} from '@/lib/dashboardCommandCopy';
import type { FollowUpIntelligencePayload, FollowUpJobRowPayload } from '@/lib/today-plan';
import { TOOLTIP_CONFIDENCE_FOLLOWUP } from '@/lib/dashboardIntelligenceTooltips';
import { descriptiveFollowUpLeadIn } from '@/lib/followUpJobsUiCopy';
import { resolveFollowUpJobsListHref } from '@/lib/followUpListRoute';
import { trackProductEvent } from '@/lib/productAnalytics';
import { cn } from '@/lib/utils';

type Props = {
  /** Optional when the backend dedupes the coaching object but still sends {@link queueJobs}. */
  data: FollowUpIntelligencePayload | null;
  queueJobs?: FollowUpJobRowPayload[] | null;
  queueTotalCount?: number | null;
  /** Backend “Show all” target (often `/dashboard/job-hub?followUps=1`). */
  followUpJobsViewAllHref?: string | null;
};

export function DashboardFollowUpIntelligenceCard({
  data,
  queueJobs,
  queueTotalCount,
  followUpJobsViewAllHref,
}: Props) {
  const jobs = queueJobs ?? [];
  const latest = jobs[0];
  const total = queueTotalCount ?? null;

  const headlineRaw = data?.headline?.trim() || '';
  const supportingRaw = data?.supporting?.trim() || '';
  const intelCtaLabel = data?.ctaLabel?.trim() || '';
  const intelCtaHref = data?.ctaHref?.trim() || '';

  const days =
    typeof data?.daysSinceApplication === 'number' && Number.isFinite(data.daysSinceApplication)
      ? Math.max(0, Math.round(data.daysSinceApplication))
      : null;

  const fallbackDaysHeadline =
    days != null && data
      ? isFollowUpCoachingSubmitted(data.coachingStage)
        ? `${days} days since you applied — time to follow up`
        : `${days} days in your pipeline — time to follow up`
      : '';

  const displayHeadline = data
    ? sanitizeFollowUpDirectiveMessage(
        headlineRaw || fallbackDaysHeadline || directiveFromFollowUpIntelligence(data, null),
      )
    : '';

  const backendViewAll = followUpJobsViewAllHref?.trim() ?? '';
  const hasQueueSignal = backendViewAll.length > 0 || (total ?? 0) > 0 || jobs.length > 0;
  const viewAllHrefResolved = hasQueueSignal ? resolveFollowUpJobsListHref(backendViewAll || null) : '';

  const latestTitleParts = [latest?.companyName?.trim(), latest?.jobTitle?.trim()].filter(Boolean);
  const latestTitle = latestTitleParts.join(' — ') || latest?.headline?.trim() || '';
  const latestHasPreview =
    Boolean(latest) &&
    (Boolean(latestTitle) ||
      Boolean(latest?.headline?.trim()) ||
      Boolean(latest?.supporting?.trim()));

  const primaryHref = (intelCtaHref || latest?.ctaHref?.trim() || '').trim();
  const primaryLabel = (intelCtaLabel || latest?.ctaLabel?.trim() || 'Open').trim();

  const hasIntelCopy =
    Boolean(data) && (Boolean(headlineRaw) || Boolean(supportingRaw) || days != null);

  const canRender =
    (latestHasPreview && Boolean(latest?.ctaHref?.trim())) || (hasIntelCopy && Boolean(intelCtaHref));

  if (!canRender || !primaryHref) return null;

  const hasMultipleFollowUps = jobs.length > 1 || (total != null && total > 1);
  const showShowAll = Boolean(viewAllHrefResolved) && hasMultipleFollowUps;
  const showAllLabel =
    total != null && total > jobs.length
      ? `View all (${total})`
      : total != null && total > 1
        ? `View all (${total})`
        : jobs.length > 1
          ? `View all (${jobs.length})`
          : 'View all';

  const confidenceRaw = data?.confidence ?? latest?.confidence ?? null;
  const confidence =
    typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
      ? Math.min(100, Math.max(0, Math.round(confidenceRaw)))
      : null;

  const latestLeadIn = latestHasPreview && latest ? descriptiveFollowUpLeadIn(latest) : '';
  const latestSupporting = latest?.supporting?.trim() ?? '';
  const showLatestSupporting =
    Boolean(latestSupporting) &&
    !latestLeadIn.toLowerCase().includes(latestSupporting.slice(0, Math.min(48, latestSupporting.length)).toLowerCase());

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-[0_20px_48px_-32px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.04] sm:p-6">
      <div className="min-w-0 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[11px] font-medium tracking-wide text-white/38">Follow-up intelligence</p>
          {showShowAll ? (
            <Link
              href={viewAllHrefResolved}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full border border-[#00C9B1]/50 bg-transparent px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1]/12"
            >
              {showAllLabel}
            </Link>
          ) : null}
        </div>

        {latestHasPreview && latest ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-[15px] font-semibold leading-snug text-white/95">{latestLeadIn}</p>
            {latest.headline?.trim() && !latestLeadIn.includes(latest.headline.trim()) ? (
              <p className="mt-2 text-[13px] font-medium leading-snug text-white/70">{latest.headline.trim()}</p>
            ) : null}
            {showLatestSupporting ? (
              <p className="mt-2 text-[13px] leading-relaxed text-white/55 line-clamp-5">{latestSupporting}</p>
            ) : null}
          </div>
        ) : null}

        {data && (displayHeadline || supportingRaw) ? (
          <div className={cn(latestHasPreview ? 'space-y-2 border-t border-white/[0.06] pt-3' : 'space-y-2')}>
            {latestHasPreview ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Summary</p>
            ) : null}
            {displayHeadline ? (
              <p className="text-[15px] font-semibold leading-snug text-white/90">{displayHeadline}</p>
            ) : null}
            {supportingRaw ? (
              <p className="text-[13px] leading-relaxed text-white/55 line-clamp-4">{supportingRaw}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {confidence != null ? (
        <div className="w-full">
          <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <span>Follow-up priority</span>
              <InfoHint text={TOOLTIP_CONFIDENCE_FOLLOWUP} buttonAriaLabel="What is follow-up priority?" />
            </span>
            <span className="tabular-nums text-white/45">{confidence}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/75 to-[#9CF5EA]/50"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      ) : null}

      <Link
        href={primaryHref}
        className={cn(
          'inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2.5 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A] sm:w-auto sm:self-end',
        )}
        onClick={() => {
          trackProductEvent('recommendation_clicked', {
            ctaSource: 'dashboard_followup_intelligence',
            reason: data?.reason ?? latest?.reason ?? null,
            confidence: data?.confidence ?? latest?.confidence ?? null,
            daysSinceApplication: data?.daysSinceApplication ?? latest?.daysSinceApplication ?? null,
            route: primaryHref,
          });
        }}
      >
        {primaryLabel}
      </Link>
    </section>
  );
}
