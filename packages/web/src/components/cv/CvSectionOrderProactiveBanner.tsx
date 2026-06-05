'use client';

import { Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type CvSectionOrderProactiveBannerProps = {
  className?: string;
  onSuggest: () => void;
  onDismiss: () => void;
};

export function CvSectionOrderProactiveBanner({
  className,
  onSuggest,
  onDismiss,
}: CvSectionOrderProactiveBannerProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-[#00C9B1]/30 bg-[#00C9B1]/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#00C9B1]" aria-hidden />
        <p className="text-sm leading-snug text-white/85">
          Your sections may not be in the most effective order. Want us to suggest the best
          arrangement?
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-8 bg-[#00C9B1] px-3 text-xs text-[#080A0A] hover:bg-[#00C9B1]/90"
          onClick={onSuggest}
        >
          Suggest order
        </Button>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-white/50 hover:bg-white/[0.06] hover:text-white/80"
          onClick={onDismiss}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Dismiss
        </button>
      </div>
    </div>
  );
}
