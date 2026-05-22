function unwrapApiDataEnvelope(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if (o.success === true && o.data != null && typeof o.data === 'object' && !Array.isArray(o.data)) {
    return o.data as Record<string, unknown>;
  }
  return o;
}

export type JobJourneyStage =
  | 'DISCOVERED'
  | 'VIEWED'
  | 'ANALYZED'
  | 'TAILORED'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'REJECTED';

export type CareerPipelineJob = {
  jobId: string;
  /** Deep link to saved analysis when present (career dashboard accepted rows). */
  jobAnalysisId?: string | null;
  jobListingId?: string | null;
  pipelineStage: JobJourneyStage;
  company: string | null;
  title: string | null;
  matchScore: number | null;
  lastEventAt: string;
};

export type CareerBadge = {
  code: string;
  title: string;
  description: string;
  shareText: string;
  shareLink: string | null;
  earnedAt: string;
};

export type CareerDashboard = {
  activePipelineJobs: CareerPipelineJob[];
  acceptedJobs: CareerPipelineJob[];
  recentActivity: Array<{
    id: string;
    jobId: string;
    stage: JobJourneyStage;
    createdAt: string;
    metadata: Record<string, unknown> | null;
  }>;
  badges: CareerBadge[];
  insights: {
    strongestSkill: string | null;
    conversionRate: number | null;
    avgMatchScoreOfAppliedJobs: number | null;
  };
};

export type MarkJobAcceptedResult = {
  stage: 'ACCEPTED';
  badge: CareerBadge | null;
};

export type VerificationSubmitResult = {
  id: string;
  pendingApproval: boolean;
  verified: boolean;
  premiumActiveUntil?: string | null;
};

function parseStage(raw: unknown): JobJourneyStage {
  const s = String(raw ?? '').toUpperCase();
  const allowed: JobJourneyStage[] = [
    'DISCOVERED',
    'VIEWED',
    'ANALYZED',
    'TAILORED',
    'APPLIED',
    'INTERVIEW',
    'NEGOTIATING',
    'ACCEPTED',
    'REJECTED',
  ];
  return allowed.includes(s as JobJourneyStage) ? (s as JobJourneyStage) : 'VIEWED';
}

function parsePipelineJob(raw: unknown): CareerPipelineJob | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const jobId = String(o.jobId ?? o.job_id ?? '').trim();
  if (!jobId) return null;
  const scoreRaw = o.matchScore ?? o.match_score;
  const score =
    typeof scoreRaw === 'number' && Number.isFinite(scoreRaw)
      ? Math.round(scoreRaw)
      : typeof scoreRaw === 'string'
        ? parseFloat(scoreRaw)
        : null;
  const jaRaw = o.jobAnalysisId ?? o.job_analysis_id;
  const jlRaw = o.jobListingId ?? o.job_listing_id;
  const jobAnalysisId =
    typeof jaRaw === 'string' && jaRaw.trim() ? jaRaw.trim() : null;
  const jobListingId =
    typeof jlRaw === 'string' && jlRaw.trim() ? jlRaw.trim() : null;
  return {
    jobId,
    jobAnalysisId,
    jobListingId,
    pipelineStage: parseStage(o.pipelineStage ?? o.pipeline_stage),
    company: typeof o.company === 'string' ? o.company : null,
    title: typeof o.title === 'string' ? o.title : null,
    matchScore: score != null && Number.isFinite(score) ? score : null,
    lastEventAt: String(o.lastEventAt ?? o.last_event_at ?? new Date().toISOString()),
  };
}

export function parseBadge(raw: unknown): CareerBadge | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const code = String(o.code ?? '').trim();
  if (!code) return null;
  return {
    code,
    title: String(o.title ?? ''),
    description: String(o.description ?? ''),
    shareText: String(o.shareText ?? o.share_text ?? ''),
    shareLink:
      typeof o.shareLink === 'string'
        ? o.shareLink
        : typeof o.share_link === 'string'
          ? o.share_link
          : null,
    earnedAt: String(o.earnedAt ?? o.earned_at ?? new Date().toISOString()),
  };
}

