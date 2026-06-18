import { z } from 'zod';

import type {
  CvTailorDraft,
  JobAnalysis,
  JobDetailForForm,
  JobHistoryItem,
  JobListingDto,
} from '@/lib/api';

/** Keys must stay aligned with `jobHubPrefill` session bootstrap. */
export const STORAGE_FORM_KEY = 'applymate:dashboard:jobs:analyze-form';
export const STORAGE_ANALYSIS_KEY = 'applymate:dashboard:jobs:last-analysis';
export const STORAGE_COMPLETED_TAILOR_KEY =
  'applymate:dashboard:jobs:completed-tailor-by-fp';
export const STORAGE_LAST_JOB_ID = 'applymate:dashboard:jobs:last-job-id';

export function coverLetterStorageKey(jobId: string) {
  return `applymate:cover-letter:${jobId}`;
}

export function readCoverLetterFromStorage(jobId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(coverLetterStorageKey(jobId));
    return raw?.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function writeCoverLetterToStorage(jobId: string, text: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(coverLetterStorageKey(jobId), text);
  } catch {
    /* ignore */
  }
}

export function tailoringSessionFingerprint(
  cvProfileId: string,
  title: string,
  company: string,
  jobDescription: string,
): string {
  return `${cvProfileId.trim()}\u001f${title.trim()}\u001f${company.trim()}\u001f${jobDescription.trim()}`;
}

/** Fingerprint for job title/company/description only — stale analysis detection. */
export function jobAnalyzeContentFingerprint(
  title: string,
  company: string,
  jobDescription: string,
): string {
  return `${title.trim()}\u001f${company.trim()}\u001f${jobDescription.trim()}`;
}

export function saveCompletedTailorDraft(fp: string, draft: CvTailorDraft) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_COMPLETED_TAILOR_KEY);
    const map: Record<string, CvTailorDraft> = raw
      ? (JSON.parse(raw) as Record<string, CvTailorDraft>)
      : {};
    map[fp] = draft;
    sessionStorage.setItem(STORAGE_COMPLETED_TAILOR_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadCompletedTailorDraft(fp: string): CvTailorDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_COMPLETED_TAILOR_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, CvTailorDraft>;
    return map[fp] ?? null;
  } catch {
    return null;
  }
}

export function removeCompletedTailorDraft(fp: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_COMPLETED_TAILOR_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, CvTailorDraft>;
    delete map[fp];
    sessionStorage.setItem(STORAGE_COMPLETED_TAILOR_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export const jobAnalyzeFormSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  description: z.string().min(30, 'Please paste a fuller job description'),
});

/** Discovery listings often omit full HTML description; merge fields so analyze + auto-run can proceed. */
export function buildAnalyzerDescriptionFromListing(d: JobListingDto): string {
  const chunks = [d.description, d.snippet, d.whyThisJobShort]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  let text = chunks.join('\n\n').trim();
  if (text.length < 30) {
    const meta = [
      d.title?.trim() ? `Job title: ${d.title.trim()}` : '',
      d.company?.trim() ? `Company: ${d.company.trim()}` : '',
      d.location?.trim() ? `Location: ${d.location.trim()}` : '',
      d.url?.trim() ? `Listing URL: ${d.url.trim()}` : '',
    ].filter(Boolean);
    if (meta.length) {
      text = [text, meta.join('\n')].filter(Boolean).join('\n\n');
    }
  }
  return text;
}

const MIN_DESC_MANUAL_ANALYZE = 30;
const MIN_DESC_LISTING_ANALYZE = 10;

export function minDescriptionCharsForAnalyze(
  jobListingId: string | undefined | null,
): number {
  return (jobListingId ?? '').trim()
    ? MIN_DESC_LISTING_ANALYZE
    : MIN_DESC_MANUAL_ANALYZE;
}

export function loadPersistedForm(): {
  title: string;
  company: string;
  description: string;
} {
  if (typeof window === 'undefined') {
    return { title: '', company: '', description: '' };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_FORM_KEY);
    if (!raw) return { title: '', company: '', description: '' };
    const p = JSON.parse(raw) as {
      title?: unknown;
      company?: unknown;
      description?: unknown;
    };
    return {
      title: typeof p.title === 'string' ? p.title : '',
      company: typeof p.company === 'string' ? p.company : '',
      description: typeof p.description === 'string' ? p.description : '',
    };
  } catch {
    return { title: '', company: '', description: '' };
  }
}

export function loadPersistedAnalysis(): JobAnalysis | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_ANALYSIS_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as JobAnalysis;
    if (
      a &&
      typeof a === 'object' &&
      typeof a.matchScore === 'number' &&
      Number.isFinite(a.matchScore)
    ) {
      return a;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function persistSessionSnapshot(
  nextTitle: string,
  nextCompany: string,
  nextDescription: string,
  nextAnalysis: JobAnalysis | null,
) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    STORAGE_FORM_KEY,
    JSON.stringify({
      title: nextTitle,
      company: nextCompany,
      description: nextDescription,
    }),
  );
  if (nextAnalysis) {
    sessionStorage.setItem(STORAGE_ANALYSIS_KEY, JSON.stringify(nextAnalysis));
  } else {
    sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
  }
}

