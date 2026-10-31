'use client';

import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  itemCountLabel,
  type CvParseImportSummary,
} from '@/lib/cvParseImportSummary';
import { displayResumeCopy } from '@/lib/resumeDisplayCopy';
import { cn } from '@/lib/utils';

type CvParseImportSummaryPanelProps = {
  importSummary: CvParseImportSummary;
  onContinue?: () => void;
  continueLabel?: string;
  className?: string;
  /** When true, omit outer padding (panel lives inside a modal body). */
  embedded?: boolean;
};

function kindBadgeClass(
  kind: CvParseImportSummary['sections'][number]['kind'],
): string {
  if (kind === 'custom') {
    return 'border-accent-border bg-accent-subtle text-accent-text';
  }
  if (kind === 'optional')
    return 'border-border-default bg-bg-surface text-text-tertiary';
  if (kind === 'links')
    return 'border-border-default bg-bg-surface text-text-tertiary';
  return 'border-border-subtle bg-bg-surface text-text-tertiary';
}

function kindBadgeLabel(
  kind: CvParseImportSummary['sections'][number]['kind'],
): string {
  if (kind === 'custom') return 'Custom';
  if (kind === 'core') return 'Core';
  return kind;
}

export function CvParseImportSummaryPanel({
  importSummary,
  onContinue,
  continueLabel = 'Open CV editor',
  className,
  embedded = false,
}: CvParseImportSummaryPanelProps) {
  const customCount = importSummary.sections.filter(
    (s) => s.kind === 'custom',
  ).length;
  const message = displayResumeCopy(importSummary.message);
  const sectionCount = importSummary.sections.length;

  return (
    <div className={cn(!embedded && 'w-full', className)}>
      {!embedded ? (
        <div className="flex items-start gap-3">
          <Sparkles
            className="mt-0.5 h-6 w-6 shrink-0 text-accent-text"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-snug text-text-primary">
              {message}
            </h3>
            {customCount > 0 ? (
              <p className="mt-2 text-sm text-text-tertiary">
                {customCount === 1
                  ? 'One specialised section'
                  : `${customCount} specialised sections`}{' '}
                (e.g. Publications, Patents) were kept with their original
                headings.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-accent-border bg-accent-subtle px-3.5 py-3">
          <Sparkles
            className="mt-0.5 h-5 w-5 shrink-0 text-accent-text"
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-text-secondary">
            {message}
          </p>
        </div>
      )}

      {embedded ? (
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.1em] text-text-tertiary">
          {sectionCount} section{sectionCount === 1 ? '' : 's'} imported
        </p>
      ) : null}

      {customCount > 0 && embedded ? (
        <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
          {customCount === 1
            ? 'One specialised section'
            : `${customCount} specialised sections`}{' '}
          kept with original headings.
        </p>
      ) : null}

      <ul
        className={cn(
          'space-y-2',
          embedded
            ? 'mt-3'
            : 'app-scrollbar mt-5 max-h-[min(42vh,320px)] overflow-y-auto overscroll-contain pr-1',
        )}
        aria-label="Imported sections"
      >
        {importSummary.sections.map((row) => (
          <li
            key={`${row.type}-${row.label}`}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors',
              row.kind === 'custom'
                ? 'border-accent-border bg-accent-subtle'
                : 'border-border-subtle bg-bg-surface',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {row.label}
              </p>
              <span
                className={cn(
                  'mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  kindBadgeClass(row.kind),
                )}
              >
                {kindBadgeLabel(row.kind)}
              </span>
            </div>
            <span className="shrink-0 text-xs font-medium text-text-tertiary">
              {itemCountLabel(row.itemCount)}
            </span>
          </li>
        ))}
      </ul>

      {onContinue ? (
        <div
          className={cn(
            'mt-6 flex justify-end border-t border-border-subtle pt-4',
            embedded && 'sticky bottom-0 bg-inherit',
          )}
        >
          <Button type="button" className="min-w-[10rem]" onClick={onContinue}>
            {continueLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
