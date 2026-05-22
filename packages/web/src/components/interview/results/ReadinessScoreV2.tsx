'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

import { useMotionSafe } from '@/hooks/useMotionSafe';
import type { ReadinessBreakdown } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const ROWS: Array<{ key: keyof ReadinessBreakdown; label: string }> = [
  { key: 'communication', label: 'Communication' },
  { key: 'structure', label: 'Structure' },
  { key: 'relevance', label: 'Relevance' },
  { key: 'improvementTrend', label: 'Improvement trend' },
  { key: 'confidenceProxy', label: 'Confidence' },
];

export const ReadinessScoreV2 = memo(function ReadinessScoreV2({
  readinessScore,
  breakdown,
  className,
}: {
  readinessScore?: number;
  breakdown?: ReadinessBreakdown | null;
  className?: string;
}) {
  const reduceMotion = useMotionSafe();
  if (!breakdown && readinessScore == null) return null;

  const score = readinessScore != null ? Math.round(readinessScore) : null;

  return (
    <section
      className={cn('rounded-2xl border border-white/10 bg-[#0C0F0F] p-4 sm:p-5', className)}
      aria-labelledby="readiness-v2-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="readiness-v2-heading" className="text-sm font-semibold text-white">
            Readiness score
          </h3>
          <p className="mt-1 text-xs text-white/50">Weighted across communication, structure, and trend.</p>
        </div>
        {score != null ? (
          <p className="text-3xl font-black tabular-nums text-[#00C9B1]">{score}</p>
        ) : null}
      </div>
      {breakdown ? (
        <div className="mt-4 space-y-3">
          {ROWS.map((row, i) => {
            const value = Math.max(0, Math.min(100, Math.round(breakdown[row.key])));
            return (
              <div key={row.key} className="grid grid-cols-[minmax(0,120px)_1fr_40px] items-center gap-2 sm:grid-cols-[140px_1fr_44px]">
                <span className="truncate text-xs text-white/60">{row.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  {reduceMotion ? (
                    <div className="h-full rounded-full bg-[#00C9B1]" style={{ width: `${value}%` }} />
                  ) : (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.45, delay: i * 0.05 }}
                      className="h-full rounded-full bg-[#00C9B1]"
                    />
                  )}
                </div>
                <span className="text-right text-xs font-semibold tabular-nums text-white/75">{value}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
});
