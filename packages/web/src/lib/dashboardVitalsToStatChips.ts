import type { DashboardStatChip } from '@/components/dashboard/DashboardStatsRow';
import { formatSemanticOutlookBand } from '@/lib/dashboardSemanticOutlook';
import type { DashboardVitalsPayload, TodayPlanPayload } from '@/lib/today-plan';
import { normalizedSectionTitle } from '@/lib/today-plan';

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Hides server `label` when it only repeats the visible section title. */
function isRedundantSupportingLine(apiLine: string, sectionTitle: string): boolean {
  const a = apiLine.trim();
  if (!a) return true;
  return normKey(a) === normKey(sectionTitle);
}

/**
 * Maps Phase 15 `dashboardVitals` to stats row chips (order matches dashboard layout).
 * Chip titles prefer {@link normalizedSectionTitle}; primary figures use score / count / days.
 */
export function dashboardVitalsToStatChips(
  vitals: DashboardVitalsPayload,
  plan?: TodayPlanPayload | null,
): DashboardStatChip[] {
  const titleMomentum = normalizedSectionTitle(plan, 'momentum', 'Career momentum');
  const titleOutlook = normalizedSectionTitle(plan, 'predictive_outlook', 'Interview outlook');
  const titleBestMatch = normalizedSectionTitle(plan, 'best_match', 'Best role fit');
  const titleApplications = normalizedSectionTitle(plan, 'applications', 'Active applications');
  const titleStreak = normalizedSectionTitle(plan, 'consistency', 'Consistency streak');

  const chips: DashboardStatChip[] = [];

  if (vitals.careerMomentum) {
    const v = vitals.careerMomentum;
    const tier = v.status?.trim() ?? '';
    const narrative =
      v.label && !isRedundantSupportingLine(v.label, titleMomentum) ? v.label.trim() : '';
    let status = '';
    if (tier && narrative) status = `${tier} · ${narrative}`;
    else status = tier || narrative;
    chips.push({
      key: 'career_momentum',
      label: titleMomentum,
      value: `${v.score}/100`,
      status,
      explanation: v.explanation?.trim() || undefined,
      scrollTargetId: 'dashboard-deep-career-momentum',
    });
  }

  if (vitals.interviewOutlook) {
    const v = vitals.interviewOutlook;
    const basis = v.outlookBasis?.trim() ?? '';
    const status =
      basis ||
      (v.label && !isRedundantSupportingLine(v.label, titleOutlook) ? v.label.trim() : '');
    chips.push({
      key: 'predictive_outlook',
      label: titleOutlook,
      value: formatSemanticOutlookBand(v.value),
      status,
      explanation: v.disclaimer?.trim() || v.explanation?.trim() || undefined,
      scrollTargetId: 'dashboard-deep-predictive-outlook',
    });
  }

  if (vitals.bestMatch) {
    const v = vitals.bestMatch;
    chips.push({
      key: 'best_match',
      label: titleBestMatch,
      value: `${v.score}%`,
      status: v.company?.trim() ?? '',
      explanation: v.explanation?.trim() || undefined,
      scrollTargetId: 'dashboard-deep-recent-analyses',
    });
  }

  if (vitals.activeApplications) {
    const v = vitals.activeApplications;
    chips.push({
      key: 'applications',
      label: titleApplications,
      value: String(v.count),
      status: '',
      explanation: v.explanation?.trim() || undefined,
      scrollTargetId: 'dashboard-deep-summary',
    });
  }

  if (vitals.streak) {
    const d = vitals.streak.days;
    chips.push({
      key: 'streak',
      label: titleStreak,
      value: `${d} ${d === 1 ? 'day' : 'days'}`,
      status: '',
      explanation: vitals.streak.explanation?.trim() || undefined,
      scrollTargetId: 'dashboard-deep-consistency',
    });
  }

  return chips;
}
