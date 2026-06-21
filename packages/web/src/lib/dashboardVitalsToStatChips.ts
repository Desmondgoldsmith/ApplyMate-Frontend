import type { DashboardStatChip } from '@/components/dashboard/DashboardStatsRow';
import { cleanAiText } from '@/lib/dashboardDisplayCopy';
import {
  TOOLTIP_APPLICATIONS_IN_PROGRESS,
  TOOLTIP_BEST_MATCH,
  TOOLTIP_CAREER_MOMENTUM_SCORE,
  TOOLTIP_DAILY_STREAK,
  TOOLTIP_PREDICTIVE_OUTLOOK,
} from '@/lib/dashboardIntelligenceTooltips';
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
  const titleMomentum = normalizedSectionTitle(plan, 'career_momentum', 'Search Momentum');
  const titleOutlook = normalizedSectionTitle(plan, 'predictive_outlook', 'Where your search is heading');
  const titleBestMatch = normalizedSectionTitle(plan, 'best_match', 'Best match');
  const titleApplications = normalizedSectionTitle(plan, 'applications', 'Applications in progress');
  const titleStreak = normalizedSectionTitle(plan, 'consistency', 'Daily streak');

  const chips: DashboardStatChip[] = [];

  if (vitals.careerMomentum) {
    const v = vitals.careerMomentum;
    const tier = v.status?.trim() ?? '';
    const narrative =
      v.label && !isRedundantSupportingLine(v.label, titleMomentum) ? v.label.trim() : '';
    let status = '';
    if (tier && narrative) status = `${tier}, ${cleanAiText(narrative)}`;
    else status = cleanAiText(tier || narrative);
    chips.push({
      key: 'career_momentum',
      label: titleMomentum,
      value: `${v.score}/100`,
      status,
      explanation: cleanAiText(v.explanation?.trim()) || TOOLTIP_CAREER_MOMENTUM_SCORE,
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
    const hasRealMatch =
      v.hasAnalyzedJobs === true && v.score != null && Number.isFinite(v.score);
    chips.push({
      key: 'best_match',
      label: titleBestMatch,
      value: hasRealMatch ? `${v.score}%` : '—',
      status: hasRealMatch
        ? cleanAiText(v.company?.trim() ?? '')
        : cleanAiText(v.emptyStateMessage?.trim() ?? v.label?.trim() ?? 'Analyze a job to see your best match'),
      explanation: cleanAiText(v.explanation?.trim()) || TOOLTIP_BEST_MATCH,
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
      explanation: cleanAiText(v.explanation?.trim()) || TOOLTIP_APPLICATIONS_IN_PROGRESS,
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
      explanation: cleanAiText(vitals.streak.explanation?.trim()) || TOOLTIP_DAILY_STREAK,
      scrollTargetId: 'dashboard-deep-consistency',
    });
  }

  return chips;
}
