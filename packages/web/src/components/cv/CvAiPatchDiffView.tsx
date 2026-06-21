'use client';

import {
  cvDiffAfterTextHasMetricPlaceholders,
  splitCvMetricPlaceholders,
} from '@/lib/cvAiPatchDisplay';
import { cn } from '@/lib/utils';

export type CvAiPatchDiffViewProps = {
  before: string;
  after: string;
  /** Optional field label above the diff blocks. */
  title?: string;
  className?: string;
  compact?: boolean;
};

function AfterTextWithPlaceholders({ text }: { text: string }) {
  const segments = splitCvMetricPlaceholders(text);
  const hasPlaceholders = cvDiffAfterTextHasMetricPlaceholders(text);
  return (
    <>
      <p className="max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap break-words">
        {segments.map((seg, i) =>
          seg.isPlaceholder ? (
            <mark
              key={`${i}-${seg.text}`}
              className="rounded bg-amber-200/90 px-0.5 font-semibold text-amber-950 not-italic"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={`${i}-t`}>{seg.text}</span>
          ),
        )}
      </p>
      {hasPlaceholders ? (
        <p className="mt-1.5 text-[9px] leading-snug text-amber-700/90">
          Replace bracketed placeholders with your real numbers before submitting your CV.
        </p>
      ) : null}
    </>
  );
}

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
          <AfterTextWithPlaceholders text={afterText} />
        </div>
      ) : null}
    </div>
  );
}
