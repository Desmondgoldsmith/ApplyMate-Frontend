'use client';

import { ArrowRight, Check, Crown, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';

import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { cn } from '@/lib/utils';

const perks = ['Unlimited AI analyses & cover letters', 'Priority matching & insights', 'Full history & exports'];

/**
 * Premium upsell card for the dashboard sidebar (links to marketing pricing).
 */
export function DashboardUpgradeCard({ className }: { className?: string }) {
  const usage = useDailyAiUsage();
  const isPaid = usage.isPaidTier && !usage.isLoading;
  const atFreeCap =
    !usage.isPaidTier && !usage.isLoading && usage.limit != null && (usage.remaining ?? 0) === 0;

  return (
    <div
      data-tour="upgrade-card"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[rgba(0,201,177,0.35)] p-px shadow-[0_0_40px_-12px_rgba(0,201,177,0.35)]',
        className,
      )}
    >
      <div
        className="relative overflow-hidden rounded-[15px] px-5 py-6 sm:px-6 sm:py-7"
        style={{
          background:
            'linear-gradient(145deg, rgba(0,201,177,0.14) 0%, rgba(8,12,12,0.98) 42%, rgba(6,10,10,0.99) 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(0,201,177,0.35) 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full opacity-35"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)' }}
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,201,177,0.15)] ring-1 ring-[#00C9B1]/30">
              <Crown className="h-5 w-5 text-[#00C9B1]" strokeWidth={1.75} aria-hidden />
            </div>
            {atFreeCap ? (
              <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100/95">
                Limit reached
              </span>
            ) : null}
          </div>

          <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-white">
            {isPaid ? "You're on Pro" : 'Unlock ApplyMate Pro'}
          </h3>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-white/55">
            {isPaid
              ? 'Enjoy unlimited AI, deeper match insights, and faster workflows. Thank you for supporting ApplyMate.'
              : 'Lift daily caps, go deeper on every job, and keep momentum when it matters most.'}
          </p>

          {!isPaid ? (
            <ul className="mt-5 space-y-2.5">
              {perks.map((line) => (
                <li key={line} className="flex gap-2.5 text-[12px] font-medium text-white/70">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00C9B1]/15 text-[#00C9B1]">
                    <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {!isPaid ? (
              <Link
                href="/#pricing"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#00C9B1] px-4 py-3 text-[14px] font-semibold text-[#080A0A] shadow-[0_4px_24px_-4px_rgba(0,201,177,0.55)] transition-transform duration-150 hover:bg-[#33d4c2] active:scale-[0.99] sm:flex-initial"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Compare plans
                <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-medium text-white/60">
                <Zap className="h-4 w-4 text-[#00C9B1]" aria-hidden />
                Active subscription
              </span>
            )}
          </div>

          {!isPaid ? (
            <p className="mt-3 text-center text-[11px] font-medium text-white/35">
              Secure checkout · Cancel anytime
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
