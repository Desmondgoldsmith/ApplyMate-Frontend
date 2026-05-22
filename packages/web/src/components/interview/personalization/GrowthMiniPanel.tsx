'use client';

import { ChevronDown } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import {
  GROWTH_SKILL_KEYS,
  growthSkillLabel,
  highlightedTrend,
  topWeaknessKey,
  type GrowthSkillKey,
} from '@/lib/interviewPersonalization';
import type { SkillScores, SkillTrend } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

function SkillBar({
  label,
  value,
  pulseWeak,
  improvedGlow,
}: {
  label: string;
  value: number;
  pulseWeak?: boolean;
  improvedGlow?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary)]">{pct}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-surface-2)]">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pulseWeak ? 'bg-amber-400/80 ip-weakness-pulse' : 'bg-[var(--teal)]/70',
            improvedGlow && !pulseWeak && 'ip-skill-improve-glow',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export const GrowthMiniPanel = memo(function GrowthMiniPanel({
  skills,
  improvementTrend,
  weaknessTrend,
  topWeaknesses,
  className,
  defaultExpanded = false,
}: {
  skills: SkillScores | null;
  improvementTrend?: SkillTrend;
  weaknessTrend?: SkillTrend;
  topWeaknesses?: string[];
  className?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const trend = useMemo(
    () => highlightedTrend(improvementTrend, weaknessTrend),
    [improvementTrend, weaknessTrend],
  );
  const pulseKey = useMemo(() => topWeaknessKey(topWeaknesses), [topWeaknesses]);

  if (!skills) return null;

  const improving =
    improvementTrend === 'improving' || weaknessTrend === 'improving';

  return (
    <section
      className={cn('border-b border-[var(--border-subtle)] px-5 py-3', className)}
      aria-label="Your growth"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="ip-section-label">Your Growth</p>
          {!expanded ? (
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              Clarity · Structure · Depth · Confidence
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              trend.tone,
            )}
            title={trend.label}
          >
            <span aria-hidden>{trend.icon}</span>
            <span className="sr-only">{trend.label}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-90',
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-2.5">
            {GROWTH_SKILL_KEYS.map((key) => (
              <SkillBar
                key={key}
                label={growthSkillLabel(key)}
                value={skills[key as GrowthSkillKey] ?? 0}
                pulseWeak={pulseKey === key}
                improvedGlow={improving && pulseKey !== key}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
