import type { PipelineMetricView } from '@/lib/dashboardViewModel';

/** Plain-language pipeline summary for “Where things stand” when metric tiles exist. */
export function whereThingsStandPrimaryLine(metrics: PipelineMetricView[]): string | null {
  if (!metrics.length) return null;
  const byKey = new Map(metrics.map((m) => [m.key, m.value]));
  const interviewing = (byKey.get('interviewing') ?? 0) + (byKey.get('interviewsUpcoming7d') ?? 0);
  const progressing =
    (byKey.get('waiting') ?? 0) +
    (byKey.get('newMatchesSinceVisit') ?? 0);
  const followUps =
    (byKey.get('followUpNeeded') ?? 0) +
    (byKey.get('stalledApplied') ?? 0) +
    (byKey.get('stalledWaiting') ?? 0);

  const parts: string[] = [];
  if (interviewing > 0) {
    parts.push(`${interviewing} interview${interviewing === 1 ? '' : 's'} active`);
  }
  if (progressing > 0) {
    parts.push(`${progressing} application${progressing === 1 ? '' : 's'} progressing`);
  }
  if (followUps > 0) {
    parts.push(`${followUps} role${followUps === 1 ? '' : 's'} need a follow-up`);
  }

  if (parts.length === 0) return null;
  return parts.join(' · ');
}
