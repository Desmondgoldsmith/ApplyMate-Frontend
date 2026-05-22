'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api, type ApplyStrategy } from '@/lib/api';
import { cn } from '@/lib/utils';

const STRATEGY_COPY: Record<
  Exclude<ApplyStrategy, 'SKIP'>,
  { primary: string; detail: string }
> = {
  APPLY_NOW: {
    primary: 'Apply now',
    detail: 'Your profile is competitive — prioritize this application.',
  },
  TAILOR_FIRST: {
    primary: 'Tailor first',
    detail: 'Close the gaps below, then apply with a stronger CV.',
  },
};

function strategyToDecision(strategy: ApplyStrategy): 'APPLY' | 'MAYBE' | 'SKIP' {
  if (strategy === 'APPLY_NOW') return 'APPLY';
  if (strategy === 'SKIP') return 'SKIP';
  return 'MAYBE';
}

export function ApplyStrategyBlock({
  strategy,
  jobListingId,
  applyUrl,
  isTailored = false,
  onTailorFirst,
  onApplyNow,
}: {
  strategy: ApplyStrategy;
  jobListingId?: string | null;
  /** When set, Apply now opens this URL in a new tab. Button hidden if missing. */
  applyUrl?: string | null;
  /** After tailoring — disable “Tailor first”. */
  isTailored?: boolean;
  onTailorFirst?: () => void;
  onApplyNow?: () => void;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState<ApplyStrategy | null>(null);

  const displayStrategy: Exclude<ApplyStrategy, 'SKIP'> =
    strategy === 'SKIP' || strategy === 'APPLY_NOW' ? 'APPLY_NOW' : strategy;

  const copy = isTailored && displayStrategy === 'TAILOR_FIRST'
    ? {
        primary: 'Apply now',
        detail: 'You have tailored your CV for this role — apply when you are ready.',
      }
    : STRATEGY_COPY[displayStrategy];

  const record = useMutation({
    mutationFn: async (picked: ApplyStrategy) => {
      const listingId = jobListingId?.trim();
      if (!listingId) return { skipped: true as const };
      await api.jobDiscovery.recordDecision(listingId, strategyToDecision(picked));
      return { skipped: false as const };
    },
    onSuccess: (_data, picked) => {
      setSaved(picked);
    },
    onError: () => {
      toast.error('Could not save your decision. Try again.');
    },
  });

  const runStrategy = useCallback(
    (picked: 'APPLY_NOW' | 'TAILOR_FIRST') => {
      if (picked === 'TAILOR_FIRST') {
        void record.mutateAsync('TAILOR_FIRST').finally(() => onTailorFirst?.());
        return;
      }
      void record.mutateAsync('APPLY_NOW').finally(() => onApplyNow?.());
    },
    [record, onTailorFirst, onApplyNow],
  );

  const tailorDisabled = isTailored || record.isPending;

  return (
    <section
      className="rounded-2xl border border-[#00C9B1]/20 bg-[#00C9B1]/[0.05] p-4 sm:p-5"
      aria-labelledby="apply-strategy-heading"
    >
      <h3 id="apply-strategy-heading" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
        Recommended next step
      </h3>
      <p className="mt-2 text-[14px] font-semibold text-white">{copy.primary}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/55">{copy.detail}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {applyUrl?.trim() ? (
          <Button
            type="button"
            className={cn(
              'min-h-[44px] rounded-lg px-4 text-[13px] font-semibold',
              displayStrategy === 'APPLY_NOW' || isTailored
                ? 'bg-[#00C9B1] text-[#080A0A] hover:brightness-105'
                : 'border border-white/15 bg-white/[0.04] text-white/80',
            )}
            disabled={record.isPending}
            onClick={() => runStrategy('APPLY_NOW')}
          >
            {record.isPending && record.variables === 'APPLY_NOW' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            Apply on company site
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'min-h-[44px] rounded-lg border px-4 text-[13px] font-semibold',
            displayStrategy === 'TAILOR_FIRST' && !isTailored
              ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
              : 'border-white/15 text-white/75',
            tailorDisabled && 'cursor-not-allowed opacity-45',
          )}
          disabled={tailorDisabled}
          title={isTailored ? 'You have already tailored your CV for this role' : undefined}
          onClick={() => runStrategy('TAILOR_FIRST')}
        >
          Tailor first
        </Button>
      </div>
      {isTailored ? (
        <p className="mt-2 text-[11px] text-white/40">Tailoring complete for this role.</p>
      ) : null}
      {saved ? (
        <p className="mt-2 text-[11px] text-white/40" role="status">
          Decision saved{jobListingId ? '' : ' locally'}.
        </p>
      ) : null}
    </section>
  );
}
