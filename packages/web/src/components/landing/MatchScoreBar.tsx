'use client';

import { useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export type MatchSkill = { name: string; matched: boolean };

type MatchScoreBarProps = {
  score: number;
  label?: string;
  skills?: MatchSkill[];
  className?: string;
  /** Larger type + bar for hero-style cards (e.g. final CTA) */
  size?: 'default' | 'featured';
};

export function MatchScoreBar({
  score,
  label,
  skills,
  className = '',
  size = 'default',
}: MatchScoreBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [displayed, setDisplayed] = useState(0);
  const featured = size === 'featured';

  useEffect(() => {
    if (!isInView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setDisplayed(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, score]);

  return (
    <div ref={ref} className={`w-full ${className}`}>
      <div className={`flex items-baseline justify-between ${featured ? 'mb-3.5' : 'mb-2.5'}`}>
        <span
          className={
            featured
              ? 'text-[13px] font-semibold uppercase tracking-[1.5px] text-[rgba(255,255,255,0.45)]'
              : 'text-[12px] uppercase tracking-[1px] text-[rgba(255,255,255,0.4)]'
          }
        >
          {label ?? 'Match Score'}
        </span>
        <span
          className={
            featured
              ? 'text-[40px] font-extrabold leading-none tracking-[-2px] text-white sm:text-[44px]'
              : 'text-[32px] font-extrabold leading-none tracking-[-1px] text-white'
          }
        >
          {displayed}
          <span
            className={
              featured
                ? 'text-[18px] font-bold text-[#00C9B1] sm:text-[20px]'
                : 'text-[16px] font-bold text-[#00C9B1]'
            }
          >
            %
          </span>
        </span>
      </div>

      <div
        className={`relative w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)] ${featured ? 'h-2.5' : 'h-1.5'}`}
      >
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-[#007A7B] via-[#00C9B1] to-[#00C9B1] transition-[width] duration-[1400ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: isInView ? `${score}%` : '0%' }}
        >
          <div
            className={`absolute top-1/2 right-[-1px] -translate-y-1/2 rounded-full bg-[#00C9B1] ${featured ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'}`}
            style={{
              boxShadow: featured
                ? '0 0 12px 4px rgba(0,212,212,0.55)'
                : '0 0 8px 3px rgba(0,212,212,0.6)',
            }}
            aria-hidden
          />
        </div>
      </div>

      {skills && skills.length > 0 ? (
        <div className={`flex flex-wrap ${featured ? 'mt-5 gap-2.5' : 'mt-4 gap-2'}`}>
          {skills.map((skill) => (
            <div
              key={skill.name}
              className={`flex items-center rounded-lg font-medium ${
                featured
                  ? 'gap-2 px-4 py-2 text-[13px]'
                  : 'gap-1.5 rounded-md px-3 py-1.5 text-[12px]'
              }`}
              style={{
                background: skill.matched
                  ? 'rgba(0,201,177,0.08)'
                  : 'rgba(255,100,50,0.08)',
                border: `1px solid ${skill.matched ? 'rgba(0,201,177,0.22)' : 'rgba(255,100,50,0.2)'}`,
                color: skill.matched
                  ? 'rgba(255,255,255,0.85)'
                  : 'rgba(255,150,100,0.85)',
              }}
            >
              <span
                className={`font-bold ${featured ? 'text-xs' : 'text-[11px]'}`}
                style={{ color: skill.matched ? '#00C9B1' : '#FF6432' }}
              >
                {skill.matched ? '✓' : '✗'}
              </span>
              {skill.name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
