'use client';

import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import {
  itemCountLabel,
  type CvParseImportSummary,
} from '@/lib/cvParseImportSummary';
import { cn } from '@/lib/utils';

type CvParseImportSummaryPanelProps = {
  importSummary: CvParseImportSummary;
  profileId?: string | null;
  onReviewInBuilder?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  className?: string;
};

function kindBadgeClass(kind: CvParseImportSummary['sections'][number]['kind']): string {
  if (kind === 'custom') {
    return 'border-[#00C9B1]/40 bg-[#00C9B1]/12 text-[#7ee8d8]';
  }
  if (kind === 'optional') return 'border-white/12 bg-white/[0.04] text-white/55';
  if (kind === 'links') return 'border-white/12 bg-white/[0.04] text-white/45';
  return 'border-white/10 bg-white/[0.03] text-white/50';
}

export function CvParseImportSummaryPanel({
  importSummary,
  profileId,
  onReviewInBuilder,
  onContinue,
  continueLabel = 'Continue',
  className,
}: CvParseImportSummaryPanelProps) {
  const customCount = importSummary.sections.filter((s) => s.kind === 'custom').length;

  return (
    <GlowCard className={cn('w-full', className)} contentClassName="p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-[#00C9B1]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-snug text-white">{importSummary.message}</h3>
          {customCount > 0 ? (
            <p className="mt-2 text-sm text-white/50">
              {customCount === 1
                ? 'One specialised section'
                : `${customCount} specialised sections`}{' '}
              (e.g. Publications, Patents) were kept with their original headings.
            </p>
          ) : null}
        </div>
      </div>

      <ul className="mt-5 space-y-2" aria-label="Imported sections">
        {importSummary.sections.map((row) => (
          <li
            key={`${row.type}-${row.label}`}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
              row.kind === 'custom'
                ? 'border-[#00C9B1]/35 bg-[#00C9B1]/8'
                : 'border-white/[0.08] bg-[#080b0b]/60',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/90">{row.label}</p>
              <span
                className={cn(
                  'mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  kindBadgeClass(row.kind),
                )}
              >
                {row.kind === 'custom' ? 'Custom' : row.kind}
              </span>
            </div>
            <span className="shrink-0 text-xs text-white/45">{itemCountLabel(row.itemCount)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-white/[0.08] pt-4">
        {onReviewInBuilder && profileId?.trim() ? (
          <Button
            type="button"
            className="bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]/90"
            onClick={onReviewInBuilder}
          >
            Review in CV builder
          </Button>
        ) : null}
        {onContinue ? (
          <Button
            type="button"
            variant="ghost"
            className="border border-white/10"
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        ) : null}
      </div>
    </GlowCard>
  );
}
