'use client';

import { motion, useInView } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type Skill = { name: string; matched: boolean };

/** Illustrative framing only — not a labor-market percentile; maps fit score to a readable “vs generic CV” band. */
function illustrativeEdgeVsGenericApplicants(fit: number): number {
  const x = Math.max(0, Math.min(100, fit));
  return Math.min(92, Math.max(52, Math.round(52 + x * 0.38)));
}

type MatchScoreBarProps = {
  score: number;
  label?: string;
  skills?: Skill[];
  /** Pre-tailor match — shown above the bar when tailoring improved the score. */
  scoreBeforeTailor?: number | null;
  /** When true, show before → after row when `scoreBeforeTailor` is set (even if rematch is flat or down). */
  isTailored?: boolean;
};

export function MatchScoreBar({
  score,
  label = 'Match score',
  skills = [],
  scoreBeforeTailor,
  isTailored,
}: MatchScoreBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const [displayScore, setDisplayScore] = useState(0);
  const safeScore =
    typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;

  const tierBarClass =
    safeScore >= 70
      ? 'bg-gradient-to-r from-[#00C9B1] via-[#10B981] to-[#34d399]'
      : safeScore >= 40
        ? 'bg-gradient-to-r from-[#00C9B1] via-[#F59E0B] to-[#fbbf24]'
        : 'bg-gradient-to-r from-[#00C9B1] via-[#EF4444] to-[#f87171]';

  const interpretation =
    safeScore >= 70 ? 'Strong match' : safeScore >= 40 ? 'Partial match' : 'Low match';
  const interpretationClass =
    safeScore >= 70 ? 'text-[#00C9B1]' : safeScore >= 40 ? 'text-[#F59E0B]' : 'text-[#EF4444]';

  const before =
    scoreBeforeTailor != null && Number.isFinite(scoreBeforeTailor)
      ? Math.max(0, Math.min(100, scoreBeforeTailor))
      : null;
  const showImprovement =
    before !== null &&
    Number.isFinite(before) &&
    (Boolean(isTailored) || Math.round(before) !== Math.round(safeScore));
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1400;
    const next = safeScore;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setDisplayScore(Math.round(next * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, safeScore]);

  return (
    <div ref={ref} className="min-w-0 space-y-4">
      {showImprovement && before !== null ? (
        <div className="mb-4 min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">Score Change</p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="shrink-0 text-xl font-bold text-white/60">{Math.round(before)}%</span>
            <span className="shrink-0 text-white/30">→</span>
            <span
              className={cn(
                'shrink-0 text-2xl font-bold',
                safeScore > before ? 'text-[#00C9B1]' : safeScore === before ? 'text-white/60' : 'text-amber-400',
              )}
            >
              {Math.round(safeScore)}%
            </span>
            <span
              className={cn(
                'max-w-full break-words rounded-full px-2.5 py-1 text-xs font-semibold',
                safeScore > before
                  ? 'bg-[#00C9B1]/15 text-[#00C9B1]'
                  : safeScore === before
                    ? 'bg-white/[0.06] text-white/40'
                    : 'bg-amber-500/10 text-amber-400',
              )}
            >
              {safeScore > before
                ? `+${Math.round(safeScore - before)}% job fit`
                : safeScore === before
                  ? 'No change'
                  : `${Math.round(safeScore - before)}% job fit`}
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/42">
            On this rubric, your CV reads as roughly{' '}
            <span className="font-semibold text-white/65">
              stronger than {illustrativeEdgeVsGenericApplicants(safeScore)}% of untailored applications
            </span>{' '}
            scored against the same posting (generic CVs that were not tuned to this job text). Illustrative model
            output — not a hiring guarantee or third-party survey.
          </p>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
          <p className="mt-2 max-w-md text-[12px] leading-relaxed text-white/45">
            {interpretation} — scores reflect how your CV lines up with this role&apos;s description.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:items-end">
          <p className="text-[22px] font-bold tabular-nums leading-none sm:text-2xl">
            <span className={interpretationClass}>{displayScore}</span>
            <span className="ml-0.5 text-sm font-semibold text-white/50 sm:text-base">%</span>
          </p>
          <p className={cn('text-[11px] font-medium', interpretationClass)}>{interpretation}</p>
        </div>
      </div>
      <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className={cn('relative h-full rounded-full', tierBarClass)}
          initial={{ width: '0%' }}
          animate={{ width: inView ? `${safeScore}%` : '0%' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(0,201,177,0.45)]" />
        </motion.div>
      </div>
      {skills.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">Gaps to address</p>
          <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className={
                skill.matched
                  ? 'inline-flex items-center gap-1.5 rounded-full border border-[#00C9B1]/25 bg-[rgba(0,201,177,0.08)] px-3 py-1.5 text-[12px] font-medium text-[#00C9B1]'
                  : 'inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5 text-[12px] font-medium text-[rgba(239,68,68,0.9)]'
              }
            >
              {skill.matched ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-[#00C9B1]" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-[#EF4444]" strokeWidth={2.5} />
              )}
              {skill.name}
            </div>
          ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
