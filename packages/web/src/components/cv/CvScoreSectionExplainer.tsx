'use client';

import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { formatUiCopy } from '@/lib/formatUiCopy';
import { parseExplainerBlocks, renderExplainerBlocks } from '@/lib/parseExplainerBody';
import type { CvSectionScoreExplainer } from '@/lib/cvSectionScoreExplainer';
import { cn } from '@/lib/utils';

export type CvScoreSectionExplainerProps = {
  sectionLabel: string;
  score: number;
  explainer: CvSectionScoreExplainer;
  compact?: boolean;
  busy?: 'ai' | 'self' | null;
  onFixWithAi?: (suggestionId: string) => void | Promise<void>;
  onFixMyself?: (suggestionId: string) => void | Promise<void>;
};

export function CvScoreSectionExplainer({
  sectionLabel,
  score,
  explainer,
  compact = false,
  busy = null,
  onFixWithAi,
  onFixMyself,
}: CvScoreSectionExplainerProps) {
  const [open, setOpen] = useState(false);
  const suggestionId = explainer.suggestionId?.trim();
  const canAct = Boolean(suggestionId && (onFixWithAi || onFixMyself));

  return (
    <div className="mt-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full min-w-0 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-left transition-colors hover:border-[#00C9B1]/30 hover:bg-[#00C9B1]/[0.06]',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}
      >
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-white/40 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-white/45">
          Why {score}% on {sectionLabel}?
        </span>
      </button>

      {open ? (
        <div
          className={cn(
            'mt-1.5 space-y-2 rounded-lg border border-white/[0.08] bg-[#0a0f0f] p-2.5',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          <ExplainerBlock title="What this means" body={explainer.whatItMeans} />
          <ExplainerBlock title="Why this score" body={explainer.whyThisScore} />
          <ExplainerBlock title="How to improve" body={explainer.howToImprove} />

          {canAct ? (
            <div className="flex flex-col gap-1.5 pt-1 sm:flex-row sm:flex-wrap">
              {onFixWithAi && suggestionId ? (
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void onFixWithAi(suggestionId)}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border-0 bg-[#00C9B1] text-[11px] font-semibold text-[#080B0A] transition hover:brightness-110 disabled:opacity-50 sm:min-w-[8.5rem] sm:flex-none"
                >
                  {busy === 'ai' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Fix with AI
                </button>
              ) : null}
              {onFixMyself && suggestionId ? (
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void onFixMyself(suggestionId)}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-transparent text-[11px] font-medium text-white/55 transition hover:border-white/25 hover:text-white/85 disabled:opacity-50 sm:min-w-[8.5rem] sm:flex-none"
                >
                  {busy === 'self' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  I&apos;ll fix it myself
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExplainerBlock({ title, body }: { title: string; body: string }) {
  const copy = formatUiCopy(body);
  const blocks = parseExplainerBlocks(copy);

  return (
    <div>
      <p className="font-semibold uppercase tracking-[0.06em] text-white/35">{title}</p>
      <div className="mt-1">
        {blocks.length > 0 ? renderExplainerBlocks(blocks) : null}
      </div>
    </div>
  );
}
