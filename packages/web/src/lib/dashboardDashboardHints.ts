/** User-facing tooltips for Search at a Glance + Movement (aligned with backend pipeline / growth metrics). */

/** Short line next to the “Search at a Glance” title only (each metric has its own tooltip below). */
export const SEARCH_AT_GLANCE_INTRO_HINT =
  'Quick snapshot of your pipeline: saved roles and applications in progress. Numbers refresh when you open the dashboard.';

/** Pipeline snapshot keys from `dashboardExperience.pipelineSnapshot` / metric grid (`PipelineMetricView.key`). */
const PIPELINE_METRIC_HINTS: Record<string, string> = {
  interviewing:
    'Roles marked as being in an interview stage (tracker + Job Hub where relevant).',
  interviewsUpcoming7d:
    'Interview dates in the next 7 days on applications, plus Job Hub follow-ups you scheduled for the next 7 days.',
  followUpNeeded:
    'Follow-ups that still need attention—including pending sends and overdue Job Hub CRM reminders you have not marked done.',
  waiting:
    'Roles where you are waiting on the employer\'s reply.',
  newMatchesSinceVisit:
    'New matches surfaced since your last visit—roles you may want to explore or move forward.',
  stalledApplied:
    'Applications with no recent movement (~14 days), or any overdue follow-up—including Job Hub check-ins you set and have not completed.',
  stalledWaiting:
    'Roles stuck in “waiting” longer than expected—candidates for a status check or gentle nudge.',
};

export function searchAtGlanceHintForMetricKey(key: string): string {
  const hit = PIPELINE_METRIC_HINTS[key.trim()];
  if (hit) return hit;
  return 'This count comes from your tracker and Job Hub. Refresh the dashboard for the latest totals.';
}

export const MOVEMENT_SECTION_HINT =
  'Numbers for the time range you pick (day / week / month). They reflect actions logged in ApplyMate.';

export const MOVEMENT_ROLES_FORWARD_HINT =
  'Roles advanced toward interview or offer (applications + analyses + standalone bookmarks on the hub) updated in this period.';

export const MOVEMENT_FOLLOWUPS_HINT =
  'Email follow-ups actually sent plus Job Hub reminders you marked done or dismissed in this period.';

export const MOVEMENT_TYPICAL_FIT_HINT =
  'Average match score for new job analyses started in this period (not every analysis you ever opened).';

export const MOVEMENT_FIT_TREND_HINT =
  'Change in that average compared to the previous period of the same length.';