export function jobHistoryItemToDetail(item: JobHistoryItem): JobDetailForForm {
  const desc = item.description ?? item.jobDescription ?? '';
  const jt = item.jobTitle || item.title || '';
  const srcCv = item.cvProfileId?.trim();
  const jl = item.jobListingId?.trim();
  const jh = item.jobListingSourceHash?.trim();
  const analyzeSource = item.analyzeSource?.trim().toLowerCase();
  const scoreSource =
    analyzeSource === 'ai' || analyzeSource === 'gemini'
      ? 'ai'
      : item.hasAnalysis === false
        ? 'heuristic'
        : undefined;
  return {
    title: jt,
    company: item.company ?? '',
    description: desc,
    analysis: {
      id: item.id,
      title: jt,
      company: item.company,
      matchScore: item.matchScore ?? 0,
      scoreBeforeTailoring: item.scoreBeforeTailoring,
      isTailored: item.isTailored,
      tailoredCvProfileId: item.tailoredCvProfileId,
      tailoredCvName: item.tailoredCvName,
      ...(item.hasAnalysis !== undefined ? { hasAnalysis: item.hasAnalysis } : {}),
      ...(item.analyzeSource ? { analyzeSource: item.analyzeSource } : {}),
      ...(scoreSource ? { scoreSource } : {}),
      ...(srcCv ? { cvProfileId: srcCv, sourceCvProfileId: srcCv } : {}),
      ...(jl ? { jobListingId: jl } : {}),
      ...(jh ? { jobListingSourceHash: jh } : {}),
      strengths: [],
      missingSkills: [],
      ...(item.salaryEstimate != null
        ? { salaryEstimate: item.salaryEstimate }
        : {}),
      ...(item.analysisV2 ? { analysisV2: item.analysisV2 } : {}),
    },
  };
}

/** Match saved analysis rows to history list items (session restore often omits job id). */
export function historyRowKey(jobTitle: string, company: string): string {
  return `${jobTitle.trim().toLowerCase()}\u001f${company.trim().toLowerCase()}`;
}

/**
 * When GET /jobs/:id returns a narrower analysis, do not drop tailor flags from prior state for the same job.
 * If both IDs are set and differ, do not merge (different jobs).
 */
export function mergeJobAnalysisForApply(
  prev: JobAnalysis | null,
  incoming: JobAnalysis,
): JobAnalysis {
  const prevId = (prev?.id ?? '').trim();
  const incomingId = (incoming.id ?? '').trim();
  const bothIds = Boolean(prevId && incomingId);
  const sameJob = bothIds ? prevId === incomingId : true;

  if (!sameJob || !prev) {
    return { ...incoming };
  }

  const base: JobAnalysis = { ...incoming };

  if (incoming.isTailored === false) {
    base.scoreImprovement = undefined;
    base.skillsAddedToCv = undefined;
  }

  const incName = incoming.tailoredCvName;
  if (
    (incName === undefined ||
      incName === null ||
      String(incName).trim() === '') &&
    prev.tailoredCvName
  ) {
    base.tailoredCvName = prev.tailoredCvName;
  }

  if (
    (incoming.scoreBeforeTailoring === undefined ||
      incoming.scoreBeforeTailoring === null) &&
    prev.scoreBeforeTailoring != null &&
    Number.isFinite(prev.scoreBeforeTailoring)
  ) {
    base.scoreBeforeTailoring = prev.scoreBeforeTailoring;
  }

  if (
    (incoming.tailoredCvProfileId === undefined ||
      incoming.tailoredCvProfileId === null) &&
    prev.tailoredCvProfileId
  ) {
    base.tailoredCvProfileId = prev.tailoredCvProfileId;
  }

  if (
    (incoming.sourceCvProfileId === undefined ||
      incoming.sourceCvProfileId === null) &&
    prev.sourceCvProfileId
  ) {
    base.sourceCvProfileId = prev.sourceCvProfileId;
  }

  if (
    (incoming.cvProfileId === undefined || incoming.cvProfileId === null) &&
    prev.cvProfileId
  ) {
    base.cvProfileId = prev.cvProfileId;
  }

  if (
    (incoming.jobListingId === undefined || incoming.jobListingId === null) &&
    prev.jobListingId
  ) {
    base.jobListingId = prev.jobListingId;
  }

  if (
    (incoming.jobListingSourceHash === undefined ||
      incoming.jobListingSourceHash === null) &&
    prev.jobListingSourceHash
  ) {
    base.jobListingSourceHash = prev.jobListingSourceHash;
  }

  if (
    incoming.salaryEstimate === undefined &&
    prev.salaryEstimate !== undefined
  ) {
    base.salaryEstimate = prev.salaryEstimate;
  }

  if (incoming.analysisV2 === undefined && prev.analysisV2) {
    base.analysisV2 = prev.analysisV2;
  }

  if (
    (incoming.matchCvProfileId === undefined || incoming.matchCvProfileId === null) &&
    prev.matchCvProfileId
  ) {
    base.matchCvProfileId = prev.matchCvProfileId;
  }

  if (incoming.factorsBreakdown === undefined && prev.factorsBreakdown && incoming.isTailored !== false) {
    base.factorsBreakdown = prev.factorsBreakdown;
  }

  if (incoming.matchScoreBenchmark === undefined && prev.matchScoreBenchmark) {
    base.matchScoreBenchmark = prev.matchScoreBenchmark;
  }

  if (incoming.atsRiskItems === undefined && prev.atsRiskItems?.length) {
    base.atsRiskItems = prev.atsRiskItems;
  }

  if (
    incoming.interviewReadinessNote === undefined &&
    prev.interviewReadinessNote
  ) {
    base.interviewReadinessNote = prev.interviewReadinessNote;
  }

  return base;
}
