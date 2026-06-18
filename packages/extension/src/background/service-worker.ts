import { ApiRequestError, authApi, cvApi, extractionApi, formatExtensionApiError, jobsApi, tailorApi } from '@/shared/api';
import {
  buildCoverLetterPayload,
  formatCoverLetterValidationError,
} from '@/shared/cover-letter-payload';
import {
  buildCvScorePayload,
  formatCvScoreValidationError,
} from '@/shared/cv-score-payload';
import {
  buildSaveJobPayloadFromExtracted,
  shouldSyncLogoAfterAnalyze,
} from '@/shared/save-job-payload';
import { markWebLogout, syncExtensionAuth } from '@/shared/auth-sync';
import {
  applyCheckToSession,
  applyServerStateToSession,
  clearAllExtensionJobStorage,
  clearJobStorageForUrl,
  canReuseCachedScore,
  emptyJobSession,
  extractLockKey,
  mergeJobSession,
  pinnedSessionHasLoadedJob,
  persistCoverLetterLocal,
  readJobSession,
  savedJobStorageKey,
  writeJobSession,
} from '@/shared/job-session';
import { jobContentFingerprint } from '@/shared/job-content-fingerprint';
import {
  clearInFlight,
  readInFlight,
  setInFlight,
} from '@/shared/in-flight-ops';
import {
  canonicalJobViewUrl,
  isApplyMateAppUrl,
  isProbeableWebUrl,
  normalizeJobPageUrl,
  urlLooksLikeJobListing,
} from '@/shared/job-page-url';
import {
  configureSidePanel,
  ensureSidePanelForTab,
  openSidebarForTab,
  openSidebarFromSender,
} from '@/shared/open-sidebar';
import {
  clearIconPosition,
  clearToken,
  getCachedUser,
  getToken,
  setCachedUser,
  setToken,
} from '@/shared/storage';
import { syncWebSessionToDashboardTabs } from '@/shared/web-session-sync';
import type {
  AiUsageSnapshot,
  CheckResponse,
  CoverLetterResult,
  CvScoreResult,
  ExtractedJob,
  ExtensionJobSession,
  GetAuthStateResponse,
  GetJobSessionResponse,
  MessageAction,
  RequestExtractionResponse,
  OpenRecentJobResponse,
  RequestRecentJobsResponse,
  SaveJobPayload,
  SetTokenResponse,
  SyncAuthResponse,
} from '@/shared/types';

const CURRENT_JOB_KEY = 'currentJob';
const PINNED_JOB_URL_KEY = 'pinnedJobUrl';
const DISMISSED_NEW_JOB_URLS_KEY = 'dismissedNewJobUrls';
const PENDING_NEW_JOB_OFFER_KEY = 'pendingNewJobOfferUrl';
const ACTIVE_TAILOR_SESSION_KEY = 'activeTailorSession';
const JOB_PROBE_RETRY_MS = 400;
const JOB_PROBE_ATTEMPTS = 2;
const JOB_CHECK_COOLDOWN_MS = 45_000;

/** Sidebar is showing this job URL — ignore session updates from other tabs. */
let focusedSidebarUrl: string | null = null;
const lastCheckAtByUrl = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wipeExtensionJobCache(url?: string | null): Promise<void> {
  if (url?.trim()) {
    await clearJobStorageForUrl(url);
  }
  await clearAllExtensionJobStorage();
  await clearIconPosition();
  focusedSidebarUrl = null;
  lastCheckAtByUrl.clear();
}

async function writeSavedJobToSession(
  url: string,
  jobId: string,
  status: string,
): Promise<void> {
  await chrome.storage.session.set({
    [savedJobStorageKey(url)]: JSON.stringify({ jobId, status }),
  });
}

async function validateAuthInBackground(): Promise<void> {
  const token = await getToken();
  if (!token) return;
  try {
    const user = await authApi.getMe();
    await setCachedUser(user);
  } catch {
    await clearToken();
    void chrome.runtime.sendMessage({ action: 'unauthorized' }).catch(() => {
      /* sidebar may be closed */
    });
  }
}

async function handleGetAuthState(): Promise<GetAuthStateResponse> {
  const extensionToken = await getToken();
  const cachedUser = await getCachedUser();

  if (extensionToken && cachedUser) {
    void validateAuthInBackground();
    return { isAuthenticated: true, user: cachedUser };
  }

  if (extensionToken) {
    try {
      const user = await authApi.getMe();
      await setCachedUser(user);
      return { isAuthenticated: true, user };
    } catch {
      await clearToken();
    }
  }

  const synced = await syncExtensionAuth();
  if (synced.ok) {
    return { isAuthenticated: true, user: synced.user };
  }

  return { isAuthenticated: false };
}

/** Always re-sync from browser session (refresh cookie / dashboard tab), per backend handoff. */
async function handleSyncAuth(): Promise<SyncAuthResponse> {
  const synced = await syncExtensionAuth();
  if (synced.ok) {
    await setCachedUser(synced.user);
    void syncWebSessionToDashboardTabs();
    return { isAuthenticated: true, user: synced.user };
  }

  const existingToken = await getToken();
  if (existingToken) {
    try {
      const user = await authApi.getMe();
      await setCachedUser(user);
      return { isAuthenticated: true, user };
    } catch {
      await clearToken();
    }
  }

  void chrome.runtime.sendMessage({ action: 'unauthorized' }).catch(() => {
    /* sidebar may be closed */
  });
  return { isAuthenticated: false };
}

function notifySidebarAuthUpdated(): void {
  void chrome.runtime.sendMessage({ action: 'authUpdated' }).catch(() => {
    /* sidebar may be closed */
  });
}

async function handleSetToken(message: Extract<MessageAction, { action: 'setToken' }>) {
  const payload = message as Extract<MessageAction, { action: 'setToken' }> & {
    expiresAt?: string;
  };
  await setToken(payload.token, payload.expiresAt);
  notifySidebarAuthUpdated();
  return { success: true } satisfies SetTokenResponse;
}

async function storeCurrentJob(job: ExtractedJob): Promise<void> {
  await chrome.storage.session.set({ [CURRENT_JOB_KEY]: JSON.stringify(job) });
}

async function readCurrentJob(): Promise<ExtractedJob | null> {
  const stored = await chrome.storage.session.get(CURRENT_JOB_KEY);
  const raw = stored[CURRENT_JOB_KEY];
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as ExtractedJob;
  } catch {
    return null;
  }
}

async function pinJobUrl(url: string): Promise<void> {
  if (!url || isApplyMateAppUrl(url)) return;
  await chrome.storage.session.set({ [PINNED_JOB_URL_KEY]: url });
}

async function readPinnedJobUrl(): Promise<string | null> {
  const stored = await chrome.storage.session.get(PINNED_JOB_URL_KEY);
  const raw = stored[PINNED_JOB_URL_KEY];
  return typeof raw === 'string' && !isApplyMateAppUrl(raw) ? raw : null;
}

function linkedInJobKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('linkedin.com')) return null;
    const fromQuery =
      parsed.searchParams.get('currentJobId') ?? parsed.searchParams.get('jobId');
    if (fromQuery && /^\d+$/.test(fromQuery)) return `linkedin:${fromQuery}`;
    const pathMatch = parsed.pathname.match(/\/jobs\/view\/(\d+)/i);
    if (pathMatch?.[1]) return `linkedin:${pathMatch[1]}`;
  } catch {
    /* skip */
  }
  return null;
}

