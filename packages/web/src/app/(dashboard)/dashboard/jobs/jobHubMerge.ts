import { pickCompanyLogoUrl } from '@/lib/companyLogo';
import type {
  ApplicationItem,
  HubBookmarkItem,
  HubPipelineStage,
  JobHistoryItem,
} from '@/lib/api';
import { historyItemHasCompletedAnalysis } from '@/lib/jobAnalysisComplete';

export type HubStage =
  | 'bookmarked'
  | 'analyzed'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'negotiating'
  | 'accepted'
  | 'rejected';
export type HubOrigin = 'job_board' | 'analysis' | 'application' | 'mixed';
export type HubState = 'bookmarked' | 'analyzed' | 'applied';

export const HUB_STAGES: HubStage[] = [
  'bookmarked',
  'analyzed',
  'applied',
  'interviewing',
  'offered',
  'negotiating',
  'accepted',
  'rejected',
];

export const HUB_STAGE_LABELS: Record<HubStage, string> = {
  bookmarked: 'Bookmarked',
  analyzed: 'Analyzed',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offered: 'Offer',
  negotiating: 'Negotiating',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

/** Compact label for sidebar / dense UI. */
export const HUB_STAGE_SHORT_LABELS: Record<HubStage, string> = {
  bookmarked: 'Bookmarked',
  analyzed: 'Analyzed',
  applied: 'Applied',
  interviewing: 'Interview',
  offered: 'Offer',
  negotiating: 'Negotiating',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export type TrackedJob = {
  key: string;
  jobAnalysisId: string | null;
  applicationId: string | null;
  title: string;
  company: string;
  companyLogoUrl?: string | null;
  matchScore: number | null;
  createdAt: string | null;
  stage: HubStage;
  hasAnalysis: boolean;
  /** Job-board discovery listing id (prefill / deep link). */
  boardDiscoveryId?: string | null;
  /** Employer posting URL when known (bookmark or analysis). */
  applyUrl?: string | null;
  /** Description snapshot for “Analyze” prefill before a saved analysis exists. */
  boardDescription?: string | null;
  /** Legacy single application notes string from GET /applications (optional). */
  applicationNotes?: string | null;
  /** Server hub bookmark id — PATCH links & bookmark-scoped notes. */
  hubBookmarkId?: string | null;
  origin: HubOrigin;
  state: HubState;
  isApplied: boolean;
  lastActivityAt?: string | null;
  nextRecommendedAction?: string | null;
  reasonText?: string | null;
  applicationAssist?: {
    hasCvReady: boolean;
    hasTailoredCv: boolean;
    hasCoverLetterDraft: boolean;
    missingFields: string[];
    suggestedNextStep?: string | null;
  };
};

const OVERRIDE_KEY = 'applymate:job-hub:stage-overrides';

export function loadStageOverrides(): Record<string, HubStage> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, HubStage> = {};
    for (const [k, v] of Object.entries(o)) {
      if (HUB_STAGES.includes(v as HubStage)) out[k] = v as HubStage;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveStageOverride(key: string, stage: HubStage) {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadStageOverrides();
    prev[key] = stage;
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

/** Remove one override after a successful server PATCH so API stays canonical (last-write-wins). */
export function clearStageOverride(key: string) {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadStageOverrides();
    delete prev[key];
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

/** Map server pipeline enum → Job Hub UI columns. */
export function hubPipelineStageToHubStage(
  stage: HubPipelineStage,
  opts: { hasJobAnalysis: boolean },
): HubStage {
  switch (stage) {
    case 'saved':
      return opts.hasJobAnalysis ? 'analyzed' : 'bookmarked';
    case 'applied':
      return 'applied';
    case 'interviewing':
      return 'interviewing';
    case 'offered':
      return 'offered';
    case 'negotiating':
      return 'negotiating';
    case 'accepted':
      return 'accepted';
    case 'rejected':
      return 'rejected';
    default:
      return opts.hasJobAnalysis ? 'analyzed' : 'bookmarked';
  }
}

/** Map UI column → server pipeline enum for PATCH bookmark / JobAnalysis.status. */
export function hubStageToHubPipelineStage(stage: HubStage): HubPipelineStage {
  switch (stage) {
    case 'bookmarked':
    case 'analyzed':
      return 'saved';
    case 'applied':
      return 'applied';
    case 'interviewing':
      return 'interviewing';
    case 'offered':
      return 'offered';
    case 'negotiating':
      return 'negotiating';
    case 'accepted':
      return 'accepted';
    case 'rejected':
      return 'rejected';
    default:
      return 'saved';
  }
}

function statusToStage(app: ApplicationItem): HubStage | null {
  const s = app.status;
  if (!s) return null;
  switch (s) {
    case 'draft':
    case 'researching':
    case 'ready_to_apply':
      return 'analyzed';
    case 'interview_scheduled':
    case 'interviewed':
      return 'interviewing';
    case 'offer_received':
      return 'negotiating';
    case 'negotiating':
      return 'negotiating';
    case 'accepted':
      return 'accepted';
    case 'applied':
      return 'applied';
    case 'rejected':
    case 'withdrawn':
    case 'ghosted':
      return 'bookmarked';
    default:
      return null;
  }
}

function historyHasAnalysis(hist: JobHistoryItem | undefined): boolean {
  if (!hist) return false;
  return historyItemHasCompletedAnalysis(hist);
}

function bookmarkHasAnalysis(bookmark: HubBookmarkItem): boolean {
  if (typeof bookmark.hasAnalysis === 'boolean') return bookmark.hasAnalysis;
  return false;
}

function inferDefaultStage(
  hist: JobHistoryItem | undefined,
  app: ApplicationItem | undefined,
): HubStage {
  const analyzed = historyHasAnalysis(hist);
  if (hist && analyzed && !app) return 'analyzed';
  if (!app) return analyzed ? 'analyzed' : 'bookmarked';
  const fromStatus = statusToStage(app);
  if (fromStatus && fromStatus !== 'applied') return fromStatus;
  /** Saved analysis does not imply you applied — stay in Analyzed / Applying until you move the stage. */
  if (app.status === 'applied' && analyzed) return 'analyzed';
  if (app.status === 'applied') return 'applied';
  if (analyzed) return 'analyzed';
  return 'bookmarked';
}

function inferOriginAndState(input: {
  app?: ApplicationItem;
  hasAnalysis: boolean;
  hasBookmark: boolean;
}): { origin: HubOrigin; state: HubState; isApplied: boolean } {
  const hasApp = Boolean(input.app);
  const isApplied = hasApp && input.app?.status === 'applied';
  const state: HubState = isApplied
    ? 'applied'
    : input.hasAnalysis
      ? 'analyzed'
      : 'bookmarked';
  const sourceCount =
    Number(hasApp) + Number(input.hasAnalysis) + Number(input.hasBookmark);
  const origin: HubOrigin =
    sourceCount > 1
      ? 'mixed'
      : hasApp
        ? 'application'
        : input.hasAnalysis
          ? 'analysis'
          : 'job_board';
  return { origin, state, isApplied };
}

function normHubText(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Merge orphan application buckets (`app:*` with no `jobAnalysisId`) into a history bucket when
 * title + company match uniquely — fixes duplicate rows for the same role.
 */
function mergeOrphanApplicationBuckets(
  buckets: Map<string, { hist?: JobHistoryItem; app?: ApplicationItem }>,
) {
  const toDelete: string[] = [];
  for (const [key, bucket] of buckets) {
    if (!key.startsWith('app:')) continue;
    if (bucket.hist) continue;
    const app = bucket.app;
    if (!app) continue;
    if (app.jobAnalysisId?.trim()) continue;

    const at = normHubText(app.title);
    const ac = normHubText(app.company);
    if (!at || !ac) continue;

    const candidates: string[] = [];
    for (const [k2, b2] of buckets) {
      if (k2 === key || k2.startsWith('app:')) continue;
      if (!b2.hist || b2.app) continue;
      const ht = normHubText(b2.hist.jobTitle || b2.hist.title || '');
      const hc = normHubText(b2.hist.company || '');
      if (ht === at && hc === ac) candidates.push(k2);
    }
    if (candidates.length !== 1) continue;
    const mergeKey = candidates[0]!;
    const target = buckets.get(mergeKey)!;
    buckets.set(mergeKey, { ...target, app });
    toDelete.push(key);
  }
  for (const k of toDelete) buckets.delete(k);
}

export function mergeTrackedJobs(
  applications: ApplicationItem[],
  history: JobHistoryItem[],
  overrides: Record<string, HubStage>,
  serverBookmarks: HubBookmarkItem[] = [],
): TrackedJob[] {
  type Bucket = { hist?: JobHistoryItem; app?: ApplicationItem };
  const buckets = new Map<string, Bucket>();

  for (const h of history) {
    buckets.set(h.id, { ...buckets.get(h.id), hist: h });
  }

  for (const a of applications) {
    const jid = a.jobAnalysisId?.trim();
    if (jid) {
      const prev = buckets.get(jid) ?? {};
      buckets.set(jid, { ...prev, app: a });
    } else {
      buckets.set(`app:${a.id}`, { ...buckets.get(`app:${a.id}`), app: a });
    }
  }

  mergeOrphanApplicationBuckets(buckets);

  const rows: TrackedJob[] = [];

  for (const [key, { hist, app }] of buckets) {
    const jobAnalysisId =
      hist?.id ??
      app?.jobAnalysisId?.trim() ??
      (key.startsWith('app:') ? null : key);
    const title =
      hist?.jobTitle || hist?.title || app?.title || 'Untitled role';
    const company = hist?.company || app?.company || '—';
    const companyLogoUrl = hist?.companyLogoUrl ?? app?.companyLogoUrl ?? null;
    const matchScore =
      typeof hist?.matchScore === 'number'
        ? hist.matchScore
        : typeof app?.matchScore === 'number'
          ? app.matchScore
          : null;
    const createdAt = hist?.createdAt ?? app?.createdAt ?? null;
    const hasAnalysis = historyHasAnalysis(hist);
    const sem = inferOriginAndState({
      app,
      hasAnalysis,
      hasBookmark: false,
    });

    const overrideKey = jobAnalysisId ?? app?.id ?? key;
    const overrideStage = overrides[overrideKey] ?? overrides[key];
    const fromServer = hist?.pipelineStatus
      ? hubPipelineStageToHubStage(hist.pipelineStatus, {
          hasJobAnalysis: hasAnalysis,
        })
      : null;
    let stage: HubStage;
    if (fromServer === 'accepted' || fromServer === 'negotiating') {
      stage = fromServer;
    } else if (overrideStage) {
      stage = overrideStage;
    } else if (fromServer) {
      stage = fromServer;
    } else if (app) {
      stage = inferDefaultStage(hist, app);
    } else {
      stage = inferDefaultStage(hist, app);
    }

    const histListingId = hist?.jobListingId?.trim() || null;
    const histApplyUrl = hist?.applyUrl?.trim() || null;

    rows.push({
      key: overrideKey,
      jobAnalysisId,
      applicationId: app?.id ?? null,
      title,
      company,
      companyLogoUrl,
      matchScore,
      createdAt,
      stage,
      hasAnalysis,
      boardDiscoveryId: histListingId,
      ...(histApplyUrl ? { applyUrl: histApplyUrl } : {}),
      boardDescription: null,
      applicationNotes: typeof app?.notes === 'string' ? app.notes : null,
      hubBookmarkId: null,
      origin: sem.origin,
      state: sem.state,
      isApplied: sem.isApplied,
      lastActivityAt: hist?.lastActivityAt ?? app?.lastActivityAt ?? null,
      nextRecommendedAction:
        hist?.nextRecommendedAction ?? app?.nextRecommendedAction ?? null,
      reasonText: hist?.reasonText ?? app?.reasonText ?? null,
      applicationAssist: hist?.applicationAssist ?? app?.applicationAssist,
    });
  }

  const seenAppIds = new Set(
    rows.map((r) => r.applicationId).filter(Boolean) as string[],
  );
  const seenAnalysisIds = new Set(
    rows.map((r) => r.jobAnalysisId).filter(Boolean) as string[],
  );

  for (const b of serverBookmarks) {
    if (b.applicationId && seenAppIds.has(b.applicationId)) continue;
    if (b.jobAnalysisId && seenAnalysisIds.has(b.jobAnalysisId)) continue;
    const overrideKey = `hubbk:${b.id}`;
    const linked = Boolean(b.jobAnalysisId || b.applicationId);
    const explicitBm = Boolean(b.hubPipelineStage);
    const fallback = linked ? 'analyzed' : 'bookmarked';
    const sem = inferOriginAndState({
      app: undefined,
      hasAnalysis: bookmarkHasAnalysis(b),
      hasBookmark: true,
    });
    const stage = explicitBm
      ? hubPipelineStageToHubStage(b.hubPipelineStage!, {
          hasJobAnalysis: bookmarkHasAnalysis(b),
        })
      : (overrides[overrideKey] ?? fallback);
    rows.push({
      key: overrideKey,
      jobAnalysisId: b.jobAnalysisId,
      applicationId: b.applicationId,
      title: b.title,
      company: b.company,
      companyLogoUrl: b.companyLogoUrl ?? null,
      matchScore: null,
      createdAt: b.bookmarkedAt,
      stage,
      hasAnalysis: bookmarkHasAnalysis(b),
      boardDiscoveryId: b.jobListingId || null,
      applyUrl: b.url?.trim() || null,
      boardDescription: b.descriptionSnippet?.trim()
        ? b.descriptionSnippet
        : null,
      applicationNotes: null,
      hubBookmarkId: b.id,
      origin: sem.origin,
      state: sem.state,
      isApplied: sem.isApplied,
      lastActivityAt: b.lastActivityAt ?? b.bookmarkedAt,
      nextRecommendedAction: b.nextRecommendedAction ?? null,
      reasonText: b.reasonText ?? null,
      applicationAssist: b.applicationAssist,
    });
  }

  rows.sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    return tb - ta;
  });

  return rows;
}

/**
 * Map hub stage to backend status when an application row exists.
 * `analyzed` maps to `researching` — pre-apply pipeline (not `applied`).
 */
export function hubStageToApplicationStatus(stage: HubStage): string | null {
  switch (stage) {
    case 'applied':
      return 'applied';
    case 'interviewing':
      return 'interview_scheduled';
    case 'negotiating':
      return 'negotiating';
    case 'accepted':
      return 'accepted';
    case 'bookmarked':
      return 'withdrawn';
    case 'analyzed':
      return 'researching';
    default:
      return null;
  }
}

/** Payload for POST /jobs/archive — prefer bookmark, then analysis, then application. */
export function archivePayloadForTrackedJob(
  job: TrackedJob,
): {
  bookmarkId?: string;
  jobAnalysisId?: string;
  applicationId?: string;
} | null {
  const bid = job.hubBookmarkId?.trim();
  if (bid) return { bookmarkId: bid };
  const jid = job.jobAnalysisId?.trim();
  if (jid) return { jobAnalysisId: jid };
  const aid = job.applicationId?.trim();
  if (aid) return { applicationId: aid };
  return null;
}

/** True if user can remove this row from the hub (archive or listing unbookmark). */
export function canRemoveTrackedJobFromHub(job: TrackedJob): boolean {
  return (
    archivePayloadForTrackedJob(job) !== null ||
    Boolean(job.hubBookmarkId?.trim() && job.boardDiscoveryId?.trim())
  );
}
