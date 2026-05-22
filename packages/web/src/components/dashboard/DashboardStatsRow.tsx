'use client';

import { InfoHint } from '@/components/ui/InfoHint';
import { cn } from '@/lib/utils';

export type DashboardStatChip = {
  key: string;
  label: string;
  value: string;
  status: string;
  /** Verbatim backend explanation for vitals tooltips (optional). */
  explanation?: string;
  scrollTargetId: string;
};

type Props = {
  chips: DashboardStatChip[];
  loading?: boolean;
};

function parsePrimaryNumber(chip: DashboardStatChip): number | null {
  const raw = chip.value.trim();
  if (chip.key === 'career_momentum') {
    const m = raw.match(/^(\d+)\s*\/\s*100/);
    return m ? Number(m[1]) : null;
  }
  if (chip.key === 'predictive_outlook' || chip.key === 'best_match') {
    const m = raw.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }
  if (chip.key === 'streak') {
    const m = raw.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }
  if (chip.key === 'applications') {
    const m = raw.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }
  return null;
}

function valueColorClass(chip: DashboardStatChip): string {
  const n = parsePrimaryNumber(chip);
  if (n == null || !Number.isFinite(n)) return 'text-[var(--text-primary)]';
  switch (chip.key) {
    case 'career_momentum':
      if (n < 60) return 'text-[var(--text-amber)]';
      if (n >= 70) return 'text-[var(--text-teal)]';
      return 'text-[var(--text-primary)]';
    case 'predictive_outlook':
      if (n >= 60) return 'text-[var(--text-teal)]';
      if (n >= 40) return 'text-[var(--text-amber)]';
      return 'text-[var(--text-red)]';
    case 'best_match':
      if (n >= 80) return 'text-[var(--text-teal)]';
      if (n >= 60) return 'text-[var(--text-amber)]';
      return 'text-[var(--text-primary)]';
    case 'applications':
      return 'text-[var(--text-primary)]';
    case 'streak':
      if (n >= 5) return 'text-[var(--text-teal)]';
      if (n >= 3) return 'text-[var(--text-amber)]';
      return 'text-[var(--text-primary)]';
    default:
      return 'text-[var(--text-primary)]';
  }
}

function statusColorClass(chip: DashboardStatChip): string {
  const s = chip.status.trim();
  if (!s) return 'text-[var(--text-muted)]';
  if (/(steady|slow|fragile|stalled)/i.test(s)) return 'text-[var(--text-amber)]';
  if (/(increas|strong|build|healthy|high)/i.test(s)) return 'text-[var(--text-teal)]';
  return 'text-[var(--text-secondary)]';
}

function StatChipButton({ c, gridClassName }: { c: DashboardStatChip; gridClassName?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(c.scrollTargetId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      className={cn(
        'flex min-h-[128px] min-w-[148px] shrink-0 snap-start flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] md:min-h-[132px] md:min-w-0',
        gridClassName,
      )}
    >
      {/* Row 1: label + hint — fixed block height so all cards align */}
      <div className="flex h-10 shrink-0 items-start gap-2">
        <p
          className="line-clamp-2 min-w-0 flex-1 uppercase leading-tight tracking-[0.08em] text-[var(--text-muted)]"
          style={{ fontSize: '10px', fontWeight: 'var(--weight-medium)' }}
        >
          {c.label}
        </p>
        <div className="flex h-6 w-7 shrink-0 items-start justify-end">
          {c.explanation?.trim() ? (
            <span
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <InfoHint
                text={c.explanation.trim()}
                buttonAriaLabel={`How ${c.label} is calculated`}
                tooltipClassName="max-w-[min(20rem,90vw)]"
                className="translate-y-px"
              />
            </span>
          ) : null}
        </div>
      </div>
      {/* Row 2: value — fixed height for baseline alignment */}
      <div className="flex h-10 shrink-0 items-center">
        <p
          className={cn('tabular-nums leading-none', valueColorClass(c))}
          style={{ fontSize: '24px', fontWeight: 'var(--weight-bold)' }}
        >
          {c.value}
        </p>
      </div>
      {/* Row 3: status — fixed height; empty still reserves space */}
      <div className="mt-auto flex min-h-[2.25rem] shrink-0 items-start pt-0.5">
        <p className={cn('line-clamp-2 w-full text-[12px] font-medium leading-snug', statusColorClass(c))}>
          {c.status.trim() ? c.status : '\u00a0'}
        </p>
      </div>
    </button>
  );
}

export function DashboardStatsRow({ chips, loading }: Props) {
  if (loading) {
    return (
      <>
        <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[132px] min-w-[148px] shrink-0 snap-start animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            />
          ))}
        </div>
        <div className="hidden gap-2.5 md:grid md:grid-cols-6">
          {[0, 1, 2].map((i) => (
            <div
              key={`a-${i}`}
              className="col-span-2 h-[132px] animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            />
          ))}
          {[0, 1].map((i) => (
            <div
              key={`b-${i}`}
              className="col-span-2 h-[132px] animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            />
          ))}
        </div>
      </>
    );
  }

  if (chips.length === 0) return null;

  const row1 = chips.slice(0, 3);
  const row2 = chips.slice(3);

  return (
    <>
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => (
          <StatChipButton key={c.key} c={c} />
        ))}
      </div>

      <div className="hidden flex-col gap-2.5 md:flex">
        <div className="grid grid-cols-6 gap-2.5">
          {row1.map((c) => (
            <StatChipButton key={c.key} c={c} gridClassName="col-span-2" />
          ))}
        </div>
        {row2.length > 0 ? (
          <div className="grid grid-cols-6 gap-2.5">
            {row2.length === 1 ? (
              <StatChipButton key={row2[0]!.key} c={row2[0]!} gridClassName="col-span-2" />
            ) : (
              row2.map((c) => <StatChipButton key={c.key} c={c} gridClassName="col-span-2" />)
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
