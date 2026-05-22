'use client';

import { InfoHint } from '@/components/ui/InfoHint';
import type { PipelineMetricView } from '@/lib/dashboardViewModel';
import { SEARCH_AT_GLANCE_INTRO_HINT, searchAtGlanceHintForMetricKey } from '@/lib/dashboardDashboardHints';
import {
  dedupeNearDuplicateSentences,
  pipelineEyebrowHeadlineRedundant,
} from '@/lib/dashboardPipelineNarrative';
import { cn } from '@/lib/utils';

type Props = {
  metrics: PipelineMetricView[];
  headline?: string | null;
  body?: string | null;
  /** Phase 5: render section shell even when empty. */
  forceRender?: boolean;
  titleOverride?: string | null;
  emptyStateCopyOverride?: string | null;
  /** Backend section label (small row); falls back to “Search at a Glance” when absent. */
  sectionEyebrow?: string | null;
  /**
   * Primary headline fallback when headline/title/body don’t fill the line.
   * Pass `null` to omit the headline row when empty (e.g. metrics-only snapshot card).
   * @default 'Your Landscape' when omitted (legacy callers).
   */
  primaryLineFallback?: string | null;
};

export function DashboardPipelineSnapshotCard({
  metrics,
  headline,
  body,
  forceRender,
  titleOverride,
  emptyStateCopyOverride,
  sectionEyebrow,
  primaryLineFallback,
}: Props) {
  const positiveMetrics = metrics.filter((m) => typeof m.value === 'number' && Number.isFinite(m.value) && m.value > 0);
  const headlineText = headline?.trim() || '';
  const titleOverrideText = titleOverride?.trim() || '';
  const bodyText = body?.trim() || '';
  const hasHeadOrTitle = Boolean(headlineText || titleOverrideText);
  const bodyOnlySummary = Boolean(bodyText) && !hasHeadOrTitle;
  const hasNarrative = Boolean(headlineText || titleOverrideText || bodyText);
  const hasAnySignal = positiveMetrics.length > 0 || hasNarrative;
  if (!hasAnySignal && forceRender !== true) return null;
  /** Prefer backend headline/body as narrative — skip raw counts when interpretation exists. */
  const narrativeFirst = hasNarrative;
  const showMetricGrid = positiveMetrics.length > 0 && !narrativeFirst;

  const primaryTitle =
    hasHeadOrTitle ? headlineText || titleOverrideText : bodyOnlySummary ? bodyText : '';
  const fallbackHeadline =
    primaryLineFallback === undefined ? 'Your Landscape' : primaryLineFallback === null ? '' : primaryLineFallback;
  const displayPrimary = primaryTitle || (!bodyOnlySummary ? fallbackHeadline : '');

  const displaySecondary =
    hasHeadOrTitle && bodyText && bodyText !== headlineText && bodyText !== titleOverrideText
      ? bodyText
      : null;

  const eyebrowRaw = sectionEyebrow?.trim() || 'Where things stand';
  const primaryForEyebrowDedupe = headlineText || titleOverrideText;
  const hideEyebrow =
    Boolean(primaryForEyebrowDedupe) &&
    pipelineEyebrowHeadlineRedundant(eyebrowRaw, primaryForEyebrowDedupe);
  const eyebrow = hideEyebrow ? '' : eyebrowRaw;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 sm:p-6">
      <div className="min-w-0">
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5',
            !eyebrow ? 'min-h-[1.125rem] justify-end' : '',
          )}
        >
          {eyebrow ? (
            <p className="min-w-0 flex-1 text-[11px] font-medium tracking-wide text-white/38">{eyebrow}</p>
          ) : null}
          <InfoHint text={SEARCH_AT_GLANCE_INTRO_HINT} buttonClassName="translate-y-px" />
        </div>
        {bodyOnlySummary ? (
          <p className="mt-2 text-[13px] leading-relaxed text-white/85">{bodyText}</p>
        ) : (
          <>
            {displayPrimary ? (
              <p className="mt-2 text-[15px] font-medium leading-snug text-white/88">{displayPrimary}</p>
            ) : null}
            {displaySecondary ? (
              <p className="mt-2 text-[13px] leading-relaxed text-white/52">{displaySecondary}</p>
            ) : null}
            {forceRender === true && !hasAnySignal ? (
              <p className="mt-2 text-[13px] leading-relaxed text-white/52">
                {emptyStateCopyOverride?.trim() || 'Start analyzing roles to see how your search is progressing.'}
              </p>
            ) : null}
          </>
        )}
      </div>

      {showMetricGrid ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {positiveMetrics.slice(0, 6).map((m) => (
            <div key={m.key} className={cn('rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3')}>
              <div className="flex items-start justify-between gap-1.5">
                <p className="min-w-0 flex-1 text-[10px] font-medium leading-snug tracking-wide text-white/38">
                  {m.label}
                </p>
                <InfoHint text={searchAtGlanceHintForMetricKey(m.key)} className="shrink-0" />
              </div>
              <p className="mt-1.5 text-[17px] font-semibold tabular-nums text-white/85">{m.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
