'use client';

import type { PresentationGap } from '@/lib/presentationGaps';
import {
  PRESENTATION_GAPS_SECTION_TITLE,
  presentationGapAdviceLabel,
} from '@/lib/presentationGaps';
import { stripAnalysisUserCopy } from '@/lib/jobAnalysisAts';
import { cn } from '@/lib/utils';

export function PresentationGapsPanel({
  gaps,
  className,
}: {
  gaps: PresentationGap[];
  className?: string;
}) {
  if (!gaps.length) return null;

  return (
    <section className={cn('space-y-3', className)} aria-labelledby="presentation-gaps-heading">
      <h3
        id="presentation-gaps-heading"
        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35"
      >
        {PRESENTATION_GAPS_SECTION_TITLE}
      </h3>
      <ul className="space-y-2.5" role="list">
        {gaps.map((gap) => (
          <li
            key={`${gap.adviceType}-${gap.skill}`}
            className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3.5 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-white/90">{gap.skill}</p>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/45">
                {presentationGapAdviceLabel(gap.adviceType)}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
              {stripAnalysisUserCopy(gap.guidance)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
