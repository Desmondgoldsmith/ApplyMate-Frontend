'use client';

import Link from 'next/link';

import { CompanyLogo } from '@/components/ui/CompanyLogo';
import type { InterviewPreparationCardPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  cards: InterviewPreparationCardPayload[];
  totalCount?: number | null;
};

const DASHBOARD_INTERVIEW_PREP_HOME_CAP = 2;

/** Horizontal strip of server-validated interview prep CTAs (uses {@link InterviewPreparationCardPayload.ctaHref} verbatim). */
export function DashboardInterviewPreparationSection({ cards, totalCount }: Props) {
  if (!cards.length) return null;

  const visible = cards.slice(0, DASHBOARD_INTERVIEW_PREP_HOME_CAP);
  const total =
    typeof totalCount === 'number' && Number.isFinite(totalCount)
      ? Math.max(0, Math.round(totalCount))
      : cards.length;
  const showViewAll = total > DASHBOARD_INTERVIEW_PREP_HOME_CAP;

  return (
    <section aria-label="Interview prep cards" className="scroll-mt-4 min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-white/90">More interview prep</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            Additional prep prompts from your pipeline.
          </p>
        </div>
        {showViewAll ? (
          <Link
            href="/dashboard/interview-prep"
            className="inline-flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium leading-snug text-[var(--text-teal)] transition-opacity hover:opacity-80 hover:underline"
          >
            <span>View all →</span>
          </Link>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-3 max-[480px]:flex-col sm:flex-row sm:gap-3 sm:overflow-x-auto sm:pb-1 max-sm:[-ms-overflow-style:none] max-sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
        {visible.map((card, idx) => {
          const company = card.company?.trim() || '';
          const role = card.roleTitle?.trim() || '';
          const meta = [company, role].filter(Boolean).join(' · ');
          return (
            <div
              key={`${card.ctaHref}-${idx}`}
              className={cn(
                'flex min-h-[44px] min-w-[min(100%,280px)] shrink-0 flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 ring-1 ring-white/[0.04] max-[480px]:min-w-full sm:p-4',
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                {company ? (
                  <CompanyLogo company={company} logoUrl={card.companyLogoUrl} size="md" shape="rounded" />
                ) : null}
                <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug text-white/90 max-[480px]:line-clamp-2 max-[480px]:whitespace-normal">{card.headline}</p>
                {card.supporting?.trim() ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-white/48">{card.supporting.trim()}</p>
                ) : null}
                {meta ? <p className="mt-2 text-[12px] font-medium text-[rgba(240,244,242,0.60)]">{meta}</p> : null}
                </div>
              </div>
              <Link
                href={card.ctaHref}
                className="inline-flex min-h-[44px] w-full max-[480px]:w-full items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
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
