import { clearToken, getToken } from '@/shared/storage';
import type {
  AiUsageSnapshot,
  CheckResponse,
  CoverLetterResult,
  CvProfile,
  CvScoreResult,
  ExtractedJob,
  InitiateTailorPayload,
  SaveJobPayload,
  SavedJob,
  TailorSession,
  User,
} from '@/shared/types';

export class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
  }
}

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
  /\/$/,
  '',
);

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: { message?: string; statusCode?: number } | null;
};

async function parseApiEnvelope<T>(res: Response): Promise<T> {
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) throw new ApiRequestError(`API error ${res.status}`, res.status);
    throw new ApiRequestError('Invalid API response', res.status);
  }

  if (!res.ok || !body.success) {
    throw new ApiRequestError(
      body.error?.message ?? `API error ${res.status}`,
      body.error?.statusCode ?? res.status,
    );
  }

  return body.data;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    await clearToken();
    chrome.runtime.sendMessage({ action: 'unauthorized' }).catch(() => {
      /* no listeners */
    });
  }

  return parseApiEnvelope<T>(res);
}

type ApiExtractedJob = Omit<ExtractedJob, 'extractedBy'> & {
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
};

type ExtractJobApiResponse = ApiExtractedJob & {
  fromCache?: boolean;
  aiUsage?: AiUsageSnapshot;
};

export type ExtractJobResult = {
  job: ExtractedJob;
  fromCache: boolean;
  aiUsage?: AiUsageSnapshot;
};

function mapApiExtractedJob(data: ApiExtractedJob): ExtractedJob {
  return {
    title: data.title?.trim() ?? '',
    company: data.company?.trim() ?? '',
    location: data.location?.trim() ?? '',
    description: data.description?.trim() ?? '',
    salary: data.salary,
    jobType: data.jobType,
    experienceLevel: data.experienceLevel,
    postedDate: data.postedDate,
    sourceUrl: data.sourceUrl,
    sourceSite: data.sourceSite,
    confidence: data.confidence,
    extractedBy: 'ai-fallback',
  };
}

function mapApiScoreResult(data: CvScoreResult): CvScoreResult {
  return {
    matchScore: data.matchScore,
    scoreLabel: data.scoreLabel,
    factors: data.factors,
    topStrengths: data.topStrengths ?? [],
    topGaps: data.topGaps ?? [],
    missingSkills: data.missingSkills ?? [],
    skillCoverage: data.skillCoverage ?? [],
    skillsToHighlight: data.skillsToHighlight ?? [],
    recommendation: data.recommendation ?? '',
    jobAnalysisId: data.jobAnalysisId,
    dashboardUrl: data.dashboardUrl,
    persisted: data.persisted,
    fromCache: data.fromCache,
    aiUsage: data.aiUsage,
    scoreSource: data.scoreSource,
    salaryEstimate: data.salaryEstimate ?? null,
    locationEligibility: data.locationEligibility ?? null,
  };
}

export const extractionApi = {
  extractJob: async (payload: {
    rawText: string;
    pageTitle: string;
    pageUrl: string;
  }): Promise<ExtractJobResult> => {
    const data = await apiFetch<ExtractJobApiResponse>('/extension/extract-job', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      job: mapApiExtractedJob(data),
      fromCache: Boolean(data.fromCache),
      aiUsage: data.aiUsage,
    };
  },
};

export type ExtensionAuthPayload = {
  extensionToken: string;
  expiresAt: string;
  user?: User;
};

export const authApi = {
  getMe: () => apiFetch<User>('/auth/extension/me'),

  /** Mint extension JWT from a web access token (no extension token side effects on 401). */
  mintExtensionToken: async (accessToken: string): Promise<ExtensionAuthPayload> => {
    const res = await fetch(`${API_BASE}/auth/extension-token`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return parseApiEnvelope<ExtensionAuthPayload>(res);
  },

  /** Preferred: sync from HttpOnly refresh cookie on the API origin. */
  syncFromBrowserSession: async (): Promise<ExtensionAuthPayload> => {
    const res = await fetch(`${API_BASE}/auth/extension/sync`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return parseApiEnvelope<ExtensionAuthPayload>(res);
  },
};

export const jobsApi = {
  save: (payload: SaveJobPayload) =>
    apiFetch<{ id: string; status: string }>('/extension/jobs/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  check: (url: string) =>
    apiFetch<CheckResponse>(`/extension/jobs/check?url=${encodeURIComponent(url)}`),

  recent: (limit = 10) =>
    apiFetch<SavedJob[]>(`/extension/jobs/recent?limit=${limit}`),
};

export const cvApi = {
  getProfiles: () => apiFetch<CvProfile[]>('/extension/cv/profiles'),

  getAiUsage: () => apiFetch<AiUsageSnapshot>('/extension/ai-usage'),

  getScore: (payload: {
    cvId: string;
    jobDescription: string;
    jobTitle: string;
    company?: string;
    jobAnalysisId?: string | null;
    sourceUrl?: string;
    sourceSite?: string;
  }) =>
    apiFetch<CvScoreResult>('/extension/cv/score', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(mapApiScoreResult),

  generateCoverLetter: (payload: {
    cvId: string;
    jobDescription: string;
    jobTitle: string;
    company: string;
    jobLocation?: string;
    jobType?: string;
    jobAnalysisId?: string | null;
    sourceUrl?: string;
  }) =>
    apiFetch<CoverLetterResult>('/extension/cover-letter', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const tailorApi = {
  initiate: (payload: InitiateTailorPayload) =>
    apiFetch<TailorSession>('/extension/tailor/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSession: (sessionId: string) =>
    apiFetch<Record<string, unknown>>(`/extension/tailor/session/${sessionId}`),

  complete: (sessionId: string, tailoredCvId: string) =>
    apiFetch<{ success: boolean; returnToUrl: string; tailoredCvId: string }>(
      '/extension/tailor/complete',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId, tailoredCvId }),
      },
    ),

  getStatus: (sessionId: string) =>
    apiFetch<{ completed: boolean; tailoredCvId: string | null }>(
      `/extension/tailor/status/${sessionId}`,
    ),
};
