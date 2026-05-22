'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

function scoreHue(score: number | null): { stroke: string; text: string } {
  if (score === null || Number.isNaN(score)) {
    return { stroke: 'rgba(255,255,255,0.35)', text: 'text-white/45' };
  }
  if (score >= 70) return { stroke: '#00C9B1', text: 'text-[#00C9B1]' };
  if (score >= 40) return { stroke: '#F59E0B', text: 'text-[#F59E0B]' };
  return { stroke: '#EF4444', text: 'text-[#EF4444]' };
}

type MatchScoreRingProps = {
  score: number | null;
  size?: number;
  stroke?: number;
  /** Show "—" when null */
  className?: string;
  label?: string;
  /** `percent` = match-style % label; `score` = CV-style out of 100 (no % sign). */
  unit?: 'percent' | 'score';
};

/**
 * Circular progress ring for match / CV scores. Animates stroke once unless reduced motion.
 */
export function MatchScoreRing({
  score,
  size = 32,
  stroke: strokeWidth = 2,
  className,
  label,
  unit = 'percent',
}: MatchScoreRingProps) {
  const r = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const c = 2 * Math.PI * r;
  const pct = score !== null && Number.isFinite(score) ? Math.min(100, Math.max(0, score)) / 100 : 0;
  const { stroke, text } = scoreHue(score);
  const [offset, setOffset] = useState(c);
  const reducedMotion = useRef(false);

  useEffect(() => {
    try {
      reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reducedMotion.current = false;
    }
  }, []);

  useEffect(() => {
    const target = c * (1 - pct);
    if (reducedMotion.current) {
      setOffset(target);
      return;
    }
    setOffset(c);
    const t0 = performance.now();
    const dur = 800;
    let id: number;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - (1 - p) ** 2;
      setOffset(c + (target - c) * ease);
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [c, pct]);

  const display =
    score !== null && Number.isFinite(score) ? `${Math.round(score)}` : '—';
  const fs = size >= 44 ? 12 : 9;
  const showPct = unit === 'percent' && score !== null && Number.isFinite(score);

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-label={label ?? (score != null ? `Match score ${Math.round(score)} percent` : 'No score')}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-75"
        />
      </svg>
      <span
        className={cn('pointer-events-none absolute font-bold tabular-nums leading-none', text)}
        style={{ fontSize: fs }}
      >
        {display}
        {showPct ? <span className="text-[0.65em] font-semibold opacity-80">%</span> : null}
      </span>
    </div>
  );
}
