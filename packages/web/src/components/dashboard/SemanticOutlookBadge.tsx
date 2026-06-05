'use client';

import { InfoHint } from '@/components/ui/InfoHint';
import {
  formatSemanticOutlookBand,
  semanticOutlookBadgeClass,
  semanticOutlookTooltipText,
  type SemanticOutlookPayload,
} from '@/lib/dashboardSemanticOutlook';
import { cn } from '@/lib/utils';

type SemanticOutlookBadgeProps = {
  outlook: SemanticOutlookPayload;
  /** Tile title when API `label` is absent. */
  defaultTitle: string;
  tooltipFallback: string;
  infoAriaLabel: string;
  className?: string;
};

export function SemanticOutlookBadge({
  outlook,
  defaultTitle,
  tooltipFallback,
  infoAriaLabel,
  className,
}: SemanticOutlookBadgeProps) {
  const title = outlook.label?.trim() || defaultTitle;
  const basis = outlook.outlookBasis?.trim();
  const tooltip = semanticOutlookTooltipText(outlook, tooltipFallback);

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-start justify-between gap-1.5">
        <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
          {title}
        </p>
        <InfoHint text={tooltip} buttonAriaLabel={infoAriaLabel} />
      </div>
      <div className="mt-2">
        <span
          className={cn(
            'inline-flex rounded-full border px-3 py-1 text-[13px] font-semibold tracking-wide',
            semanticOutlookBadgeClass(outlook.value),
          )}
        >
          {formatSemanticOutlookBand(outlook.value)}
        </span>
      </div>
      {basis ? (
        <p className="mt-2 text-[12px] leading-relaxed text-white/48">{basis}</p>
      ) : null}
    </div>
  );
}
