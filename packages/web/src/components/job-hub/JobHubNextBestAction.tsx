'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { HubNextAction } from '@/lib/jobHubNextAction';

export function JobHubNextBestAction({ action }: { action: HubNextAction | null }) {
  if (!action) return null;

  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#00C9B1]/80">
          Next best action
        </p>
        <p className="mt-1 text-[15px] font-semibold text-white">{action.label}</p>
        <p className="mt-1 text-[13px] leading-snug text-white/55">{action.detail}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-[#00C9B1]" aria-hidden />
    </>
  );

  const className =
    'flex items-center gap-4 rounded-2xl border border-[#00C9B1]/25 bg-gradient-to-r from-[#00C9B1]/10 to-transparent p-4 transition hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/[0.08]';

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
