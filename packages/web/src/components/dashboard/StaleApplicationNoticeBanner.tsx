'use client';

import Link from 'next/link';

import { sanitizeDashboardDisplayText } from '@/lib/dashboardDisplayCopy';
import type { StaleApplicationNoticePayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  notice: StaleApplicationNoticePayload;
  className?: string;
};

/** Non-blocking Job Hub banner when an application has gone quiet (21+ days). */
export function StaleApplicationNoticeBanner({ notice, className }: Props) {
  if (!notice.show) return null;

  return (
    <div
      role="status"
      className={cn(
        'rounded-xl border border-[rgba(251,191,36,0.22)] bg-[rgba(251,191,36,0.06)] px-4 py-3.5',
        className,
      )}
    >
      <p className="text-[13px] font-semibold leading-snug text-[#FCD34D]">
        {sanitizeDashboardDisplayText(notice.headline)}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[rgba(240,244,242,0.62)]">
        {sanitizeDashboardDisplayText(notice.supporting)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={notice.primaryCtaHref}
          className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-3.5 py-1.5 text-[12px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
        >
          {notice.primaryCtaLabel}
        </Link>
        {notice.secondaryCtaLabel?.trim() && notice.secondaryCtaHref?.trim() ? (
          <Link
            href={notice.secondaryCtaHref}
            className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:border-white/[0.22] hover:text-white/90"
          >
            {notice.secondaryCtaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
