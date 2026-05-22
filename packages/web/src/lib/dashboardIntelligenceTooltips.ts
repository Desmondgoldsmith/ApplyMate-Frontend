import type { DashboardCommandBarSource, DeterministicIndexScorePayload } from '@/lib/today-plan';

/**
 * Plain-language tooltips for dashboard intelligence scores (from today-plan).
 * Avoid internal field names, weights, or jargon like “pipeline,” “orchestration,” “leverage.”
 */

/** Prefer backend `DeterministicIndexScore` copy when present; otherwise use `fallback`. */
export function deterministicIndexTooltipText(
  meta: DeterministicIndexScorePayload | null | undefined,
  fallback: string,
): string {
  if (!meta) return fallback;
  const chunks: string[] = [];
  const label = meta.label?.trim();
  if (label) chunks.push(label);
  const desc = meta.description?.trim();
  if (desc) chunks.push(desc);
  const interp = meta.interpretation?.trim();
  if (interp) chunks.push(interp);
  const band = meta.confidenceBand?.trim();
  if (band) chunks.push(`Signal band: ${band}`);
  const disc = meta.disclaimer?.trim();
  if (disc) chunks.push(disc);
  if (chunks.length > 0) return chunks.join('\n\n');
  return fallback;
}

/** Footnote under predictive outlook: API disclaimers when provided, else product fallback. */
export function predictiveOutlookDisclaimerFootnote(
  interview: DeterministicIndexScorePayload | null | undefined,
  offer: DeterministicIndexScorePayload | null | undefined,
  fallback: string,
): string {
  const i = interview?.disclaimer?.trim();
  const o = offer?.disclaimer?.trim();
  if (i && o && i !== o) return `${i}\n\n${o}`;
  if (i) return i;
  if (o) return o;
  return fallback;
}

export const TOOLTIP_CAREER_MOMENTUM_SCORE =
  'Career momentum is a composite index (0–100) from several things we already know about your search: your CV, how well saved roles fit you, applications (including drafts), applications that moved forward, interviews, follow-ups, and recent activity on your dashboard.\n\nHigher means stronger momentum right now. It updates when your activity changes.\n\nThe tier tag is a simple band for your score—a quick label, not a separate grade.';

export const TOOLTIP_CAREER_MOMENTUM_CONFIDENCE =
  'How reliable the momentum index is from the data we have—not CV quality (use CV score / CV clinic for that).';

export const TOOLTIP_CONFIDENCE_STRATEGIC_COACHING =
  'How strongly this coaching suggestion fits what we should highlight now—not progress as a % or job match.';

export const TOOLTIP_CONFIDENCE_OPPORTUNITY =
  'How strongly we suggest prioritizing this opportunity nudge now—not your overall job-search grade or job match %.';

export const TOOLTIP_CONFIDENCE_FOLLOWUP =
  'How strongly we suggest prioritizing this follow-up now—not your job match % or pass/fail odds.';

export const TOOLTIP_BRIEFING_CONFIDENCE =
  'How much real activity we had to base this week’s summary on—not how “good” you were or job match %.';

export const TOOLTIP_CV_SCORE =
  'This score comes from your CV review in Applymate—higher usually means a stronger profile for matching.';

export const TOOLTIP_JOB_MATCH_SCORE =
  'How well this role matches your profile from your saved analysis (0–100).';

/** Phase 6A predictive outlook — deterministic outlook indexes (not statistical probabilities). */
export const TOOLTIP_PREDICTIVE_INTERVIEW_INDEX =
  'A deterministic outlook index from your current activity—not a statistical probability or guarantee of interviews. Higher reflects stronger signals from your CV, role fit, applications, and interview-related steps.';

export const TOOLTIP_PREDICTIVE_OFFER_INDEX =
  'A deterministic outlook index from what we see now—not a statistical probability or promise about offers. It blends interviews, movement on applications, momentum, and follow-ups.';

export const TOOLTIP_PREDICTIVE_WEEKS_RANGE =
  'A rough range based on your funnel balance and movement—not a deadline. It updates as your activity changes.';