function enrichWithLogo(job: ExtractedJob): ExtractedJob {
  if (job.logoCandidateUrl?.trim()) return job;
  if (!job.company?.trim()) return job;

  const slug = job.company
    .toLowerCase()
    .replace(/\b(limited|ltd|inc|llc|corp|co|pvt|pty|gmbh|srl|org)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (slug.length <= 2) return job;

  return {
    ...job,
    logoCandidateUrl: `https://logo.clearbit.com/${slug}.com`,
    logoSource: 'clearbit',
  };
}

function urlsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const linkedInA = linkedInJobKeyFromUrl(a);
  const linkedInB = linkedInJobKeyFromUrl(b);
  if (linkedInA && linkedInB) return linkedInA === linkedInB;
  try {
    return normalizeJobPageUrl(a) === normalizeJobPageUrl(b);
  } catch {
    return false;
  }
}

function dismissKeyForJobUrl(url: string): string {
  const linkedInKey = linkedInJobKeyFromUrl(url);
  if (linkedInKey) return linkedInKey;
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    return normalizeJobPageUrl(trimmed) ?? trimmed;
  } catch {
    return trimmed;
  }
}

async function readDismissedNewJobUrls(): Promise<Set<string>> {
  const stored = await chrome.storage.session.get(DISMISSED_NEW_JOB_URLS_KEY);
  const raw = stored[DISMISSED_NEW_JOB_URLS_KEY];
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0),
  );
}

async function writeDismissedNewJobUrls(urls: Set<string>): Promise<void> {
  await chrome.storage.session.set({
    [DISMISSED_NEW_JOB_URLS_KEY]: [...urls],
  });
}

async function isDismissedNewJob(url: string): Promise<boolean> {
  const key = dismissKeyForJobUrl(url);
  if (!key) return false;
  const dismissed = await readDismissedNewJobUrls();
  return dismissed.has(key);
}

async function dismissNewJobUrl(url: string): Promise<void> {
  const key = dismissKeyForJobUrl(url);
  if (!key) return;
  const dismissed = await readDismissedNewJobUrls();
  dismissed.add(key);
  await writeDismissedNewJobUrls(dismissed);
}

async function clearDismissedNewJob(url: string): Promise<void> {
  const key = dismissKeyForJobUrl(url);
  if (!key) return;
  const dismissed = await readDismissedNewJobUrls();
  dismissed.delete(key);
  await writeDismissedNewJobUrls(dismissed);
}

async function resolvePinnedOrCachedJobUrl(): Promise<string | null> {
  const pinned = await readPinnedJobUrl();
  if (pinned) return pinned;
  const cached = await readCurrentJob();
  if (cached?.sourceUrl && !isApplyMateAppUrl(cached.sourceUrl)) {
    return cached.sourceUrl;
  }
  return null;
}

async function mergeScoreLogoIntoSession(
  sessionUrl: string,
  result: CvScoreResult,
): Promise<void> {
  if (!result.companyLogoUrl?.trim()) return;

  const existing = (await readJobSession(sessionUrl)) ?? emptyJobSession(sessionUrl);
  const mergedCheck: CheckResponse = {
    ...(existing.check ?? {
      saved: true,
      jobId: null,
      status: null,
    }),
    saved: existing.check?.saved ?? true,
    jobId: result.jobAnalysisId ?? existing.check?.jobId ?? existing.jobAnalysisId,
    companyLogoUrl: result.companyLogoUrl,
  };
  await mergeJobSession(sessionUrl, {
    check: mergedCheck,
    jobAnalysisId: result.jobAnalysisId ?? existing.jobAnalysisId,
  });
}

async function syncJobLogoAfterAnalyze(
  sessionUrl: string,
  job: ExtractedJob,
  check: CheckResponse | null | undefined,
): Promise<void> {
  if (!shouldSyncLogoAfterAnalyze(job, check)) return;

  try {
    const saveResult = await jobsApi.save(buildSaveJobPayloadFromExtracted(job));
    const existing = (await readJobSession(sessionUrl)) ?? emptyJobSession(sessionUrl);
    const mergedCheck: CheckResponse = {
      ...(existing.check ?? {
        saved: true,
        jobId: null,
        status: null,
      }),
      saved: existing.check?.saved ?? true,
      jobId: saveResult.id ?? existing.check?.jobId ?? existing.jobAnalysisId,
      status: saveResult.status ?? existing.check?.status ?? null,
      companyLogoUrl: saveResult.companyLogoUrl ?? null,
    };
    const updated = await mergeJobSession(sessionUrl, {
      jobAnalysisId: saveResult.id ?? existing.jobAnalysisId,
      check: mergedCheck,
    });
    notifyJobSessionUpdated(updated);
  } catch {
    /* Logo sync is best-effort; score result is already persisted. */
  }
}

async function persistScoreSession(
  url: string,
  result: CvScoreResult,
  patch: {
    jobAnalysisId?: string | null;
    selectedCvId?: string;
    extractedJob?: ExtractedJob | null;
  },
): Promise<ExtensionJobSession> {
  const existing = url ? await readJobSession(url) : null;
  const job =
    patch.extractedJob ??
    existing?.extractedJob ??
    (await readCurrentJob());
  const updated = await mergeJobSession(url, {
    score: result,
    jobAnalysisId: result.jobAnalysisId ?? patch.jobAnalysisId ?? null,
    selectedCvId:
      result.selectedCvProfileId?.trim() ??
      patch.selectedCvId ??
      existing?.selectedCvId ??
      null,
    ...(job ? { extractedJob: job } : {}),
  });
  if (job?.sourceUrl) {
    await pinJobUrl(job.sourceUrl);
    await storeCurrentJob(job);
  }
  return updated;
}

async function isJobOnActiveTab(job: ExtractedJob): Promise<boolean> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeUrl = activeTab?.url?.trim() ?? '';
  if (!activeUrl) return false;
  if (activeUrl === job.sourceUrl) return true;
  const activeLinkedIn = linkedInJobKeyFromUrl(activeUrl);
  const jobLinkedIn = linkedInJobKeyFromUrl(job.sourceUrl);
  if (activeLinkedIn && jobLinkedIn) return activeLinkedIn === jobLinkedIn;
  try {
    return normalizeJobPageUrl(activeUrl) === normalizeJobPageUrl(job.sourceUrl);
  } catch {
    return false;
  }
}

async function shouldPromptBeforeReplacingJob(
  job: ExtractedJob,
): Promise<{ prompt: true; pinned: string; pinnedSession: ExtensionJobSession } | { prompt: false }> {
  const onActiveTab = await isJobOnActiveTab(job);
  if (!onActiveTab) return { prompt: false };

  const pinned = await readPinnedJobUrl();
  if (!pinned || urlsMatch(job.sourceUrl, pinned)) return { prompt: false };

  const pinnedSession = (await readJobSession(pinned)) ?? emptyJobSession(pinned);
  if (!pinnedSessionHasLoadedJob(pinnedSession)) return { prompt: false };

  if (await isDismissedNewJob(job.sourceUrl)) return { prompt: false };

  return { prompt: true, pinned, pinnedSession };
}

