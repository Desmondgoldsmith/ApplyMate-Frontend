'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import type { JobAnalysisV2 } from '@/lib/api';
import { cn } from '@/lib/utils';

type SectionKey = 'fixes' | 'risks' | 'evidence' | 'salary';

function CollapsibleSection({
  id,
  title,
  emoji,
  items,
  defaultOpen,
}: {
  id: SectionKey;
  title: string;
  emoji: string;
  items: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? items.length > 0);
  if (items.length === 0 && id !== 'salary') return null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[13px] font-semibold text-white/90">
          <span className="mr-1.5" aria-hidden>
            {emoji}
          </span>
          {title}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/40 transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-white/[0.06] px-4 py-3">
          {items.map((item) => (
            <li key={item} className="text-[13px] leading-relaxed text-white/65">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AttackPlanPanel({ attackPlan }: { attackPlan: JobAnalysisV2['attackPlan'] }) {
  const salaryLine = attackPlan.salaryRange?.trim();
  const hasContent =
    attackPlan.topCVFixes.length > 0 ||
    attackPlan.interviewRisks.length > 0 ||
    attackPlan.missingEvidence.length > 0 ||
    Boolean(salaryLine);

  if (!hasContent) return null;

  return (
    <section className="space-y-2" aria-labelledby="attack-plan-heading">
      <h3 id="attack-plan-heading" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
        Attack plan
      </h3>
      <CollapsibleSection
        id="fixes"
        emoji="🔥"
        title="Top CV fixes"
        items={attackPlan.topCVFixes}
        defaultOpen
      />
      <CollapsibleSection id="risks" emoji="⚠️" title="Interview risks" items={attackPlan.interviewRisks} />
      <CollapsibleSection id="evidence" emoji="🧩" title="Missing evidence" items={attackPlan.missingEvidence} />
      {salaryLine ? (
        <CollapsibleSection id="salary" emoji="💰" title="Salary range" items={[salaryLine]} defaultOpen />
      ) : null}
    </section>
  );
}
