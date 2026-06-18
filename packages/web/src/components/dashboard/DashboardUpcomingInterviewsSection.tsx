'use client';

import Link from 'next/link';

import { DashboardCollapsibleSection } from '@/components/dashboard/DashboardCollapsibleSection';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import type { UpcomingInterviewItem } from '@/lib/today-plan';
import {
  isAppliedPrepUpcomingRow,
  sortUpcomingInterviewsForDashboard,
  upcomingInterviewsCountBadge,
} from '@/lib/upcomingInterviews';
import { cn } from '@/lib/utils';

type Props = {
  interviews: UpcomingInterviewItem[];
  upcomingInterviewCount?: number | null;
};

const DASHBOARD_UPCOMING_HOME_CAP = 2;

function timingLine(card: UpcomingInterviewItem): string | null {
  if (isAppliedPrepUpcomingRow(card)) return null;
  const du =
    typeof card.daysUntilInterview === 'number' && Number.isFinite(card.daysUntilInterview)
      ? Math.max(0, Math.round(card.daysUntilInterview))
      : null;
  if (du === 0) return 'Today';
  if (du === 1) return 'In 1 day';
  if (du != null && du > 1) return `In ${du} days`;
  const iso = card.interviewDate?.trim() ?? '';
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sectionIntroCopy(rows: UpcomingInterviewItem[]): string {
  const hasApplied = rows.some(isAppliedPrepUpcomingRow);
  const hasScheduled = rows.some((r) => !isAppliedPrepUpcomingRow(r));
  if (hasApplied && hasScheduled) {
    return 'Prepare for scheduled interviews and get interview-ready for roles you have just applied to.';
  }
  if (hasApplied) {
    return 'You have applied. Practice now while you wait to hear back.';
  }
  return 'Get ready for your upcoming interviews.';
}

/** Render only when `interviews.length > 0` (caller requirement). */
export function DashboardUpcomingInterviewsSection({ interviews, upcomingInterviewCount }: Props) {
  if (interviews.length === 0) return null;

  const sorted = sortUpcomingInterviewsForDashboard(interviews);
  const totalFromApi =
    typeof upcomingInterviewCount === 'number' && Number.isFinite(upcomingInterviewCount)
      ? Math.max(0, Math.round(upcomingInterviewCount))
      : null;
  const total = totalFromApi ?? sorted.length;

  const visible = sorted.slice(0, DASHBOARD_UPCOMING_HOME_CAP);
  const showViewAll = total > DASHBOARD_UPCOMING_HOME_CAP;
  const moreCount = Math.max(0, total - visible.length);

  const countBadge = upcomingInterviewsCountBadge(total, sorted);

  const headerRight =
    showViewAll ? (
      <Link
        href="/dashboard/interview-prep"
        className="inline-flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium leading-snug text-[var(--text-teal)] transition-opacity hover:opacity-80 hover:underline"
      >
        <span>View all →</span>
        {moreCount > 0 ? (
          <span className="font-normal text-[var(--text-muted)]">(+{moreCount} more)</span>
        ) : null}
      </Link>
    ) : null;

  return (
    <DashboardCollapsibleSection
      storageKey="upcoming_interviews"
      title="Interview prep"
      countBadge={countBadge}
      headerRight={headerRight}
    >
      <p className="mb-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {sectionIntroCopy(sorted)}
      </p>

      <div className="flex flex-col gap-2">
        {visible.map((card, idx) => {
          const appliedPrep = isAppliedPrepUpcomingRow(card);
          const timing = timingLine(card);
          const company = (card.company ?? '').trim();
          const headline = card.headline.trim();
          const jobTitle = (card.jobTitle ?? '').trim();
          const supporting = card.supporting.trim();
          const titleLine = appliedPrep ? headline || jobTitle || company : jobTitle || headline;
          const updatedLabel = card.lastUpdatedLabel?.trim() || null;
          const subParts = appliedPrep
            ? [
                supporting || (jobTitle && company ? `${jobTitle} · ${company}` : company || jobTitle),
                updatedLabel,
              ]
            : [company, timing, updatedLabel].filter(Boolean);
          const subLine = subParts.filter(Boolean).join(appliedPrep ? ' ' : ' · ');

          return (
            <div
              key={card.id ? `${card.id}-${idx}` : `${card.jobAnalysisId}-${idx}`}
              className={cn(
                'flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 transition-[border-color,background-color] duration-150 sm:flex-row sm:items-center sm:gap-3.5',
                'hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]',
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <CompanyLogo
                  company={company || titleLine}
                  logoUrl={card.companyLogoUrl}
                  size="md"
                  shape="rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug text-[var(--text-primary)] max-[480px]:line-clamp-2 max-[480px]:whitespace-normal sm:truncate">
                    {titleLine}
                  </p>
                  {subLine ? (
                    <p
                      className={cn(
                        'text-[12px] leading-snug text-[var(--text-secondary)]',
                        'max-[480px]:line-clamp-2 max-[480px]:whitespace-normal sm:truncate',
                      )}
                    >
                      {subLine}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-2 max-[480px]:w-full sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <Link
                  href={card.ctaHref}
                  className={cn(
                    'inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-[var(--border-default)] px-3.5 py-1.5 text-center text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] max-[480px]:w-full sm:w-auto sm:min-h-0 sm:shrink-0',
                  )}
                  style={{ background: 'transparent' }}
                >
                  {card.ctaLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCollapsibleSection>
  );
}
