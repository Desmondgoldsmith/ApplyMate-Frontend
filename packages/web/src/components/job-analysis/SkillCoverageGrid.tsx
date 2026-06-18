'use client';

import type { JobAnalysis } from '@/lib/api';
import { SkillTierBadge } from '@/components/job-analysis/SkillTierBadge';
import { sortSkillCoverage } from '@/lib/skillCoverage';
import { cn } from '@/lib/utils';

export type SkillCoverageGridProps = {
  items: NonNullable<JobAnalysis['skillCoverage']>;
  className?: string;
};

/** Full posting skill inventory — Skill | On CV? | Importance. */
export function SkillCoverageGrid({ items, className }: SkillCoverageGridProps) {
  const sorted = sortSkillCoverage(items);
  if (sorted.length === 0) return null;

  return (
    <div className={cn('min-w-0', className)}>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
        Skill inventory
      </h3>
      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[280px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wide text-white/40">
              <th className="px-3 py-2 font-semibold">Skill</th>
              <th className="px-3 py-2 font-semibold">Tier</th>
              <th className="px-3 py-2 font-semibold">On CV?</th>
              <th className="px-3 py-2 font-semibold">Verbatim</th>
              <th className="px-3 py-2 font-semibold">Importance</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, index) => {
              const found = item.status === 'found';
              return (
                <tr
                  key={`${item.skill}-${index}`}
                  className="border-b border-white/[0.04] last:border-b-0"
                >
                  <td className="px-3 py-2 font-medium text-white/85">{item.skill}</td>
                  <td className="px-3 py-2">
                    <SkillTierBadge tier={item.tier} />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        found
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'bg-rose-500/15 text-rose-200',
                      )}
                    >
                      {found ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-white/55">
                    {item.foundLiterally === true
                      ? 'Yes'
                      : item.foundLiterally === false
                        ? 'No'
                        : 'n/a'}
                  </td>
                  <td className="px-3 py-2 text-white/55">{item.importance}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
