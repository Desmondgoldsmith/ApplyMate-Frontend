'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import type { InterviewImprovementPlan } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const MODE_LABELS: Record<string, string> = {
  behavioral_star: 'STAR practice',
  quick_practice: 'Quick practice',
  full_mock: 'Full mock interview',
  weakness_focus: 'Weakness focus',
};

export const ImprovementPlanCard = memo(function ImprovementPlanCard({
  plan,
  sessionId,
  className,
}: {
  plan: InterviewImprovementPlan | null | undefined;
  sessionId: string;
  className?: string;
}) {
  const router = useRouter();
  if (!plan?.items?.length) return null;

  const sorted = [...plan.items].sort((a, b) => a.priority - b.priority);
  const modeLabel = MODE_LABELS[plan.suggestedMode] ?? plan.suggestedMode.replace(/_/g, ' ');

  return (
    <section
      className={cn('rounded-2xl border border-[#00C9B1]/20 bg-[#00C9B1]/5 p-4 sm:p-5', className)}
      aria-labelledby="improvement-plan-heading"
    >
      <h3 id="improvement-plan-heading" className="text-sm font-semibold text-white">
        Your improvement plan
      </h3>
      <p className="mt-1 text-xs text-white/55">Recommended next: {modeLabel}</p>
      <ol className="mt-4 space-y-2">
        {sorted.map((item) => (
          <li
            key={`${item.weakness}-${item.priority}`}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
          >
            <p className="text-xs font-semibold text-[#00C9B1]/90">{item.weakness}</p>
            <p className="mt-1 text-sm text-white/80">{item.action}</p>
          </li>
        ))}
      </ol>
      <Button
        className="mt-4 w-full sm:w-auto"
        onClick={() =>
          router.push(
            `/dashboard/interview?focusWeakness=1&fromSession=${sessionId}&suggestedMode=${encodeURIComponent(plan.suggestedMode)}`,
          )
        }
      >
        Practice again with focus on weakness
      </Button>
    </section>
  );
});