export const TOOLTIP_PREDICTIVE_CONFIDENCE =
  'How much recent activity we had to build this outlook—not your chance of an interview or offer (those are separate indexes).';

/** Upcoming interview row — `upcomingInterviews[].confidence` */
export const TOOLTIP_UPCOMING_INTERVIEW_PREP_PRIORITY =
  'How much we suggest prioritizing prep for this interview soon—not job fit, interview odds, or pass/fail.';

/** Proactive prep row (`stage: applied_prep`) — `upcomingInterviews[].confidence` */
export const TOOLTIP_UPCOMING_APPLIED_PREP_PRIORITY =
  'How much we suggest prioritizing practice while you wait to hear back—not job fit or interview odds.';

export const TOOLTIP_STRATEGIC_MOVE_PRIORITY =
  'How strongly we suggest this strategic move now—not job match % or a second momentum/CV score.';

export const TOOLTIP_NEXT_BEST_ACTION_SIGNAL =
  'How strongly this action was picked as your next step—not job match % or interview probability.';

/** Phase 21 — Recommended Move strip (`recommendedMove` from today-plan). */
export const TOOLTIP_RECOMMENDED_MOVE_SIGNAL =
  'How strongly this move fits what you should do next—not job match %, interview odds, or a second momentum score.';

export const TOOLTIP_CONTINUATION_RESUME_SIGNAL =
  'How confident we are this is the right task to resume—not job match % or a quality grade on the work.';

export const TOOLTIP_WEEKLY_STRATEGIC_COACHING_FIT =
  'How well this week’s coaching theme fits what we saw—not your worth or guaranteed outcomes.';

/** Legacy command-bar candidates built from `strategicRecommendation` (same intent as `priority_intelligence`). */
export type CommandBarConfidenceTooltipSource = DashboardCommandBarSource | 'strategic_recommendation';

export function tooltipCommandBarConfidence(source: CommandBarConfidenceTooltipSource): string {
  switch (source) {
    case 'priority_intelligence':
    case 'strategic_recommendation':
      return 'How strongly we are surfacing this priority action—not job match % or interview odds.';
    case 'follow_up_intelligence':
      return 'How strongly we are surfacing this follow-up—not job match % or pass/fail odds.';
    case 'opportunity_detection':
      return 'How strongly we are surfacing this opportunity nudge—not your overall search grade.';
    case 'cv_clinic':
      return 'How strongly we are surfacing this CV clinic step—not job fit for a single role.';
    case 'continuation':
      return 'How strongly we are surfacing this resume task—not a quality grade.';
    default:
      return 'How strongly we are surfacing this action—not job match % or interview odds.';
  }
}

export const PREDICTIVE_OUTLOOK_DISCLAIMER =
  'These numbers summarize today’s signals for guidance only. They aren’t predictions or guarantees.';

/** Predictive outlook — pipeline health badge (balanced / active search read). */
export const TOOLTIP_PIPELINE_HEALTH_BASE =
  'Pipeline health is a quick read of how balanced and active your job search is right now—things like applications sent, steps moving forward, interviews, follow-ups, and your momentum score. It helps the app pick a time range for the offer outlook. It is not a grade on you and not a promise of results.';

const PIPELINE_HEALTH_LEVEL_HINT = {
  fragile: 'Fragile — Little movement yet; small steps still help.',
  building: 'Building — You’re adding activity; keep going.',
  healthy: 'Healthy — A mix of good signals is showing up.',
  strong: 'Strong — Several strong signs are working together.',
} as const;

export type PipelineHealthTooltipLevel = keyof typeof PIPELINE_HEALTH_LEVEL_HINT;

export function tooltipPipelineHealthText(health: PipelineHealthTooltipLevel | null): string {
  if (!health) return TOOLTIP_PIPELINE_HEALTH_BASE;
  return `${TOOLTIP_PIPELINE_HEALTH_BASE}\n\n${PIPELINE_HEALTH_LEVEL_HINT[health]}`;
}
