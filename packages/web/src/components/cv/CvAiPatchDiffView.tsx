'use client';

import { cn } from '@/lib/utils';

export type CvAiPatchDiffViewProps = {
  before: string;
  after: string;
  /** Optional field label above the diff blocks. */
  title?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Human-readable before/after for AI patches: muted red strikethrough (old),
 * green (new). Used in CV preview, improvements, assistant, and tailoring.
 */
export function CvAiPatchDiffView({
  before,
  after,
  title,
  className,
  compact = false,
}: CvAiPatchDiffViewProps) {
  const beforeText = before.trim();
  const afterText = after.trim();
  if (!beforeText && !afterText) return null;

  const pad = compact ? 'px-2 py-1' : 'px-2 py-1.5';
  const textSize = compact ? 'text-[10px]' : 'text-[10px]';

  return (
    <div className={cn('space-y-2', className)}>
      {title ? (
        <p
          className={cn(
            'font-semibold uppercase tracking-[0.08em] text-[#065F46]',
            compact ? 'text-[9px]' : 'text-[10px]',
          )}
        >
          {title}
        </p>
      ) : null}
      {beforeText ? (
        <div
          className={cn(
            'rounded-md border border-rose-300 bg-rose-50 leading-snug text-rose-700',
            pad,
            textSize,
          )}
        >
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-rose-500">
            Current version
          </p>
          <p
            className={cn(
              'max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap break-words line-through decoration-rose-400/70',
            )}
          >
            {beforeText}
          </p>
        </div>
      ) : null}
      {afterText ? (
        <div
          className={cn(
            'rounded-md border border-emerald-300 bg-emerald-50 leading-snug text-emerald-800',
            pad,
            textSize,
          )}
        >
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-600">
            AI suggestion
          </p>
          <p className="max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap break-words">
            {afterText}
          </p>
        </div>
      ) : null}
    </div>
  );
}
