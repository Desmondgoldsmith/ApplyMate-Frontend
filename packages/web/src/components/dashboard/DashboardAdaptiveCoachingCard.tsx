'use client';

import Link from 'next/link';

import type { AdaptiveCoachingCategory, AdaptiveCoachingPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  data: AdaptiveCoachingPayload;
};

function accentClass(category: AdaptiveCoachingCategory | null): string {
  switch (category) {
    case 'interview_momentum':
      return 'border-[#00C9B1]/35 bg-gradient-to-br from-[#00C9B1]/[0.12] to-white/[0.02] shadow-[0_0_40px_-12px_rgba(0,201,177,0.35)]';
    case 'application_acceleration':
      return 'border-amber-400/25 bg-gradient-to-br from-amber-400/[0.07] to-white/[0.02]';
    case 'follow_up_opportunity':
      return 'border-violet-400/22 bg-gradient-to-br from-violet-400/[0.08] to-white/[0.02]';
    case 'cv_strengthening':
      return 'border-sky-400/25 bg-gradient-to-br from-sky-400/[0.07] to-white/[0.02]';
    case 'pipeline_recovery':
      return 'border-orange-400/22 bg-gradient-to-br from-orange-400/[0.07] to-white/[0.02]';
    case 'confidence_boost':
      return 'border-emerald-400/18 bg-gradient-to-br from-emerald-400/[0.06] to-white/[0.02]';
    default:
      return 'border-white/[0.06] bg-white/[0.025]';
  }
}

export function DashboardAdaptiveCoachingCard({ data }: Props) {
  const headline = data.headline?.trim() || '';
  const supporting = data.supporting?.trim() || '';
  const ctaLabel = data.ctaLabel?.trim() || '';
  const ctaHref = data.ctaHref?.trim() || '';

  if (!headline || !supporting || !ctaLabel || !ctaHref) return null;

  return (
    <section
      className={cn(
        'rounded-2xl border p-5 sm:p-6',
        accentClass(data.category),
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-white/38">Adaptive Coaching</p>
          <p className="mt-2 text-[15px] font-medium leading-snug text-white/88">{headline}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">{supporting}</p>
        </div>
        <Link
          href={ctaHref}
          className={cn(
            'inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]',
          )}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