async function notifyPendingNewJob(
  job: ExtractedJob,
  pinned: string,
  pinnedSession: ExtensionJobSession,
): Promise<void> {
  focusedSidebarUrl = pinned;
  await chrome.storage.session.set({
    [PENDING_NEW_JOB_OFFER_KEY]: dismissKeyForJobUrl(job.sourceUrl),
  });
  void chrome.runtime
    .sendMessage({
      action: 'pendingNewJob',
      job,
      previousUrl: pinned,
      previousJob: pinnedSession.extractedJob ?? null,
    })
    .catch(() => {
      /* sidebar may be closed */
    });
}

function withCanonicalJobUrl(job: ExtractedJob): ExtractedJob {
  const canonical = canonicalJobViewUrl(job.sourceUrl);
  if (!canonical || canonical === job.sourceUrl) return job;
  return { ...job, sourceUrl: canonical };
}

async function forwardJobExtracted(job: ExtractedJob): Promise<void> {
  if (isApplyMateAppUrl(job.sourceUrl)) return;

  const enriched = withCanonicalJobUrl(enrichWithLogo(job));

  const replaceGate = await shouldPromptBeforeReplacingJob(enriched);
  if (replaceGate.prompt) {
    await notifyPendingNewJob(enriched, replaceGate.pinned, replaceGate.pinnedSession);
    return;
  }

  const priorSession =
    (await readJobSession(enriched.sourceUrl)) ?? emptyJobSession(enriched.sourceUrl);
  const hadPriorExtract =
    Boolean(priorSession.extractedJob?.title?.trim()) ||
    Boolean(priorSession.extractedJob?.description?.trim());
  const contentChanged =
    hadPriorExtract &&
    jobContentFingerprint(priorSession.extractedJob) !== jobContentFingerprint(enriched);

  const mergePayload: Partial<ExtensionJobSession> = { extractedJob: enriched };
  if (contentChanged) {
    Object.assign(mergePayload, {
      score: null,
      check: null,
      jobAnalysisId: null,
      coverLetter: null,
    });
    lastCheckAtByUrl.delete(enriched.sourceUrl);
  }

  await mergeJobSession(enriched.sourceUrl, mergePayload);

  const onActiveTab = await isJobOnActiveTab(enriched);
  if (!onActiveTab) return;

  if (contentChanged) {
    const cleared = await readJobSession(enriched.sourceUrl);
    if (cleared) notifyJobSessionUpdated(cleared);
  }

  await chrome.storage.session.remove(PENDING_NEW_JOB_OFFER_KEY);
  await pinJobUrl(enriched.sourceUrl);
  await storeCurrentJob(enriched);
  focusedSidebarUrl = enriched.sourceUrl;
  await refreshCheckForUrl(enriched.sourceUrl, enriched, {
    skipCoverLetterRehydrate: contentChanged,
  });
  void chrome.runtime.sendMessage({ action: 'jobExtracted', job: enriched }).catch(() => {
    /* sidebar may be closed */
  });
}

function notifyJobSessionUpdated(session: ExtensionJobSession): void {
  if (focusedSidebarUrl && session.pageUrl !== focusedSidebarUrl) return;
  void chrome.runtime
    .sendMessage({ action: 'jobSessionUpdated', session })
    .catch(() => {
      /* sidebar may be closed */
    });
}

function notifyAiUsage(aiUsage: AiUsageSnapshot): void {
  void chrome.runtime.sendMessage({ action: 'aiUsageUpdated', aiUsage }).catch(() => {
    /* sidebar may be closed */
  });
}

async function runAiExtractIfNeeded(
  payload: { rawText: string; pageTitle: string; pageUrl: string },
): Promise<ExtractedJob | null> {
  const url = payload.pageUrl;
  const existingSession = await readJobSession(url);
  if (existingSession?.extractedJob?.title?.trim()) {
    return existingSession.extractedJob;
  }

  const lockKey = extractLockKey(url);
  const lock = await chrome.storage.session.get(lockKey);
  if (lock[lockKey] === 'pending') {
    return existingSession?.extractedJob ?? null;
  }

  await chrome.storage.session.set({ [lockKey]: 'pending' });
  try {
    const { job, aiUsage } = await extractionApi.extractJob(payload);
    await chrome.storage.session.set({ [lockKey]: 'done' });
    if (aiUsage) notifyAiUsage(aiUsage);
    await forwardJobExtracted(job);
    return job;
  } catch (error) {
    await chrome.storage.session.remove(lockKey);
    throw error;
  }
}

async function rehydrateCoverLetterFromCheck(
  url: string,
  session: ExtensionJobSession,
  check: CheckResponse,
): Promise<ExtensionJobSession> {
  if (session.coverLetter?.coverLetter?.trim()) return session;
  if (!check.hasCoverLetter) return session;
  const jobAnalysisId = check.jobId ?? session.jobAnalysisId;
  if (!jobAnalysisId?.trim()) return session;
  if (
    session.jobAnalysisId?.trim() &&
    check.jobId?.trim() &&
    session.jobAnalysisId.trim() !== check.jobId.trim()
  ) {
    return session;
  }

  try {
    const generated = await jobsApi.getGeneratedCoverLetter(jobAnalysisId);
    const text = generated.coverLetter?.trim();
    if (!text) return session;

    const result: CoverLetterResult = {
      coverLetter: text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      generatedAt: new Date().toISOString(),
      jobAnalysisId,
      dashboardUrl: check.dashboardUrl ?? null,
      persisted: true,
    };
    return mergeJobSession(url, {
      coverLetter: result,
      jobAnalysisId,
    });
  } catch {
    return session;
  }
}


async function refreshJobStateForUrl(
  url: string,
  job?: ExtractedJob | null,
  options?: { force?: boolean },
): Promise<ExtensionJobSession | null> {
  const existing = (await readJobSession(url)) ?? emptyJobSession(url);
  const lastCheck = lastCheckAtByUrl.get(url) ?? 0;
  if (!options?.force && existing.check && Date.now() - lastCheck < JOB_CHECK_COOLDOWN_MS) {
    return existing;
  }

  const apiUrl = canonicalJobViewUrl(url) ?? url;
  try {
    const state = await jobsApi.getState(apiUrl);
    lastCheckAtByUrl.set(url, Date.now());
    if (state.aiUsage) notifyAiUsage(state.aiUsage);
    let session = applyServerStateToSession(url, existing, state, job ?? existing.extractedJob);
    if (job) session.extractedJob = job;
    if (
      state.hasCoverLetter &&
      !session.coverLetter?.coverLetter?.trim() &&
      !state.coverLetterPreview?.trim()
    ) {
      session = await rehydrateCoverLetterFromCheck(url, session, session.check ?? {
        saved: state.saved,
        jobId: state.jobId ?? null,
        status: state.status ?? null,
        hasCoverLetter: true,
      });
    }
    await writeJobSession(session);
    notifyJobSessionUpdated(session);
    if (!focusedSidebarUrl || focusedSidebarUrl === url) {
      void chrome.runtime
        .sendMessage({
          action: 'jobCheckResult',
          result: session.check ?? { saved: state.saved, jobId: state.jobId ?? null, status: state.status ?? null },
          url,
        })
        .catch(() => {
          /* sidebar may be closed */
        });
    }
    if (state.saved && state.jobId && state.status) {
      await writeSavedJobToSession(url, state.jobId, state.status);
    }
    return session;
  } catch {
    await refreshCheckForUrl(url, job, options);
    return readJobSession(url);
  }
}

