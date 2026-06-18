'use client';

import { Briefcase, FileText, Mail, Mic2, PenLine, Search } from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { DashboardCollapsibleSection } from '@/components/dashboard/DashboardCollapsibleSection';
import { cleanAiText } from '@/lib/dashboardDisplayCopy';
import { mapApiContinuationHref } from '@/lib/executionRouting';
import { sortContinuationItemsNewestFirst, type DashboardContinuationItemPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<DashboardContinuationItemPayload['type'], string> = {
  cv: 'CV',
  analysis: 'Analysis',
  application: 'Application',
  interview: 'Interview',
  cover_letter: 'Cover letter',
  follow_up: 'Follow-up',
};

const TYPE_ICON: Record<DashboardContinuationItemPayload['type'], LucideIcon> = {
  cv: FileText,
  analysis: Search,
  application: Briefcase,
  interview: Mic2,
  cover_letter: PenLine,
  follow_up: Mail,
};

/** Visible estimate for `estimatedMinutes` — always names what the time is for. */
function continuationTimeEstimateLabel(
  type: DashboardContinuationItemPayload['type'],
  mins: number,
): string {
  const n = Math.max(1, mins);
  const head = `Est. ~${n} min`;
  switch (type) {
    case 'interview':
      return `${head} to finish prep`;
    case 'cv':
      return `${head} for this CV step`;
    case 'application':
      return `${head} for this application`;
    case 'analysis':
      return `${head} for this job analysis`;
    case 'cover_letter':
      return `${head} for this cover letter`;
    case 'follow_up':
      return `${head} for this follow-up`;
    default:
      return `${head} to finish`;
  }
}

export type ContinuationSectionProps = {
  items: DashboardContinuationItemPayload[];
  /** Total unfinished tasks (may exceed `items.length` on dashboard). */
  continuationCount?: number | null;
};

function activityPillClass(last: string): string {
  const l = last.toLowerCase();
  if (l.includes('today') || l.includes('just now') || l.includes('hour')) {
    return 'border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.10)] text-[#34d399]';
  }
  return 'border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]';
}

function ContinuationMeta({ item }: { item: DashboardContinuationItemPayload }) {
  const last = item.lastActiveLabel?.trim() ?? '';
  const mins =
    typeof item.estimatedMinutes === 'number' && Number.isFinite(item.estimatedMinutes)
      ? Math.round(item.estimatedMinutes)
      : null;

  const segments: ReactNode[] = [];
  if (last) {
    segments.push(
      <span
        key="last"
        className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', activityPillClass(last))}
      >
        {last}
      </span>,
    );
  }
  if (mins != null) {
    segments.push(
      <span
        key="mins"
        className="text-[11px] text-[var(--text-muted)]"
        title="Rough time to finish what is left in this flow, not the full interview or calendar block."
      >
        {continuationTimeEstimateLabel(item.type, mins)}
      </span>,
    );
  }

  if (!segments.length) return null;
  const withDots = segments.reduce<ReactNode[]>((acc, el, i) => {
    if (i > 0)
      acc.push(
        <span key={`dot-${i}`} className="text-[var(--text-muted)] opacity-50" aria-hidden>
          {' '}
          ·{' '}
        </span>,
      );
    acc.push(el);
    return acc;
  }, []);

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[11px] font-medium">{withDots}</p>
  );
}

function ContinuationTaskCard({ item }: { item: DashboardContinuationItemPayload }) {
  const title = cleanAiText(item.title.trim());
  const subtitle = cleanAiText(item.subtitle?.trim() ?? '');
  const description = cleanAiText(item.description.trim());
  const Icon = TYPE_ICON[item.type] ?? FileText;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 transition-[border-color,background-color] duration-150 sm:flex-row sm:items-center sm:gap-3.5',
        'hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[var(--text-teal)]"
          style={{
            background: 'var(--teal-10)',
            borderColor: 'var(--border-teal)',
          }}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-snug text-[var(--text-primary)] max-[480px]:whitespace-normal max-[480px]:line-clamp-2 sm:truncate">{title}</p>
          {subtitle ? (
            <p className="text-[12px] font-medium leading-snug text-[var(--text-secondary)] max-[480px]:whitespace-normal max-[480px]:line-clamp-2 sm:truncate">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
          ) : null}
          <ContinuationMeta item={item} />
        </div>
      </div>

      <Link
        href={mapApiContinuationHref(item.ctaHref)}
        className={cn(
          'inline-flex min-h-[40px] w-full shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] px-3.5 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] max-[480px]:w-full sm:w-auto sm:min-h-0',
        )}
      >
        {item.ctaLabel}
      </Link>
    </div>
  );
}

const DASHBOARD_CONTINUATION_HOME_CAP = 2;

export function ContinuationSection({ items, continuationCount }: ContinuationSectionProps) {
  if (!items.length) return null;

  const sorted = sortContinuationItemsNewestFirst(items);
  const total = continuationCount ?? sorted.length;
  const visible = sorted.slice(0, DASHBOARD_CONTINUATION_HOME_CAP);
  const showViewAll = total > DASHBOARD_CONTINUATION_HOME_CAP;
  const moreInQueue = Math.max(0, total - visible.length);

  const countBadge = `${total} item${total === 1 ? '' : 's'}`;

  const headerRight = showViewAll ? (
    <Link
      href="/dashboard/continuation"
      className="inline-flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium leading-snug text-[var(--text-teal)] transition-opacity hover:opacity-80 hover:underline"
    >
      <span>View all →</span>
      {moreInQueue > 0 ? (
        <span className="font-normal text-[var(--text-muted)]">(+{moreInQueue} more)</span>
      ) : null}
    </Link>
  ) : null;

  return (
    <DashboardCollapsibleSection
      storageKey="continuation"
      title="Pick up where you left off"
      countBadge={countBadge}
      headerRight={headerRight}
    >
      <div className="flex flex-col gap-2">
        {visible.map((item) => (
          <ContinuationTaskCard key={item.id} item={item} />
        ))}
      </div>
    </DashboardCollapsibleSection>
  );
}

export function continuationTypeLabel(type: DashboardContinuationItemPayload['type']): string {
  return TYPE_LABELS[type] ?? type;
}
