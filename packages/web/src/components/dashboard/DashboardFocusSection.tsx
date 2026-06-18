'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { DashboardCollapsibleSection } from '@/components/dashboard/DashboardCollapsibleSection';
import type { DashboardEmptyStatePayload } from '@/lib/today-plan';
import type { FocusItem } from '@/lib/dashboardFocusMerge';
import { sanitizeDashboardDisplayText, sanitizeFocusMetaLine } from '@/lib/dashboardDisplayCopy';
import { cn } from '@/lib/utils';

/** Dashboard home: server caps at 2; slice defensively for legacy payloads. */
const DASHBOARD_FOCUS_HOME_CAP = 2;

type Props = {
  items: FocusItem[];
  /** Full ranked count before home snapshot cap. */
  totalCount?: number | null;
  /** From `normalizedSectionTitles.focus` when provided by API. */
  sectionHeading?: string;
  phase15Empty?: DashboardEmptyStatePayload | null;
};

function Dot({ kind }: { kind: FocusItem['dot'] }) {
  const isRed = kind === 'red';
  const cls =
    kind === 'red'
      ? 'bg-[var(--dot-red)]'
      : kind === 'amber'
        ? 'bg-[var(--dot-amber)]'
        : 'bg-[var(--dot-teal)]';
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        cls,
        isRed && 'dashboard-dot-pulse',
      )}
      aria-hidden
    />
  );
}

const focusRowSurfaceClass =
  'rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition-[border-color,background-color] duration-150 hover:border-white/[0.14] hover:bg-white/[0.05]';

export function DashboardFocusRow({
  it,
  as = 'li',
}: {
  it: FocusItem;
  /** Use `div` when the parent already renders a list item (e.g. focus page grid). */
  as?: 'li' | 'div';
}) {
  const inner = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-1 shrink-0">
          <Dot kind={it.dot} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug text-white/92 max-[480px]:whitespace-normal max-[480px]:line-clamp-2 sm:truncate">
            {sanitizeDashboardDisplayText(it.title)}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-white/55">
            {sanitizeDashboardDisplayText(it.subtitle)}
          </p>
          {(() => {
            const meta = sanitizeFocusMetaLine(it.metaLine);
            return meta ? (
            <p className="mt-1.5 text-[11px] font-medium text-white/40">
              {meta}
            </p>
            ) : null;
          })()}
        </div>
      </div>
      <Link
        href={it.ctaHref}
        className="inline-flex min-h-[40px] w-full max-[480px]:mt-1 shrink-0 items-center justify-center rounded-full border border-white/[0.12] px-3.5 py-1.5 text-center text-[12px] font-medium text-white/85 transition-colors hover:border-[#00C9B1]/40 hover:text-[#00C9B1] max-[480px]:w-full sm:w-auto sm:min-h-0"
      >
        {it.ctaLabel}
      </Link>
    </div>
  );

  if (as === 'div') {
    return <div className={focusRowSurfaceClass}>{inner}</div>;
  }

  return <li className={focusRowSurfaceClass}>{inner}</li>;
}

export function DashboardFocusSection({
  items,
  totalCount,
  sectionHeading,
  phase15Empty,
}: Props) {
  const visibleItems = items.slice(0, DASHBOARD_FOCUS_HOME_CAP);
  const total =
    typeof totalCount === 'number' && Number.isFinite(totalCount)
      ? Math.max(0, Math.round(totalCount))
      : items.length;
  const showShowAll = total > DASHBOARD_FOCUS_HOME_CAP;
  const moreCount = Math.max(0, total - visibleItems.length);

  const heading = sectionHeading?.trim() || 'Your focus';

  if (items.length === 0) {
    const custom = phase15Empty?.message?.trim();
    const emptyHref =
      phase15Empty?.ctaHref?.trim() || '/dashboard/jobs/analyze';
    const emptyCta = phase15Empty?.ctaLabel?.trim() || 'Analyze a job →';
    return (
      <section
        id="dashboard-focus"
        data-tour="dashboard-focus"
        aria-label={heading}
        className="scroll-mt-4 min-w-0"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            {heading}
          </h2>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {sanitizeDashboardDisplayText(custom) ||
            'When you analyze roles or move applications forward, your top actions will collect here in one ranked list.'}
        </p>
        <Link
          href={emptyHref}
          className="mt-4 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[var(--text-teal)] hover:underline"
        >
          {emptyCta}
        </Link>
      </section>
    );
  }

  const countBadge = `${total} item${total === 1 ? '' : 's'}`;

  const headerRight = showShowAll ? (
    <Link
      href="/dashboard/focus"
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
      storageKey="focus"
      title={heading}
      countBadge={countBadge}
      headerRight={headerRight}
      className="min-w-0"
      data-tour="dashboard-focus"
    >
      <ul
        id="dashboard-focus"
        className="mt-0 flex list-none flex-col gap-2 p-0"
        aria-label={heading}
      >
        {visibleItems.map((it) => (
          <DashboardFocusRow key={it.id} it={it} />
        ))}
      </ul>
    </DashboardCollapsibleSection>
  );
}