async function syncAnalysisForJob(
  url: string,
  jobId: string,
  cvId?: string | null,
): Promise<ExtensionJobSession | null> {
  const trimmedJobId = jobId.trim();
  if (!trimmedJobId) return null;
  try {
    const result = await jobsApi.getJobAnalysis(trimmedJobId, cvId);
    const existing = (await readJobSession(url)) ?? emptyJobSession(url);
    const check: CheckResponse = {
      ...(existing.check ?? {
        saved: true,
        jobId: trimmedJobId,
        status: null,
      }),
      saved: existing.check?.saved ?? true,
      jobId: trimmedJobId,
      status: existing.check?.status ?? null,
      hasAnalysis: true,
      matchScore: result.matchScore,
      scoreLabel: result.scoreLabel,
      topStrengths: result.topStrengths,
      topGaps: result.topGaps,
      missingSkills: result.missingSkills,
      recommendation: result.recommendation,
      factors: result.factors,
      isTailored: result.isTailored,
      selectedCvProfileId: result.selectedCvProfileId ?? result.matchCvProfileId ?? null,
      dashboardUrl: result.dashboardUrl ?? existing.check?.dashboardUrl ?? null,
    };
    const session = await mergeJobSession(url, {
      jobAnalysisId: result.jobAnalysisId ?? trimmedJobId,
      check,
      score: result,
      selectedCvId: cvId?.trim() || existing.selectedCvId,
    });
    await writeJobSession(session);
    notifyJobSessionUpdated(session);
    return session;
  } catch {
    return null;
  }
}

async function refreshCheckForUrl(
  url: string,
  job?: ExtractedJob | null,
  options?: { force?: boolean; skipCoverLetterRehydrate?: boolean; cvId?: string | null },
): Promise<CheckResponse | null> {
  const existing = (await readJobSession(url)) ?? emptyJobSession(url);
  const lastCheck = lastCheckAtByUrl.get(url) ?? 0;
  if (
    !options?.force &&
    existing.check &&
    Date.now() - lastCheck < JOB_CHECK_COOLDOWN_MS
  ) {
    return existing.check;
  }

  try {
    const apiUrl = canonicalJobViewUrl(url) ?? url;
    const cvId = options?.cvId ?? existing.selectedCvId ?? null;
    let check = await jobsApi.check(apiUrl, cvId);
    lastCheckAtByUrl.set(url, Date.now());
    if (check.aiUsage) notifyAiUsage(check.aiUsage);
    let session = applyCheckToSession(url, existing, check);
    if (job) session.extractedJob = job;
    if (
      check.hasAnalysis &&
      check.jobId &&
      (!existing.score || check.isTailored || options?.force)
    ) {
      const synced = await syncAnalysisForJob(url, check.jobId, cvId);
      if (synced?.score) {
        session = synced;
        check = synced.check ?? check;
      }
    }
    if (!options?.skipCoverLetterRehydrate) {
      session = await rehydrateCoverLetterFromCheck(url, session, check);
    }
    await writeJobSession(session);
    notifyJobSessionUpdated(session);
    if (!focusedSidebarUrl || focusedSidebarUrl === url) {
      void chrome.runtime
        .sendMessage({ action: 'jobCheckResult', result: check, url })
        .catch(() => {
          /* sidebar may be closed */
        });
    }
    if (check.saved && check.jobId && check.status) {
      await writeSavedJobToSession(url, check.jobId, check.status);
    }
    return check;
  } catch {
    return null;
  }
}

async function resolveSessionUrl(explicit?: string): Promise<string | null> {
  if (explicit?.trim()) return explicit.trim();

  const pinned = await readPinnedJobUrl();
  const pinnedSession = pinned ? await readJobSession(pinned) : null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url?.trim() ?? '';

  if (isApplyMateAppUrl(tabUrl)) {
    return pinned ?? (await resolvePinnedOrCachedJobUrl());
  }

  const pendingOffer = await chrome.storage.session.get(PENDING_NEW_JOB_OFFER_KEY);
  const pendingOfferUrl =
    typeof pendingOffer[PENDING_NEW_JOB_OFFER_KEY] === 'string'
      ? pendingOffer[PENDING_NEW_JOB_OFFER_KEY]
      : '';

  if (pinned && pinnedSessionHasLoadedJob(pinnedSession)) {
    if (!tabUrl || !urlsMatch(tabUrl, pinned)) {
      return pinned;
    }
    if (pendingOfferUrl && dismissKeyForJobUrl(tabUrl) === pendingOfferUrl) {
      return pinned;
    }
  }

  if (!tabUrl) return pinned ?? (await resolvePinnedOrCachedJobUrl());

  if (pinned && !urlsMatch(tabUrl, pinned)) {
    if (pinnedSessionHasLoadedJob(pinnedSession)) {
      return pinned;
    }
    if (await isDismissedNewJob(tabUrl)) {
      return pinned;
    }
    if (urlLooksLikeJobListing(tabUrl)) {
      return tabUrl;
    }
    return pinned;
  }

  return tabUrl || pinned;
}

type ProbeJobPageResponse = {
  job: ExtractedJob | null;
  needsAi?: boolean;
  aiPayload?: { rawText: string; pageTitle: string; pageUrl: string };
};

async function requestProbeFromTab(tabId: number): Promise<ProbeJobPageResponse | undefined> {
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      action: 'probeJobPage',
    })) as ProbeJobPageResponse;
  } catch {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'runProbe' });
      await sleep(250);
      return (await chrome.tabs.sendMessage(tabId, {
        action: 'probeJobPage',
      })) as ProbeJobPageResponse;
    } catch {
      return undefined;
    }
  }
}

async function probeTabForJob(tabId: number): Promise<ExtractedJob | null> {
  const response = await requestProbeFromTab(tabId);
  if (!response) return null;

  if (response.job) {
    await forwardJobExtracted(response.job);
    return response.job;
  }

  if (response.needsAi && response.aiPayload) {
    try {
      const job = await runAiExtractIfNeeded(response.aiPayload);
      return job;
    } catch (error) {
      const is429 = error instanceof ApiRequestError && error.statusCode === 429;
      void chrome.runtime
        .sendMessage({
          action: 'extractionError',
          message: is429
            ? 'Daily AI limit reached. Upgrade to Pro.'
            : 'Could not extract job details. Try pasting manually.',
        })
        .catch(() => {
          /* sidebar may be closed */
        });
    }
  }

  return null;
}

async function probeActiveTabForJob(): Promise<ExtractedJob | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isProbeableWebUrl(tab.url ?? '') || isApplyMateAppUrl(tab.url ?? '')) {
    return null;
  }

  for (let attempt = 0; attempt < JOB_PROBE_ATTEMPTS; attempt += 1) {
    const job = await probeTabForJob(tab.id);
    if (job) return job;
    if (attempt < JOB_PROBE_ATTEMPTS - 1) {
      await sleep(JOB_PROBE_RETRY_MS);
    }
  }
  return null;
}

