import type { SemanticOutlookPayload } from '@/lib/dashboardSemanticOutlook';
import type { DashboardCommandBarSource, DeterministicIndexScorePayload } from '@/lib/today-plan';

/**
 * Plain-language tooltips for dashboard intelligence scores (from today-plan).
 */

/** Prefer backend `DeterministicIndexScore` copy when present; otherwise use `fallback`. */
export function deterministicIndexTooltipText(
  meta: DeterministicIndexScorePayload | null | undefined,
  fallback: string,
): string {
  if (!meta) return fallback;
  const chunks: string[] = [];
  const label = meta.label?.trim();
  if (label) chunks.push(label.replace(/\s*—\s*/g, ', '));
  const desc = meta.description?.trim();
  if (desc) chunks.push(desc.replace(/\s*—\s*/g, ', '));
  const interp = meta.interpretation?.trim();
  if (interp) chunks.push(interp.replace(/\s*—\s*/g, ', '));
  const disc = meta.disclaimer?.trim();
  if (disc) chunks.push(disc.replace(/\s*—\s*/g, ', '));
  if (chunks.length > 0) return chunks.join(' ');
  return fallback;
}

/** Footnote under predictive outlook: API disclaimers when provided, else product fallback. */
export function predictiveOutlookDisclaimerFootnote(
  interview: SemanticOutlookPayload | null | undefined,
  offer: SemanticOutlookPayload | null | undefined,
  fallback: string,
): string {
  const i = interview?.disclaimer?.trim();
  const o = offer?.disclaimer?.trim();
  if (i && o && i !== o) return `${i.replace(/\s*—\s*/g, ', ')}\n\n${o.replace(/\s*—\s*/g, ', ')}`;
  if (i) return i.replace(/\s*—\s*/g, ', ');
  if (o) return o.replace(/\s*—\s*/g, ', ');
  return fallback;
}

export const TOOLTIP_CAREER_MOMENTUM_SCORE =
  'How active your job search is right now, based on your applications, interviews, and recent activity.';

export const TOOLTIP_CAREER_MOMENTUM_CONFIDENCE =
  'How active your job search is right now, based on your applications, interviews, and recent activity.';

export const TOOLTIP_CONFIDENCE_STRATEGIC_COACHING =
  'How well this coaching suggestion fits what you should focus on today.';

export const TOOLTIP_CONFIDENCE_OPPORTUNITY =
  'How strongly we suggest prioritizing this opportunity nudge now.';

export const TOOLTIP_CONFIDENCE_FOLLOWUP =
  'How strongly we suggest prioritizing this follow-up now.';

export const TOOLTIP_BRIEFING_CONFIDENCE =
  'How much real activity we had to base this week’s summary on.';

export const TOOLTIP_CV_SCORE =
  'This score comes from your CV review in ApplyMate. Higher usually means a stronger profile for matching.';

export const TOOLTIP_JOB_MATCH_SCORE =
  'How well this role matches your profile from your saved analysis (0–100).';

export const TOOLTIP_PREDICTIVE_INTERVIEW_OUTLOOK =
  'Your interview chances based on what you have done so far. This is guidance, not a guarantee.';

export const TOOLTIP_PREDICTIVE_OFFER_OUTLOOK =
  'Your offer progress based on what you have done so far. This is guidance, not a guarantee.';

export const TOOLTIP_PREDICTIVE_TIMELINE_OUTLOOK =
  'A rough estimated timeline based on your current search activity.';

export const TOOLTIP_BEST_MATCH =
  'The highest match score among your recent job analyses.';

export const TOOLTIP_APPLICATIONS_IN_PROGRESS =
  'Jobs you have applied to that are still active.';

export const TOOLTIP_RECENT_ANALYSES =
  'Jobs you have recently run through the job analyzer.';

export const TOOLTIP_PREDICTIVE_OUTLOOK =
  'A rough picture of where your search is going. Based on what you have done so far, not a guarantee.';

export const TOOLTIP_UPCOMING_INTERVIEW_PREP_PRIORITY =
  'How much we suggest prioritizing prep for this interview soon.';

export const TOOLTIP_UPCOMING_APPLIED_PREP_PRIORITY =
  'How much we suggest prioritizing practice while you wait to hear back.';

export const TOOLTIP_STRATEGIC_MOVE_PRIORITY =
  'How strongly we suggest this move right now.';

export const TOOLTIP_NEXT_BEST_ACTION_SIGNAL =
  'How strongly this action was picked as your next step.';

export const TOOLTIP_RECOMMENDED_MOVE_SIGNAL =
  'How strongly this move fits what you should do next.';

export const TOOLTIP_CONTINUATION_RESUME_SIGNAL =
  'How confident we are this is the right task to resume.';

export const TOOLTIP_WEEKLY_STRATEGIC_COACHING_FIT =
  'How well this week’s coaching theme fits what we saw in your activity.';

export type CommandBarConfidenceTooltipSource = DashboardCommandBarSource | 'strategic_recommendation';

export function tooltipCommandBarConfidence(source: CommandBarConfidenceTooltipSource): string {
  switch (source) {
    case 'priority_intelligence':
    case 'strategic_recommendation':
      return 'How strongly we are surfacing this priority action for you today.';
    case 'follow_up_intelligence':
      return 'How strongly we are surfacing this follow-up for you today.';
    case 'opportunity_detection':
      return 'How strongly we are surfacing this opportunity for you today.';
    case 'cv_clinic':
      return 'How strongly we are surfacing this CV clinic step for you today.';
    case 'continuation':
      return 'How strongly we are surfacing this resume task for you today.';
    default:
      return 'How strongly we are surfacing this action for you today.';
  }
}

export const PREDICTIVE_OUTLOOK_DISCLAIMER =
  'Outlook badges summarize today’s activity for guidance only. They aren’t predictions or guarantees.';

export const TOOLTIP_PIPELINE_HEALTH_BASE =
  'How balanced and active your job search is right now. It helps pick a time range for offer outlook. It is not a grade on you.';

const PIPELINE_HEALTH_LEVEL_HINT = {
  fragile: 'Fragile: little movement yet; small steps still help.',
  building: 'Building: you’re adding activity; keep going.',
  healthy: 'Healthy: a mix of good signs is showing up.',
  strong: 'Strong: several positive signs are working together.',
} as const;

export type PipelineHealthTooltipLevel = keyof typeof PIPELINE_HEALTH_LEVEL_HINT;

export function tooltipPipelineHealthText(health: PipelineHealthTooltipLevel | null): string {
  if (!health) return TOOLTIP_PIPELINE_HEALTH_BASE;
  return `${TOOLTIP_PIPELINE_HEALTH_BASE} ${PIPELINE_HEALTH_LEVEL_HINT[health]}`;
}

export const TOOLTIP_GOAL_ALIGNMENT =
  'How well your saved jobs match the roles and industries you said you are looking for.';

export const TOOLTIP_DAILY_STREAK =
  'The number of days in a row you have been active on ApplyMate.';
