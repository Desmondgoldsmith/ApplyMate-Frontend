'use client';

import { Info, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import {
  SCORE_BAND_LABELS,
  humanizeScoreImprovementDetail,
  scoreImprovementAxisLabel,
  type ScoreImprovementGuide,
  type ScoreImprovementItem,
} from '@/lib/scoreImprovement';
import { stripAnalysisUserCopy } from '@/lib/jobAnalysisAts';
import { cn } from '@/lib/utils';

const MAX_GUIDE_ITEMS = 3;

function GuideRow({ item }: { item: ScoreImprovementItem }) {
  return (
    <li className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 sm:px-4">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold leading-snug text-white">{item.title}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/45">
              <Info className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {scoreImprovementAxisLabel(item.axis)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/52">
            {humanizeScoreImprovementDetail(item.detail)}
          </p>
        </div>
      </div>
    </li>
  );
}

export function ScoreImprovementGuideCard({
  guide,
  readinessNote,
  className,
}: {
  guide: ScoreImprovementGuide;
  /** Fallback when post-tailor guide omits `interviewReminder`. */
  readinessNote?: string | null;
  className?: string;
}) {
  const bandLabel = SCORE_BAND_LABELS[guide.scoreBand];
  const interviewCopy = stripAnalysisUserCopy(
    guide.interviewReminder ?? readinessNote ?? '',
  );
  const guideItems = guide.items.slice(0, MAX_GUIDE_ITEMS);
  const beforeTailor = guide.scoreBeforeTailoring;
  const showScoreDelta =
    beforeTailor != null &&
    Number.isFinite(beforeTailor) &&
    Math.round(beforeTailor) !== Math.round(guide.currentScore);

  return (
    <section
      className={cn(
        'rounded-2xl border border-[#00C9B1]/18 bg-gradient-to-b from-[#00C9B1]/[0.06] to-transparent p-4 sm:p-5',
        className,
      )}
      aria-labelledby="score-improvement-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-[#00C9B1]" aria-hidden />
          <h3 id="score-improvement-heading" className="text-sm font-semibold text-white">
            Your score &amp; next steps
          </h3>
        </div>
        <Badge variant="muted" className="shrink-0 text-[10px] font-semibold uppercase tracking-wide">
          {bandLabel}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[28px] font-bold tabular-nums leading-none text-white">
          {guide.currentScore}%
        </p>
        {showScoreDelta ? (
          <p className="text-[12px] font-medium text-emerald-300/90">
            up from {Math.round(beforeTailor!)}%
          </p>
        ) : null}
      </div>

      <p className="mt-2 text-[14px] font-medium leading-snug text-white/90">{guide.headline}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-white/48">{guide.ceilingHint}</p>

      {guideItems.length > 0 ? (
        <ul className="mt-4 space-y-2.5" role="list">
          {guideItems.map((item) => (
            <GuideRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}

      {interviewCopy ? (
        <p className="mt-4 text-[11px] leading-relaxed text-white/42">{interviewCopy}</p>
      ) : null}
    </section>
  );
}
