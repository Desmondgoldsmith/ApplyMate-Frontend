'use client';

import Link from 'next/link';

import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { cn } from '@/lib/utils';

type AiUsageBadgeProps = {
  className?: string;
  /** Larger padding on the overview card */
  variant?: 'compact' | 'default';
};

const SPARK_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    className="shrink-0"
    aria-hidden
  >
    <path
      d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
      fill="currentColor"
      opacity="0.9"
    />
  </svg>
);

/**
 * Server-backed daily AI usage from `GET /users/me` (UTC day; FREE tier cap, PAID unlimited).
 * Premium pill: teal when under cap, amber pulse at limit; links to pricing for upgrades.
 */
export function AiUsageBadge({ className = '', variant = 'default' }: AiUsageBadgeProps) {
  const u = useDailyAiUsage();
  const compact = variant === 'compact';

  const title =
    'Free tier: successful AI actions today vs your daily cap (UTC). Paid plans have no cap. Failed requests do not count.';

  const pillClass = cn(
    'inline-flex max-w-full items-center rounded-full border transition-colors duration-150',
    compact
      ? 'min-h-[36px] gap-1.5 px-2.5 py-1 sm:min-h-[44px] sm:gap-2 sm:px-3 sm:py-2 lg:min-h-0 lg:py-1.5'
      : 'min-h-[44px] gap-2 px-3.5 py-2 lg:min-h-0 lg:py-1.5',
    className,
  );

  if (u.isLoading) {
    return (
      <div
        data-tour="ai-counter"
        className={cn(pillClass, 'border-white/10 bg-white/[0.04] text-[11px] font-medium text-white/45 sm:text-[13px]')}
        title={title}
      >
        {SPARK_ICON}
        <span className="text-white/40">{compact ? '…' : 'Usage…'}</span>
      </div>
    );
  }

  if (u.isPaidTier) {
    return (
      <div
        data-tour="ai-counter"
        className={cn(
          pillClass,
          'cursor-default border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.08)] text-[#00C9B1]',
        )}
        title={title}
      >
        <span className="text-[#00C9B1]">{SPARK_ICON}</span>
        {compact ? (
          <span className="min-w-0 truncate text-[10px] font-medium leading-tight tabular-nums text-white/90 sm:text-[13px]">
            Unlimited AI
            <span className="hidden font-normal text-white/45 sm:inline sm:ml-1">({u.dayKey})</span>
          </span>
        ) : (
          <span className="text-[13px] font-medium tabular-nums text-white/90">
            Unlimited AI
            <span className="ml-1 font-normal text-white/45">({u.dayKey})</span>
          </span>
        )}
      </div>
    );
  }

  const limit = u.limit ?? 5;
  const atLimit = (u.remaining ?? 0) === 0;

  return (
    <Link
      data-tour="ai-counter"
      href="/#pricing"
      className={cn(
        pillClass,
        'cursor-pointer',
        atLimit
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.35)] motion-safe:animate-[dashboard-ai-pulse_2.4s_ease-in-out_infinite]'
          : 'border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.08)] text-white/90 hover:border-[#00C9B1]/55 hover:bg-[rgba(0,201,177,0.12)]',
      )}
      title={atLimit ? "Today's free AI limit reached — click to view plans" : title}
    >
      <span className={atLimit ? 'text-amber-400' : 'text-[#00C9B1]'}>{SPARK_ICON}</span>
      {compact ? (
        <span
          className={cn(
            'min-w-0 truncate text-[10px] font-semibold leading-tight tabular-nums sm:text-[13px] sm:font-medium sm:leading-normal',
            atLimit ? 'text-amber-100' : 'text-white/90',
          )}
        >
          {u.used} / {limit}
          <span className="font-normal text-white/50"> free AI today</span>
        </span>
      ) : (
        <span
          className={cn(
            'min-w-0 truncate text-[13px] font-medium tabular-nums',
            atLimit ? 'text-amber-100' : 'text-white/90',
          )}
        >
          {u.used} / {limit}
          <span className="ml-1 font-normal text-white/50">free AI today</span>
        </span>
      )}
    </Link>
  );
}