async function resolveCurrentJob(): Promise<ExtractedJob | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && isProbeableWebUrl(tab.url ?? '')) {
    const probed = await probeActiveTabForJob();
    if (probed) return probed;
  }
  return readCurrentJob();
}

type RuntimeMessage =
  | MessageAction
  | { action: string; payload?: unknown; job?: ExtractedJob; message?: string; url?: string };

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
});

configureSidePanel();

async function maybeProbeLinkedInOnSidebarOpen(tab: chrome.tabs.Tab): Promise<boolean> {
  const url = tab.url?.trim() ?? '';
  if (!url.includes('linkedin.com') || !url.includes('/jobs')) return false;

  const cached = await readCurrentJob();
  if (cached?.sourceUrl) {
    const tabKey = linkedInJobKeyFromUrl(url);
    const cachedKey = linkedInJobKeyFromUrl(cached.sourceUrl);
    if (tabKey && cachedKey && tabKey === cachedKey) return true;
    if (!tabKey && urlsMatch(url, cached.sourceUrl)) return true;
  }

  if (tab.id != null) {
    await probeTabForJob(tab.id);
  }
  return true;
}

async function probeSidebarTabIfNeeded(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !isProbeableWebUrl(tab.url ?? '')) return;
  const linkedInHandled = await maybeProbeLinkedInOnSidebarOpen(tab);
  if (!linkedInHandled) {
    await probeActiveTabForJob();
  }
}

