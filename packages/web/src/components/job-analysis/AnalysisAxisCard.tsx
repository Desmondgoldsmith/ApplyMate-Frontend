'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

function tierClass(score: number): string {
  if (score >= 78) return 'from-[#00C9B1] via-[#10B981] to-[#34d399]';
  if (score >= 55) return 'from-[#00C9B1] via-[#F59E0B] to-[#fbbf24]';
  return 'from-[#00C9B1] via-[#EF4444] to-[#f87171]';
}

export function AnalysisAxisCard({
  label,
  score,
  tooltip,
}: {
  label: string;
  score: number;
  tooltip: string;
}) {
  const [showTip, setShowTip] = useState(false);
  const safe = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-white/85">{label}</p>
        <div className="relative">
          <button
            type="button"
            className="rounded-md p-0.5 text-white/35 transition hover:bg-white/[0.06] hover:text-white/70"
            aria-label={`About ${label}`}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onFocus={() => setShowTip(true)}
            onBlur={() => setShowTip(false)}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
          {showTip ? (
            <div
              role="tooltip"
              className="absolute right-0 top-full z-20 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#0C0F0F] px-2.5 py-2 text-[11px] leading-relaxed text-white/65 shadow-lg"
            >
              {tooltip}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[20px] font-bold tabular-nums text-white">{safe}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', tierClass(safe))}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}
