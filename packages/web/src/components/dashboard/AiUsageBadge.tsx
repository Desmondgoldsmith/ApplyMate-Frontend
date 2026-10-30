'use client';

import Link from 'next/link';

import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { trackUpgradePrompted } from '@/lib/analytics';
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
 * Usage pill: accent under the cap, warning colours at the limit; links to pricing for upgrades.
 */
export function AiUsageBadge({
  className = '',
  variant = 'default',
}: AiUsageBadgeProps) {
  const u = useDailyAiUsage();
  const compact = variant === 'compact';

  const title =
    'Free tier: successful AI actions today vs your daily cap (UTC). CV score refresh does not count. Paid plans have no cap.';

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
        className={cn(
          pillClass,
          'border-border-subtle bg-bg-surface text-[11px] font-medium text-text-tertiary sm:text-[13px]',
        )}
        title={title}
      >
        {SPARK_ICON}
        <span className="text-text-tertiary">{compact ? '…' : 'Usage…'}</span>
      </div>
    );
  }

  if (u.isPaidTier) {
    return (
      <div
        data-tour="ai-counter"
        className={cn(
          pillClass,
          'cursor-default border-accent-border bg-accent-subtle text-accent-text',
        )}
        title={title}
      >
        <span className="text-accent-text">{SPARK_ICON}</span>
        {compact ? (
          <span className="min-w-0 truncate text-[10px] font-medium leading-tight tabular-nums text-text-primary sm:text-[13px]">
            Unlimited AI
            <span className="hidden font-normal text-text-tertiary sm:inline sm:ml-1">
              ({u.dayKey})
            </span>
          </span>
        ) : (
          <span className="text-[13px] font-medium tabular-nums text-text-primary">
            Unlimited AI
            <span className="ml-1 font-normal text-text-tertiary">
              ({u.dayKey})
            </span>
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
      onClick={() => {
        if (atLimit) trackUpgradePrompted('ai_usage_badge');
      }}
      className={cn(
        pillClass,
        'cursor-pointer',
        atLimit
          ? 'border-warning-text/40 bg-warning-subtle text-warning-text'
          : 'border-accent-border bg-accent-subtle text-text-primary hover:border-accent-border hover:bg-accent-subtle',
      )}
      title={
        atLimit ? "Today's free AI limit reached — click to view plans" : title
      }
    >
      <span className={atLimit ? 'text-warning-text' : 'text-accent-text'}>
        {SPARK_ICON}
      </span>
      {compact ? (
        <span
          className={cn(
            'min-w-0 truncate text-[10px] font-semibold leading-tight tabular-nums sm:text-[13px] sm:font-medium sm:leading-normal',
            atLimit ? 'text-warning-text' : 'text-text-primary',
          )}
        >
          {u.used} / {limit}
          <span className="font-normal text-text-tertiary"> free AI today</span>
        </span>
      ) : (
        <span
          className={cn(
            'min-w-0 truncate text-[13px] font-medium tabular-nums',
            atLimit ? 'text-warning-text' : 'text-text-primary',
          )}
        >
          {u.used} / {limit}
          <span className="ml-1 font-normal text-text-tertiary">
            free AI today
          </span>
        </span>
      )}
    </Link>
  );
}