chrome.action.onClicked.addListener((tab) => {
  openSidebarForTab(tab);
  void chrome.runtime.sendMessage({ action: 'sidebarOpened' }).catch(() => {
    /* sidebar may be closed */
  });
  void probeSidebarTabIfNeeded(tab);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message?.action === 'ping') {
    sendResponse({ ok: true });
    return true;
  }

  if (message?.action === 'openSidebar') {
    openSidebarFromSender(sender);
    sendResponse({ success: true });
    void chrome.runtime.sendMessage({ action: 'sidebarOpened' }).catch(() => {
      /* sidebar may be closed */
    });
    const tabId = sender.tab?.id;
    if (tabId != null) {
      void chrome.tabs.get(tabId).then((tab) => {
        void probeSidebarTabIfNeeded(tab);
      }).catch(() => {
        /* ignore */
      });
    }
    return true;
  }

  void (async () => {
    try {
      switch (message.action) {
        case 'setToken': {
          sendResponse(await handleSetToken(message as Extract<MessageAction, { action: 'setToken' }>));
          break;
        }
        case 'getAuthState': {
          sendResponse(await handleGetAuthState());
          break;
        }
        case 'syncAuth': {
          sendResponse(await handleSyncAuth());
          break;
        }
        case 'unauthorized': {
          await clearToken();
          notifySidebarAuthUpdated();
          sendResponse({ success: true });
          break;
        }
        case 'clearToken': {
          markWebLogout();
          await clearToken();
          await wipeExtensionJobCache();
          notifySidebarAuthUpdated();
          sendResponse({ success: true });
          break;
        }
        case 'jobExtracted': {
          const job = (message as { action: 'jobExtracted'; job: ExtractedJob }).job;
          await forwardJobExtracted(job);
          sendResponse({ success: true });
          break;
        }
        case 'extractJobAI': {
          const payload = (
            message as {
              action: 'extractJobAI';
              payload: { rawText: string; pageTitle: string; pageUrl: string };
            }
          ).payload;
          sendResponse({ success: true });
          try {
            await runAiExtractIfNeeded(payload);
          } catch (error) {
            const is429 =
              error instanceof ApiRequestError && error.statusCode === 429;
            void chrome.runtime
              .sendMessage({
                action: 'extractionError',
                message: is429
                  ? 'Daily AI limit reached. Upgrade to Pro.'
                  : 'Could not extract job details. Try pasting manually.',
              })
              .catch(() => {
                /* ignore */
              });
          }
          break;
        }
        case 'requestExtraction': {
          const job = await resolveCurrentJob();
          sendResponse({ job } satisfies RequestExtractionResponse);
          break;
        }
        case 'clearJob': {
          const cached = await readCurrentJob();
          const pinned = await readPinnedJobUrl();
          const url = cached?.sourceUrl ?? pinned ?? focusedSidebarUrl;
          await wipeExtensionJobCache(url);
          void chrome.runtime.sendMessage({ action: 'jobCleared' }).catch(() => {
            /* sidebar may be closed */
          });
          sendResponse({ success: true });
          break;
        }
        case 'switchToNewJob': {
          const job = (message as { action: 'switchToNewJob'; job: ExtractedJob }).job;
          if (!job?.sourceUrl) {
            sendResponse({ success: false });
            break;
          }
          await clearDismissedNewJob(job.sourceUrl);
          await chrome.storage.session.remove(PENDING_NEW_JOB_OFFER_KEY);
          await mergeJobSession(job.sourceUrl, {
            extractedJob: job,
            score: null,
            check: null,
            jobAnalysisId: null,
            coverLetter: null,
            selectedCvId: null,
          });
          await pinJobUrl(job.sourceUrl);
          await storeCurrentJob(job);
          focusedSidebarUrl = job.sourceUrl;
          await refreshJobStateForUrl(job.sourceUrl, job, { force: true });
          const session = await readJobSession(job.sourceUrl);
          if (session) notifyJobSessionUpdated(session);
          sendResponse({ success: true });
          break;
        }
        case 'dismissPendingNewJob': {
          const url = (message as { action: 'dismissPendingNewJob'; url?: string }).url;
          if (typeof url === 'string' && url.trim()) {
            await dismissNewJobUrl(url);
          }
          await chrome.storage.session.remove(PENDING_NEW_JOB_OFFER_KEY);
          const pinned = await readPinnedJobUrl();
          if (pinned) {
            focusedSidebarUrl = pinned;
            const session = await readJobSession(pinned);
            if (session) notifyJobSessionUpdated(session);
          }
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          void chrome.runtime
            .sendMessage({
              action: 'activeTabChanged',
              url: activeTab?.url ?? '',
              sessionUrl: pinned ?? undefined,
            })
            .catch(() => {
              /* sidebar may be closed */
            });
          sendResponse({ success: true });
          break;
        }
        case 'getJobSession': {
          let url = await resolveSessionUrl(
            (message as { action: 'getJobSession'; url?: string }).url,
          );
          if (!url) {
            const pinned = await readPinnedJobUrl();
            const cached = await readCurrentJob();
            url = pinned ?? (cached?.sourceUrl && !isApplyMateAppUrl(cached.sourceUrl) ? cached.sourceUrl : null);
          }
          if (!url) {
            focusedSidebarUrl = null;
            const inFlight = await readInFlight();
            sendResponse({
              session: null,
              inFlight: inFlight?.operation ?? null,
            } satisfies GetJobSessionResponse);
            break;
          }
          focusedSidebarUrl = url;
          let session = await readJobSession(url);
          const inFlight = await readInFlight();
          const inFlightForSession =
            inFlight && urlsMatch(inFlight.sourceUrl, url) ? inFlight.operation : null;
          let cachedJob = await readCurrentJob();
          if (!session?.extractedJob && cachedJob) {
            session = await mergeJobSession(url, { extractedJob: cachedJob });
          }
          const job = session?.extractedJob ?? cachedJob;
          if (
            session?.check?.hasCoverLetter &&
            !session.coverLetter?.coverLetter?.trim() &&
            (session.check.jobId ?? session.jobAnalysisId)?.trim()
          ) {
            session = await rehydrateCoverLetterFromCheck(url, session, session.check);
            if (session.coverLetter?.coverLetter?.trim()) {
              await writeJobSession(session);
            }
          }
          sendResponse({
            session: session ?? null,
            inFlight: inFlightForSession,
          } satisfies GetJobSessionResponse);

          void (async () => {
            if (isApplyMateAppUrl(url)) return;
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            const activeUrl = activeTab?.url ?? '';
            const activeMatchesSession =
              activeUrl === url ||
              (isApplyMateAppUrl(activeUrl) && (await readPinnedJobUrl()) === url);
            if (!activeMatchesSession) return;

            if (isProbeableWebUrl(url) && !session?.extractedJob && !cachedJob) {
              await probeActiveTabForJob();
              const refreshed = await readJobSession(url);
              if (refreshed) notifyJobSessionUpdated(refreshed);
              return;
            }
            if (isProbeableWebUrl(url) && job && !session?.check) {
              await refreshJobStateForUrl(url, job, { force: true });
              const refreshed = await readJobSession(url);
              if (refreshed) notifyJobSessionUpdated(refreshed);
              return;
            }
            if (isProbeableWebUrl(url) && job && session?.check) {
              await refreshCheckForUrl(url, job, {
                force: true,
                cvId: session.selectedCvId,
              });
              const refreshed = await readJobSession(url);
              if (refreshed) notifyJobSessionUpdated(refreshed);
              if (refreshed?.check?.hasAnalysis && refreshed.check.jobId) {
                await syncAnalysisForJob(
                  url,
                  refreshed.check.jobId,
                  refreshed.selectedCvId,
                );
                const synced = await readJobSession(url);
                if (synced) notifyJobSessionUpdated(synced);
              }
              return;
            }
            if (
              session?.check?.hasCoverLetter &&
              !session.coverLetter?.coverLetter?.trim() &&
              session.check.jobId
            ) {
              const rehydrated = await rehydrateCoverLetterFromCheck(url, session, session.check);
              if (rehydrated.coverLetter?.coverLetter?.trim()) {
                await writeJobSession(rehydrated);
                notifyJobSessionUpdated(rehydrated);
              }
            }
          })();
          break;
        }
        case 'probeActiveJob': {
          const job = await probeActiveTabForJob();
          sendResponse({ job } satisfies RequestExtractionResponse);
          break;
        }
        case 'reloadActiveTabForJob': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id && isProbeableWebUrl(tab.url)) {
            await chrome.tabs.reload(tab.id);
          }
          sendResponse({ success: true });
          break;
        }
        case 'importJobFromUrl': {
          const rawUrl = (message as { action: 'importJobFromUrl'; url: string }).url;
          const normalized = normalizeJobPageUrl(rawUrl);
          if (!normalized) {
            sendResponse({ success: false, error: 'Enter a valid job page URL.' });
            break;
          }
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            await chrome.tabs.update(tab.id, { url: normalized });
          } else {
            await chrome.tabs.create({ url: normalized, active: true });
          }
          sendResponse({ success: true, url: normalized });
          break;
        }
        case 'setSelectedCvId': {
          const cvId = (message as { action: 'setSelectedCvId'; cvId: string }).cvId;
          const url = await resolveSessionUrl();
          if (url) {
            let session = await mergeJobSession(url, { selectedCvId: cvId });
            if (session.check?.hasAnalysis && session.check.jobId) {
              const synced = await syncAnalysisForJob(url, session.check.jobId, cvId);
              if (synced) session = synced;
            }
            notifyJobSessionUpdated(session);
          }
          sendResponse({ success: true });
          break;
        }
        case 'saveJob': {
          const payload = (message as { action: 'saveJob'; payload: SaveJobPayload }).payload;
          const canonicalUrl = canonicalJobViewUrl(payload.sourceUrl) ?? payload.sourceUrl;
          const savePayload = { ...payload, sourceUrl: canonicalUrl };
          sendResponse({ success: true });
          try {
            const result = await jobsApi.save(savePayload);
            await writeSavedJobToSession(savePayload.sourceUrl, result.id, result.status);
            const savedCheck: CheckResponse = {
              saved: true,
              jobId: result.id,
              status: result.status,
              companyLogoUrl: result.companyLogoUrl ?? null,
            };
            const existing = await readJobSession(savePayload.sourceUrl);
            const session = await mergeJobSession(savePayload.sourceUrl, {
              jobAnalysisId: result.id,
              extractedJob: existing?.extractedJob ?? null,
              check: savedCheck,
            });
            notifyJobSessionUpdated(session);
            void chrome.runtime
              .sendMessage({
                action: 'jobSaved',
                jobId: result.id,
                jobStatus: result.status,
                companyLogoUrl: result.companyLogoUrl ?? null,
              })
              .catch(() => {
                /* ignore */
              });
          } catch (error) {
            const messageText =
              error instanceof ApiRequestError && error.statusCode === 429
                ? 'Daily limit reached.'
                : 'Failed to save. Try again.';
            void chrome.runtime
              .sendMessage({ action: 'saveError', message: messageText })
              .catch(() => {
                /* ignore */
              });
          }
          break;
        }
        case 'checkJobSaved': {
          const url = (message as { action: 'checkJobSaved'; url: string }).url;
          try {
            const result = await refreshCheckForUrl(url);
            sendResponse({
              result:
                result ??
                ({
                  saved: false,
                  jobId: null,
                  status: null,
                } satisfies CheckResponse),
            });
          } catch {
            sendResponse({
              result: { saved: false, jobId: null, status: null },
            } satisfies { result: CheckResponse });
          }
          break;
        }
        case 'requestRecentJobs': {
          try {
            const jobs = await jobsApi.recent(10);
            sendResponse({ jobs } satisfies RequestRecentJobsResponse);
          } catch {
            sendResponse({ jobs: [] } satisfies RequestRecentJobsResponse);
          }
          break;
        }
        case 'openRecentJob': {
          const payload = message as {
            action: 'openRecentJob';
            jobId: string;
            cvId?: string | null;
          };
          const jobId = payload.jobId?.trim();
          if (!jobId) {
            sendResponse({ success: false, error: 'Missing job id' } satisfies OpenRecentJobResponse);
            break;
          }
          try {
            const jobs = await jobsApi.recent(20);
            const row = jobs.find((j) => j.id === jobId);
            const cvId = payload.cvId?.trim() || null;
            const hubUrl =
              row?.sourceUrl?.trim() ||
              `${import.meta.env.VITE_WEB_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3001'}/dashboard/jobs?jobId=${encodeURIComponent(jobId)}`;

            if (row?.sourceUrl?.trim() && !isApplyMateAppUrl(row.sourceUrl)) {
              const sourceUrl = canonicalJobViewUrl(row.sourceUrl) ?? row.sourceUrl;
              await pinJobUrl(sourceUrl);
              focusedSidebarUrl = sourceUrl;
              const stubJob: ExtractedJob = {
                title: row.title,
                company: row.company,
                location: row.location ?? '',
                description: '',
                salary: null,
                jobType: null,
                experienceLevel: null,
                postedDate: null,
                sourceUrl,
                sourceSite: row.sourceSite ?? '',
                confidence: 'low',
                extractedBy: 'ai-fallback',
              };
              await mergeJobSession(sourceUrl, {
                extractedJob: stubJob,
                jobAnalysisId: jobId,
              });
              if (row.hasAnalysis) {
                await syncAnalysisForJob(sourceUrl, jobId, cvId);
              }
              const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (active?.id) {
                await chrome.tabs.update(active.id, { url: sourceUrl });
              } else {
                await chrome.tabs.create({ url: sourceUrl, active: true });
              }
            } else {
              await chrome.tabs.create({ url: hubUrl, active: true });
              if (row?.hasAnalysis) {
                const pinned = await readPinnedJobUrl();
                if (pinned) {
                  await syncAnalysisForJob(pinned, jobId, cvId);
                }
              }
            }
            sendResponse({ success: true } satisfies OpenRecentJobResponse);
          } catch {
            sendResponse({ success: false, error: 'Could not open job' } satisfies OpenRecentJobResponse);
          }
          break;
        }
        case 'getAiUsage': {
          sendResponse({ success: true });
          try {
            const aiUsage = await cvApi.getAiUsage();
            notifyAiUsage(aiUsage);
          } catch {
            /* usage badge stays empty until an AI action returns aiUsage */
          }
          break;
        }
        case 'getCvProfiles': {
          sendResponse({ success: true });
          try {
            const profiles = await cvApi.getProfiles();
            void chrome.runtime
              .sendMessage({ action: 'cvProfilesResult', profiles })
              .catch(() => {
                /* sidebar may be closed */
              });
          } catch {
            void chrome.runtime
              .sendMessage({ action: 'cvProfilesResult', profiles: [] })
              .catch(() => {
                /* sidebar may be closed */
              });
          }
          break;
        }
        case 'getCvScore': {
          const scoreMsg = message as Extract<MessageAction, { action: 'getCvScore' }>;
          sendResponse({ success: true });
          const url = scoreMsg.sourceUrl ?? (await resolveSessionUrl()) ?? '';
          const session = url ? await readJobSession(url) : null;
          const job = session?.extractedJob ?? (await readCurrentJob());
          const jobAnalysisId =
            scoreMsg.jobAnalysisId ?? session?.jobAnalysisId ?? session?.check?.jobId ?? null;

          const sameCv = session?.selectedCvId === scoreMsg.cvId;
          const check = session?.check;
          if (sameCv && canReuseCachedScore(session?.score, check)) {
            void chrome.runtime
              .sendMessage({ action: 'cvScoreResult', result: session!.score! })
              .catch(() => {
                /* sidebar may be closed */
              });
            break;
          }

          const scorePayload = buildCvScorePayload({
            cvId: scoreMsg.cvId,
            jobTitle: scoreMsg.jobTitle,
            jobDescription: scoreMsg.jobDescription,
            company: scoreMsg.company ?? job?.company,
            jobAnalysisId,
            sourceUrl: scoreMsg.sourceUrl ?? job?.sourceUrl ?? url,
            sourceSite: scoreMsg.sourceSite ?? job?.sourceSite,
            logoCandidateUrl: job?.logoCandidateUrl,
          });
          const sessionUrl = scorePayload.sourceUrl ?? url;
          if (sessionUrl) {
            await pinJobUrl(sessionUrl);
          }

          void (async () => {
            await setInFlight({
              operation: 'scoring',
              sourceUrl: sessionUrl,
              startedAt: Date.now(),
            });
            void chrome.runtime
              .sendMessage({ action: 'cvScoreStarted', sourceUrl: sessionUrl })
              .catch(() => {
                /* sidebar may be closed */
              });

            try {
              if (import.meta.env.DEV) {
                console.info('[getCvScore] POST /extension/cv/score', {
                  cvId: scorePayload.cvId,
                  sourceUrl: scorePayload.sourceUrl ?? null,
                  jobDescriptionLength: scorePayload.jobDescription.length,
                });
              }

              const result = await cvApi.getScore(scorePayload);
              if (result.aiUsage) notifyAiUsage(result.aiUsage);
              if (sessionUrl) {
                const updated = await mergeJobSession(sessionUrl, {
                  score: result,
                  jobAnalysisId: result.jobAnalysisId ?? jobAnalysisId,
                  selectedCvId: scoreMsg.cvId,
                  extractedJob: job ?? session?.extractedJob ?? undefined,
                });
                notifyJobSessionUpdated(updated);
              }
              void chrome.runtime
                .sendMessage({ action: 'cvScoreResult', result })
                .catch(() => {
                  /* sidebar may be closed */
                });
            } catch (error) {
              const is429 =
                error instanceof ApiRequestError && error.statusCode === 429;
              const validationMessage =
                error instanceof ApiRequestError && error.statusCode === 400
                  ? formatCvScoreValidationError(error.message)
                  : null;
              void chrome.runtime
                .sendMessage({
                  action: 'cvScoreError',
                  message:
                    validationMessage ??
                    (is429
                      ? 'Daily AI limit reached. Upgrade to Pro for unlimited scoring.'
                      : formatExtensionApiError(error, 'Could not score CV. Please try again.')),
                })
                .catch(() => {
                  /* sidebar may be closed */
                });
            } finally {
              await clearInFlight('scoring');
            }
          })();
          break;
        }
        case 'generateCoverLetter': {
          const msg = message as Extract<MessageAction, { action: 'generateCoverLetter' }>;
          sendResponse({ success: true });
          const url = msg.sourceUrl ?? (await resolveSessionUrl()) ?? '';
          const session = url ? await readJobSession(url) : null;
          const jobAnalysisId =
            msg.jobAnalysisId ?? session?.jobAnalysisId ?? session?.check?.jobId ?? null;

          const letterPayload = buildCoverLetterPayload({
            cvId: msg.cvId,
            jobTitle: msg.jobTitle,
            jobDescription: msg.jobDescription,
            company: msg.company ?? session?.extractedJob?.company ?? '',
            jobLocation: msg.jobLocation ?? session?.extractedJob?.location,
            jobType: msg.jobType ?? session?.extractedJob?.jobType,
            jobAnalysisId,
            sourceUrl: msg.sourceUrl ?? session?.extractedJob?.sourceUrl ?? url,
            sourceSite: session?.extractedJob?.sourceSite,
          });
          const sessionUrl = letterPayload.sourceUrl ?? url;
          if (sessionUrl) {
            await pinJobUrl(sessionUrl);
          }

          void (async () => {
            await setInFlight({
              operation: 'coverLetter',
              sourceUrl: sessionUrl,
              startedAt: Date.now(),
            });
            void chrome.runtime
              .sendMessage({ action: 'coverLetterStarted', sourceUrl: sessionUrl })
              .catch(() => {
                /* sidebar may be closed */
              });

            try {
              const result = await cvApi.generateCoverLetter(letterPayload);
              if (sessionUrl) {
                const updated = await mergeJobSession(sessionUrl, {
                  coverLetter: result,
                  jobAnalysisId: result.jobAnalysisId ?? jobAnalysisId,
                  selectedCvId: msg.cvId,
                });
                await persistCoverLetterLocal(sessionUrl, result);
                notifyJobSessionUpdated(updated);
              }
              void chrome.runtime
                .sendMessage({ action: 'coverLetterResult', result })
                .catch(() => {
                  /* sidebar may be closed */
                });
            } catch (error) {
              const validationMessage =
                error instanceof ApiRequestError && error.statusCode === 400
                  ? formatCoverLetterValidationError(error.message)
                  : null;
              void chrome.runtime
                .sendMessage({
                  action: 'coverLetterError',
                  message:
                    validationMessage ??
                    formatExtensionApiError(
                      error,
                      'Could not generate cover letter. Please try again.',
                    ),
                })
                .catch(() => {
                  /* sidebar may be closed */
                });
            } finally {
              await clearInFlight('coverLetter');
            }
          })();
          break;
        }
        case 'initiateTailor': {
          const payload = (message as Extract<MessageAction, { action: 'initiateTailor' }>)
            .payload;
          sendResponse({ success: true });
          try {
            const session = await tailorApi.initiate(payload);
            await chrome.storage.session.set({
              [ACTIVE_TAILOR_SESSION_KEY]: JSON.stringify(session),
            });
            void chrome.tabs.create({ url: session.dashboardUrl });
            void chrome.runtime
              .sendMessage({ action: 'tailorInitiated', session })
              .catch(() => {
                /* sidebar may be closed */
              });
          } catch {
            void chrome.runtime
              .sendMessage({
                action: 'tailorInitiateError',
                message: 'Could not start tailoring session. Try again.',
              })
              .catch(() => {
                /* sidebar may be closed */
              });
          }
          break;
        }
        case 'checkTailorStatus': {
          const sessionId = (message as { action: 'checkTailorStatus'; sessionId: string })
            .sessionId;
          const stored = await chrome.storage.session.get(ACTIVE_TAILOR_SESSION_KEY);
          const raw = stored[ACTIVE_TAILOR_SESSION_KEY];
          if (typeof raw !== 'string') {
            const result = { completed: false, tailoredCvId: null as string | null };
            sendResponse(result);
            void chrome.runtime
              .sendMessage({ action: 'tailorStatusResult', ...result })
              .catch(() => {
                /* sidebar may be closed */
              });
            break;
          }
          try {
            const status = await tailorApi.getStatus(sessionId);
            if (status.completed) {
              await chrome.storage.session.remove(ACTIVE_TAILOR_SESSION_KEY);
            }
            sendResponse(status);
            void chrome.runtime
              .sendMessage({
                action: 'tailorStatusResult',
                completed: status.completed,
                tailoredCvId: status.tailoredCvId,
              })
              .catch(() => {
                /* sidebar may be closed */
              });
          } catch {
            const result = { completed: false, tailoredCvId: null as string | null };
            sendResponse(result);
            void chrome.runtime
              .sendMessage({ action: 'tailorStatusResult', ...result })
              .catch(() => {
                /* sidebar may be closed */
              });
          }
          break;
        }
        default:
          sendResponse({ success: false });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // If scoring/cover-letter code throws before it reaches its own try/catch,
      // we still need to notify the sidebar so it can stop spinners.
      const action = message?.action;
      if (action === 'getCvScore') {
        const validationMessage =
          error instanceof ApiRequestError && error.statusCode === 400
            ? formatCvScoreValidationError(error.message)
            : null;
        void chrome.runtime
          .sendMessage({
            action: 'cvScoreError',
            message:
              validationMessage ??
              formatExtensionApiError(error, 'Could not score CV. Please try again.'),
          })
          .catch(() => {
            /* sidebar may be closed */
          });
      } else if (action === 'generateCoverLetter') {
        const validationMessage =
          error instanceof ApiRequestError && error.statusCode === 400
            ? formatCoverLetterValidationError(error.message)
            : null;
        void chrome.runtime
          .sendMessage({
            action: 'coverLetterError',
            message:
              validationMessage ??
              formatExtensionApiError(
                error,
                'Could not generate cover letter. Please try again.',
              ),
          })
          .catch(() => {
            /* sidebar may be closed */
          });
      }
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId != null && (changeInfo.status === 'complete' || changeInfo.url)) {
    ensureSidePanelForTab(tabId);
  }

  if (changeInfo.status !== 'complete' && !changeInfo.url) return;

  const url = changeInfo.url ?? tab.url;
  if (!url || tab.id == null) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (parsed.searchParams.get('tailorComplete') === 'true' && tab.windowId != null) {
    openSidebarForTab(tab);

    const tailoredCvId = parsed.searchParams.get('tailoredCvId');
    if (tailoredCvId) {
      void chrome.storage.session.set({
        tailorCompleted: JSON.stringify({
          tailoredCvId,
          completedAt: new Date().toISOString(),
        }),
      });
    }

    void (async () => {
      const sessionUrl = await resolveSessionUrl(url);
      if (!sessionUrl) return;
      const session = await readJobSession(sessionUrl);
      const jobId = session?.jobAnalysisId ?? session?.check?.jobId;
      if (jobId) {
        await syncAnalysisForJob(sessionUrl, jobId, session?.selectedCvId);
      }
    })();
  }

  if (!isProbeableWebUrl(url) || isApplyMateAppUrl(url)) return;

  void (async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id !== tabId) return;

    for (let attempt = 0; attempt < JOB_PROBE_ATTEMPTS; attempt += 1) {
      const job = await probeTabForJob(tabId);
      if (job) return;
      await sleep(attempt === 0 ? 150 : JOB_PROBE_RETRY_MS);
    }
  })();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void (async () => {
    let tab: chrome.tabs.Tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return;
    }
    const activeUrl = tab.url ?? '';
    const sessionUrl = await resolveSessionUrl();
    if (sessionUrl) {
      focusedSidebarUrl = sessionUrl;
    }

    void chrome.runtime
      .sendMessage({
        action: 'activeTabChanged',
        url: activeUrl,
        sessionUrl: sessionUrl ?? undefined,
      })
      .catch(() => {
        /* sidebar may be closed */
      });

    if (!isProbeableWebUrl(activeUrl) || isApplyMateAppUrl(activeUrl)) return;

    for (let attempt = 0; attempt < JOB_PROBE_ATTEMPTS; attempt += 1) {
      const job = await probeTabForJob(tabId);
      if (job) return;
      await sleep(attempt === 0 ? 100 : JOB_PROBE_RETRY_MS);
    }
  })();
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  void (async () => {
    const action = (message as { action?: string } | null)?.action;
    if (action === 'clearToken') {
      markWebLogout();
      await clearToken();
      await wipeExtensionJobCache();
      notifySidebarAuthUpdated();
      sendResponse({ success: true });
      return;
    }
    if (
      message &&
      typeof message === 'object' &&
      action === 'setToken' &&
      typeof (message as { token?: unknown }).token === 'string'
    ) {
      const payload = message as { token: string; expiresAt?: string };
      await setToken(payload.token, payload.expiresAt);
      notifySidebarAuthUpdated();
      sendResponse({ success: true });
      return;
    }
    sendResponse({ success: false });
  })();
  return true;
});

export {};