export function normalizeCareerDashboard(raw: unknown): CareerDashboard {
  const body = unwrapApiDataEnvelope(raw) as Record<string, unknown>;
  const active = Array.isArray(body.activePipelineJobs)
    ? body.activePipelineJobs
    : Array.isArray(body.active_pipeline_jobs)
      ? body.active_pipeline_jobs
      : [];
  const accepted = Array.isArray(body.acceptedJobs)
    ? body.acceptedJobs
    : Array.isArray(body.accepted_jobs)
      ? body.accepted_jobs
      : [];
  const activity = Array.isArray(body.recentActivity)
    ? body.recentActivity
    : Array.isArray(body.recent_activity)
      ? body.recent_activity
      : [];
  const badgesRaw = Array.isArray(body.badges) ? body.badges : [];
  const insightsRaw =
    body.insights !== null && typeof body.insights === 'object' && !Array.isArray(body.insights)
      ? (body.insights as Record<string, unknown>)
      : {};

  return {
    activePipelineJobs: active
      .map(parsePipelineJob)
      .filter((x): x is CareerPipelineJob => x !== null),
    acceptedJobs: accepted
      .map(parsePipelineJob)
      .filter((x): x is CareerPipelineJob => x !== null),
    recentActivity: activity
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x))
      .map((o) => ({
        id: String(o.id ?? ''),
        jobId: String(o.jobId ?? o.job_id ?? ''),
        stage: parseStage(o.stage),
        createdAt: String(o.createdAt ?? o.created_at ?? ''),
        metadata:
          o.metadata !== null && typeof o.metadata === 'object' && !Array.isArray(o.metadata)
            ? (o.metadata as Record<string, unknown>)
            : null,
      }))
      .filter((e) => e.id && e.jobId),
    badges: badgesRaw.map(parseBadge).filter((x): x is CareerBadge => x !== null),
    insights: {
      strongestSkill:
        typeof insightsRaw.strongestSkill === 'string'
          ? insightsRaw.strongestSkill
          : typeof insightsRaw.strongest_skill === 'string'
            ? insightsRaw.strongest_skill
            : null,
      conversionRate:
        typeof insightsRaw.conversionRate === 'number'
          ? insightsRaw.conversionRate
          : typeof insightsRaw.conversion_rate === 'number'
            ? insightsRaw.conversion_rate
            : null,
      avgMatchScoreOfAppliedJobs:
        typeof insightsRaw.avgMatchScoreOfAppliedJobs === 'number'
          ? insightsRaw.avgMatchScoreOfAppliedJobs
          : typeof insightsRaw.avg_match_score_of_applied_jobs === 'number'
            ? insightsRaw.avg_match_score_of_applied_jobs
            : null,
    },
  };
}

export function parseMarkAcceptedResult(raw: unknown): MarkJobAcceptedResult {
  const body = unwrapApiDataEnvelope(raw);
  const badge = parseBadge(body.badge);
  return { stage: 'ACCEPTED', badge };
}

export function parseVerificationSubmitResult(raw: unknown): VerificationSubmitResult {
  const body = unwrapApiDataEnvelope(raw);
  const premiumRaw = body.premiumActiveUntil ?? body.premium_active_until;
  return {
    id: String(body.id ?? ''),
    pendingApproval: body.pendingApproval === true || body.pending_approval === true,
    verified: body.verified === true,
    premiumActiveUntil:
      typeof premiumRaw === 'string' && premiumRaw.trim() ? premiumRaw.trim() : null,
  };
}

export const JOURNEY_STAGE_LABEL: Record<JobJourneyStage, string> = {
  DISCOVERED: 'Discovered',
  VIEWED: 'Interested',
  ANALYZED: 'Analyzed',
  TAILORED: 'CV tailored',
  APPLIED: 'Applied',
  INTERVIEW: 'Interviewing',
  NEGOTIATING: 'Offer stage',
  ACCEPTED: 'Accepted',
  REJECTED: 'Passed',
};
