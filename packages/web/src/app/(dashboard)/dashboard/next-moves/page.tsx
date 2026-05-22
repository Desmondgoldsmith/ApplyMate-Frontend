'use client';

import { ArrowRight, Compass } from 'lucide-react';
import Link from 'next/link';

import { GlowCard } from '@/components/ui/GlowCard';

/**
 * Landing route for weekly stall digest (and other emails) deep links.
 * Keeps a stable URL while product evolves toward a full “next moves” feed.
 */
export default function NextMovesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#00C9B1]">
          <Compass className="h-3.5 w-3.5" aria-hidden />
          Next moves
        </div>
        <h1 className="text-2xl font-extrabold text-white">Your priorities</h1>
        <p className="mt-2 text-sm text-white/50">
          This page is the destination for digest emails. Review stalled roles on Job Hub and today&apos;s plan on your
          dashboard.
        </p>
      </div>

      <GlowCard contentClassName="p-6">
        <p className="text-sm font-semibold text-white">Continue in the app</p>
        <p className="mt-1 text-xs text-white/45">
          Weekly stall summaries send Monday 09:00 UTC when you opt in under Settings → Notifications.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00C9B1] px-4 py-2.5 text-sm font-semibold text-[#080A0A] transition-all hover:bg-[#00C9B1]/90"
          >
            Open Job Hub
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.02] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/10"
          >
            Dashboard
          </Link>
        </div>
      </GlowCard>
    </div>
  );
}
