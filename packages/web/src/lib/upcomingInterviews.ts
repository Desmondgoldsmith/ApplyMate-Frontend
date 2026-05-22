import type { JobHistoryItem } from '@/lib/api';
import type { UpcomingInterviewItem } from '@/lib/today-plan';

/** Wire value for proactive prep when `Application.status` is `applied`. */
export const UPCOMING_INTERVIEW_STAGE_APPLIED_PREP = 'applied_prep';

export function normalizeUpcomingInterviewStage(stage: string | null | undefined): string {
  return String(stage ?? '')
    .trim()
    .toLowerCase();
}

export function isAppliedPrepUpcomingRow(row: UpcomingInterviewItem): boolean {
  return normalizeUpcomingInterviewStage(row.stage) === UPCOMING_INTERVIEW_STAGE_APPLIED_PREP;
}

function parseInterviewTimestamp(iso: string | null | undefined): number | null {
  const t = iso?.trim() ?? '';
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/** Active interview funnel rows sort above proactive `applied_prep`. */
function stageSortRank(stage: string | null | undefined): number {
  return normalizeUpcomingInterviewStage(stage) === UPCOMING_INTERVIEW_STAGE_APPLIED_PREP ? 1 : 0;
}

/**
 * Mirror backend ordering: future `interviewDate` first; then sooner `daysUntilInterview`;
 * funnel interviews above `applied_prep`; then higher `confidence`.
 */
export function sortUpcomingInterviewsForDashboard(list: UpcomingInterviewItem[]): UpcomingInterviewItem[] {
  const now = Date.now();
  return [...list].sort((a, b) => {
    const dateA = parseInterviewTimestamp(a.interviewDate);
    const dateB = parseInterviewTimestamp(b.interviewDate);
    const futureA = dateA != null && dateA > now;
    const futureB = dateB != null && dateB > now;
    if (futureA && !futureB) return -1;
    if (!futureA && futureB) return 1;
    if (futureA && futureB && dateA !== dateB) return dateA! - dateB!;

    const da =
      typeof a.daysUntilInterview === 'number' && Number.isFinite(a.daysUntilInterview)
        ? a.daysUntilInterview
        : null;
    const db =
      typeof b.daysUntilInterview === 'number' && Number.isFinite(b.daysUntilInterview)
        ? b.daysUntilInterview
        : null;
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;

    const rankA = stageSortRank(a.stage);
    const rankB = stageSortRank(b.stage);
    if (rankA !== rankB) return rankA - rankB;

    const ca =
      typeof a.confidence === 'number' && Number.isFinite(a.confidence) ? a.confidence : -1;
    const cb =
      typeof b.confidence === 'number' && Number.isFinite(b.confidence) ? b.confidence : -1;
    if (ca !== cb) return cb - ca;

    return 0;
  });
}

const DASHBOARD_UPCOMING_CAP = 3;

/**
 * Backend `upcomingInterviews` requires `Application.status === 'applied'` plus `jobAnalysisId`.
 * Job Hub can show Applied from pipeline alone — supplement the dashboard until today-plan catches up.
 */
export function deriveAppliedPrepFromJobHistory(
  history: JobHistoryItem[] | undefined,
  existing: UpcomingInterviewItem[],
): UpcomingInterviewItem[] {
  if (!history?.length) return [];
  const seen = new Set(existing.map((r) => r.jobAnalysisId.trim()).filter(Boolean));
  const out: UpcomingInterviewItem[] = [];
  for (const row of history) {
    if (out.length >= DASHBOARD_UPCOMING_CAP) break;
    const jobAnalysisId = row.id?.trim();
    if (!jobAnalysisId || seen.has(jobAnalysisId)) continue;
    const pipeline = String(row.pipelineStatus ?? '')
      .trim()
      .toLowerCase();
    if (pipeline !== 'applied') continue;
    seen.add(jobAnalysisId);
    const company = row.company?.trim() || null;
    const jobTitle = (row.jobTitle || row.title || '').trim() || null;
    const headline = company ? `Get interview-ready · ${company}` : 'Get interview-ready';
    const supporting =
      jobTitle && company
        ? `You applied for ${jobTitle} at ${company}. Practice now while you wait to hear back.`
        : 'Practice now while you wait to hear back.';
    out.push({
      id: jobAnalysisId,
      jobAnalysisId,
      headline,
      supporting,
      company,
      jobTitle,
      stage: UPCOMING_INTERVIEW_STAGE_APPLIED_PREP,
      interviewDate: null,
      daysUntilInterview: null,
      confidence: null,
      ctaLabel: 'Start interview practice',
      ctaHref: `/dashboard/interview-prep?jobAnalysisId=${encodeURIComponent(jobAnalysisId)}`,
      lastUpdatedAt: row.createdAt ?? null,
    });
  }
  return out;
}

/** Merge API rows with job-history supplement; cap at three after server sort order. */
export function mergeDashboardUpcomingInterviews(
  fromTodayPlan: UpcomingInterviewItem[],
  history: JobHistoryItem[] | undefined,
): UpcomingInterviewItem[] {
  const supplement = deriveAppliedPrepFromJobHistory(history, fromTodayPlan);
  if (!supplement.length) return fromTodayPlan;
  return sortUpcomingInterviewsForDashboard([...fromTodayPlan, ...supplement]).slice(
    0,
    DASHBOARD_UPCOMING_CAP,
  );
}

export function upcomingInterviewsCountBadge(total: number, rows: UpcomingInterviewItem[]): string {
  const applied = rows.filter(isAppliedPrepUpcomingRow).length;
  if (applied === rows.length) {
    return `${total} role${total === 1 ? '' : 's'}`;
  }
  if (applied === 0) {
    return `${total} interview${total === 1 ? '' : 's'}`;
  }
  return `${total} roles`;
}
