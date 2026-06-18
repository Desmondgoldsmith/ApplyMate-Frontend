'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import type { JobAnalysisV2 } from '@/lib/api';
import {
  formatInterviewRiskLine,
  isLegacyGapListInterviewRisk,
  parseAttackPlanLine,
} from '@/lib/attackPlanDisplay';
import { cn } from '@/lib/utils';

type SectionKey = 'fixes' | 'risks' | 'evidence' | 'salary';

const TONE_CLASS: Record<
  ReturnType<typeof parseAttackPlanLine>['tone'],
  string
> = {
  gap: 'border-rose-500/25 bg-rose-500/[0.06]',
  exposure: 'border-amber-500/25 bg-amber-500/[0.06]',
  pivot: 'border-sky-500/25 bg-sky-500/[0.06]',
  technical: 'border-violet-500/25 bg-violet-500/[0.06]',
  default: 'border-white/[0.08] bg-white/[0.02]',
};

const HEADLINE_CLASS: Record<
  ReturnType<typeof parseAttackPlanLine>['tone'],
  string
> = {
  gap: 'text-rose-200',
  exposure: 'text-amber-200',
  pivot: 'text-sky-200',
  technical: 'text-violet-200',
  default: 'text-white/85',
};

function InterviewPrepItem({ line, index }: { line: string; index: number }) {
  const text = formatInterviewRiskLine(line);
  if (!text) return null;

  return (
    <li className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200/80">
        Prep {index + 1}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-white/72">{text}</p>
    </li>
  );
}

function AttackPlanItem({ line }: { line: string }) {
  if (isLegacyGapListInterviewRisk(line)) {
    return (
      <li className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
        <p className="text-[12px] leading-relaxed text-white/68">
          {formatInterviewRiskLine(line)}
        </p>
      </li>
    );
  }

  const parsed = parseAttackPlanLine(line);
  const hasChips = parsed.chips.length > 0;

  return (
    <li
      className={cn(
        'rounded-xl border px-3.5 py-3',
        TONE_CLASS[parsed.tone],
      )}
    >
      {parsed.headline ? (
        <p className={cn('text-[12px] font-semibold leading-snug', HEADLINE_CLASS[parsed.tone])}>
          {parsed.headline}
        </p>
      ) : null}
      {parsed.body && !hasChips ? (
        <div className={parsed.headline ? 'mt-1.5 space-y-1.5' : 'space-y-1.5'}>
          {parsed.body
            .split(/(?<=[.!?])\s+/)
            .map((sentence) => sentence.trim())
            .filter(Boolean)
            .map((sentence, index) => (
              <p key={`${sentence}-${index}`} className="text-[12px] leading-relaxed text-white/68">
                {sentence}
              </p>
            ))}
        </div>
      ) : null}
      {hasChips ? (
        <div className={cn('flex flex-wrap gap-1.5', parsed.headline ? 'mt-2' : '')}>
          {parsed.chips.map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium leading-snug',
                parsed.tone === 'gap' || parsed.tone === 'exposure'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
                  : 'border-white/12 bg-white/[0.04] text-white/75',
              )}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function CollapsibleSection({
  id,
  title,
  emoji,
  items,
  defaultOpen,
  variant = 'default',
}: {
  id: SectionKey;
  title: string;
  emoji: string;
  items: string[];
  defaultOpen?: boolean;
  variant?: 'default' | 'interviewPrep';
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
          {items.map((item, index) =>
            variant === 'interviewPrep' ? (
              <InterviewPrepItem key={`${id}-${index}`} line={item} index={index} />
            ) : (
              <AttackPlanItem key={`${id}-${index}`} line={item} />
            ),
          )}
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
      <CollapsibleSection
        id="risks"
        emoji="⚠️"
        title="Interview prep"
        items={attackPlan.interviewRisks}
        variant="interviewPrep"
      />
      <CollapsibleSection id="evidence" emoji="🧩" title="Missing evidence" items={attackPlan.missingEvidence} />
      {salaryLine ? (
        <CollapsibleSection id="salary" emoji="💰" title="Salary range" items={[salaryLine]} defaultOpen />
      ) : null}
    </section>
  );
}
