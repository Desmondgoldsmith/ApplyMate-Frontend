import type { DashboardContinuationItemPayload, TodayPlanPayload } from '@/lib/today-plan';
import { listContinuationItems } from '@/lib/today-plan';

export type InterviewContinuationResumeState = {
  evaluationStatus: string | null;
  resultsPath: string | null;
};

const INTERVIEW_SESSION_HREF_RE = /\/interview\/([^/?#]+)/i;

export function interviewSessionIdFromHref(href: string | null | undefined): string | null {
  const h = (href ?? '').trim();
  if (!h) return null;
  const m = h.match(INTERVIEW_SESSION_HREF_RE);
  return m?.[1]?.trim() || null;
}

function normalizeStepKey(stepKey: string | null | undefined): string {
  return (stepKey ?? '').trim().toLowerCase();
}

function normalizeEvalStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase();
}

/** Backend may omit completed rows; filter stale completed interviews from Continue. */
export function shouldShowInterviewContinuationItem(
  item: DashboardContinuationItemPayload,
): boolean {
  if (item.type !== 'interview') return true;

  const step = normalizeStepKey(item.stepKey);
  const evalStatus = normalizeEvalStatus(item.interviewResumeState?.evaluationStatus);

  if (step === 'evaluation_processing' || step === 'results_ready') return true;

  if (evalStatus === 'completed') return false;
  if (step === 'completed' || step === 'abandoned' || step === 'evaluation_failed') return false;

  return true;
}

export function enrichInterviewContinuationItem(
  item: DashboardContinuationItemPayload,
): DashboardContinuationItemPayload {
  if (item.type !== 'interview') return item;

  const step = normalizeStepKey(item.stepKey);
  const sessionId = interviewSessionIdFromHref(item.ctaHref);
  const resultsPath = item.interviewResumeState?.resultsPath?.trim();
  const resultsHref =
    resultsPath ||
    (sessionId ? `/dashboard/interview/${sessionId}` : item.ctaHref);

  if (step === 'evaluation_processing') {
    const backendCta = item.ctaLabel.trim();
    return {
      ...item,
      title: item.title.trim() || 'Interview results processing',
      description:
        item.description.trim() ||
        'Your answers are being scored in the background. This usually takes under a minute.',
      ctaLabel:
        backendCta && backendCta.toLowerCase() !== 'continue'
          ? backendCta
          : 'Results processing…',
      ctaHref: item.ctaHref.trim() || '/dashboard/continuation',
    };
  }

  if (step === 'results_ready') {
    const backendCta = item.ctaLabel.trim();
    return {
      ...item,
      title: item.title.trim() || 'Interview results ready',
      description:
        item.description.trim() ||
        'Your scored feedback is ready to review.',
      ctaLabel:
        backendCta && backendCta.toLowerCase() !== 'continue' ? backendCta : 'View results',
      ctaHref: resultsHref,
    };
  }

  return item;
}

export function prepareContinuationItemsForDisplay(
  items: DashboardContinuationItemPayload[],
): DashboardContinuationItemPayload[] {
  return items
    .filter(shouldShowInterviewContinuationItem)
    .map(enrichInterviewContinuationItem);
}

export function listContinuationItemsForDisplay(
  plan: TodayPlanPayload | null | undefined,
): DashboardContinuationItemPayload[] {
  return prepareContinuationItemsForDisplay(listContinuationItems(plan));
}
