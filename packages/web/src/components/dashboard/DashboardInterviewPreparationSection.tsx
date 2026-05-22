'use client';

import Link from 'next/link';

import type { InterviewPreparationCardPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  cards: InterviewPreparationCardPayload[];
};

/** Horizontal strip of server-validated interview prep CTAs (uses {@link InterviewPreparationCardPayload.ctaHref} verbatim). */
export function DashboardInterviewPreparationSection({ cards }: Props) {
  if (!cards.length) return null;

  return (
    <section aria-label="Interview preparation" className="scroll-mt-4 min-w-0">
      <h2 className="text-[16px] font-semibold text-white/90">Interview preparation</h2>
      <p className="mt-1 text-[12px] font-medium text-white/38">
        Pick up prep for roles you&apos;ve applied to or are actively interviewing for — routes are validated
        server-side.
      </p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card, idx) => {
          const company = card.company?.trim() || '';
          const role = card.roleTitle?.trim() || '';
          const meta = [company, role].filter(Boolean).join(' · ');
          return (
            <div
              key={`${card.ctaHref}-${idx}`}
              className={cn(
                'flex min-w-[min(100%,280px)] shrink-0 flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 ring-1 ring-white/[0.04]',
              )}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-snug text-white/90">{card.headline}</p>
                {card.supporting?.trim() ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-white/48">{card.supporting.trim()}</p>
                ) : null}
                {meta ? <p className="mt-2 text-[11px] font-medium text-white/35">{meta}</p> : null}
              </div>
              <Link
                href={card.ctaHref}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
              >
                {card.ctaLabel}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
