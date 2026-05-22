'use client';

import { Flag, Map, Zap } from 'lucide-react';

import type { DashboardContinuationView } from '@/lib/dashboardViewModel';

export function ExecutionTimeline({ continuation }: { continuation: DashboardContinuationView }) {
  const idx = continuation.continuationContext?.exactStepIndex;
  const total = continuation.continuationContext?.totalSteps;
  const stepLabel = continuation.continuationContext?.exactStepLabel?.trim() || null;
  const has =
    typeof idx === 'number' &&
    Number.isFinite(idx) &&
    typeof total === 'number' &&
    Number.isFinite(total) &&
    total > 0 &&
    idx >= 0;
  if (!has) return null;
  const current = Math.min(total!, Math.max(1, idx! + 1));
  const done = Math.max(0, current - 1);
  const remaining = Math.max(0, total! - current);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-white/42">Steps</p>
        <span className="text-[11px] text-white/38">
          Part {current} of {total}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
          <p className="flex items-center gap-1 text-[10px] text-white/38">
            <Flag className="h-3.5 w-3.5 text-white/30" aria-hidden />
            Behind you
          </p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-white/85">{done}</p>
        </div>
        <div className="rounded-lg border border-[#00C9B1]/14 bg-[#00C9B1]/[0.05] p-2.5">
          <p className="flex items-center gap-1 text-[10px] text-white/50">
            <Zap className="h-3.5 w-3.5 text-[#00C9B1]/75" aria-hidden />
            Now
          </p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-white">{current}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
          <p className="flex items-center gap-1 text-[10px] text-white/38">
            <Map className="h-3.5 w-3.5 text-white/30" aria-hidden />
            Ahead
          </p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-white/85">{remaining}</p>
        </div>
      </div>
      {stepLabel ? (
        <p className="mt-3 text-[12px] text-white/48">
          Next up: <span className="text-white/70">{stepLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
