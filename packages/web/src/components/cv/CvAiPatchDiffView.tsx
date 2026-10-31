'use client';

import {
  cvDiffAfterTextHasMetricPlaceholders,
  splitCvMetricPlaceholders,
} from '@/lib/cvAiPatchDisplay';
import { wordDiff } from '@/lib/cvWordDiff';
import { cn } from '@/lib/utils';

export type CvAiPatchDiffViewProps = {
  before: string;
  after: string;
  /** Optional field label above the change. */
  title?: string;
  className?: string;
  compact?: boolean;
  /** `paper`: shown on the white CV page; `theme`: on app surfaces (light or dark). */
  tone?: 'theme' | 'paper';
};

const TONES = {
  paper: {
    label: 'text-[#475467]',
    text: 'text-[#101828]',
    added: 'rounded-[3px] bg-[#DCFAE6] px-0.5 text-[#085D3A]',
    removed: 'text-[#B42318]/80 line-through decoration-[#F04438]/60',
    hint: 'text-[#93370D]',
  },
  theme: {
    label: 'text-text-tertiary',
    text: 'text-text-primary',
    added: 'rounded-[3px] bg-success-subtle px-0.5 text-success-text',
    removed: 'text-danger-text/80 line-through decoration-danger-text/60',
    hint: 'text-warning-text',
  },
} as const;

function AddedText({ text, className }: { text: string; className: string }) {
  return (
    <>
      {splitCvMetricPlaceholders(text).map((seg, i) =>
        seg.isPlaceholder ? (
          <mark
            key={`${i}-${seg.text}`}
            className="rounded-[3px] bg-[#FEF0C7] px-0.5 font-semibold text-[#93370D]"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={`${i}-t`} className={className}>
            {seg.text}
          </span>
        ),
      )}
    </>
  );
}

/**
 * One readable paragraph of an AI change: unchanged words as they are, removed words struck
 * through, new words highlighted. Used in the CV, Improvements, the assistant and tailoring.
 */
export function CvAiPatchDiffView({
  before,
  after,
  title,
  className,
  compact = false,
  tone = 'theme',
}: CvAiPatchDiffViewProps) {
  const beforeText = before.trim();
  const afterText = after.trim();
  if (!beforeText && !afterText) return null;
  const t = TONES[tone];
  const parts = wordDiff(beforeText, afterText);

  return (
    <div className={cn('min-w-0', className)}>
      {title ? (
        <p className={cn('mb-1 text-[11px] font-medium', t.label)}>{title}</p>
      ) : null}
      <p
        className={cn(
          'max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed',
          compact ? 'text-[12px]' : 'text-[13px]',
          t.text,
        )}
      >
        {parts.map((part, i) =>
          part.kind === 'same' ? (
            <span key={i}>{part.text}</span>
          ) : part.kind === 'added' ? (
            <AddedText key={i} text={part.text} className={t.added} />
          ) : (
            <span key={i} className={t.removed}>
              {part.text}
            </span>
          ),
        )}
      </p>
      {afterText && !beforeText ? null : !afterText ? (
        <p className={cn('mt-1 text-[11px]', t.label)}>
          This text will be removed.
        </p>
      ) : null}
      {cvDiffAfterTextHasMetricPlaceholders(afterText) ? (
        <p className={cn('mt-1.5 text-[11px] leading-snug', t.hint)}>
          Swap the highlighted placeholders for your real numbers.
        </p>
      ) : null}
    </div>
  );
}
