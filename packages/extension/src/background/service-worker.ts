import { ApiRequestError, authApi, cvApi, extractionApi, jobsApi, tailorApi } from '@/shared/api';
import { markWebLogout, syncExtensionAuth } from '@/shared/auth-sync';
import {
  applyCheckToSession,
  emptyJobSession,
  canReuseCachedScore,
  mergeJobSession,
  readJobSession,
  sessionKeyForUrl,
  writeJobSession,
} from '@/shared/job-session';
import {
  isApplyMateAppUrl,
  isProbeableWebUrl,
  normalizeJobPageUrl,
} from '@/shared/job-page-url';
import {
  configureSidePanel,
  openSidebarForTab,
  openSidebarFromSender,
} from '@/shared/open-sidebar';
import {
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
  ExtractedJob,
  ExtensionJobSession,
  GetAuthStateResponse,
  GetJobSessionResponse,
  MessageAction,
  RequestExtractionResponse,
  RequestRecentJobsResponse,
  SaveJobPayload,
  SetTokenResponse,
  SyncAuthResponse,
} from '@/shared/types';

const CURRENT_JOB_KEY = 'currentJob';
const PINNED_JOB_URL_KEY = 'pinnedJobUrl';
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

function savedJobStorageKey(url: string): string {
  return `savedJob:${url}`;
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

  await clearToken();
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

async function isJobOnActiveTab(job: ExtractedJob): Promise<boolean> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeUrl = activeTab?.url?.trim() ?? '';
  if (!activeUrl) return false;
  if (activeUrl === job.sourceUrl) return true;
  try {
    return normalizeJobPageUrl(activeUrl) === normalizeJobPageUrl(job.sourceUrl);
  } catch {
    return false;
  }
}

async function forwardJobExtracted(job: ExtractedJob): Promise<void> {
  if (isApplyMateAppUrl(job.sourceUrl)) return;
  await mergeJobSession(job.sourceUrl, { extractedJob: job });

  const onActiveTab = await isJobOnActiveTab(job);
  if (!onActiveTab) return;

  await pinJobUrl(job.sourceUrl);
  await storeCurrentJob(job);
  await refreshCheckForUrl(job.sourceUrl, job);
  if (!focusedSidebarUrl || focusedSidebarUrl === job.sourceUrl) {
    void chrome.runtime.sendMessage({ action: 'jobExtracted', job }).catch(() => {
      /* sidebar may be closed */
    });
  }
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

function extractLockKey(url: string): string {
  return `extractLock:${sessionKeyForUrl(url)}`;
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

async function refreshCheckForUrl(
  url: string,
  job?: ExtractedJob | null,
  options?: { force?: boolean },
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
    const check = await jobsApi.check(url);
    lastCheckAtByUrl.set(url, Date.now());
    if (check.aiUsage) notifyAiUsage(check.aiUsage);
    const session = applyCheckToSession(url, existing, check);
    if (job) session.extractedJob = job;
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url?.trim() ?? '';
  if (isApplyMateAppUrl(tabUrl)) {
    const pinned = await readPinnedJobUrl();
    if (pinned) return pinned;
    const cached = await readCurrentJob();
    if (cached?.sourceUrl && !isApplyMateAppUrl(cached.sourceUrl)) {
      return cached.sourceUrl;
    }
    return null;
  }
  return tabUrl || null;
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

async function clearCurrentJob(): Promise<void> {
  await chrome.storage.session.remove(CURRENT_JOB_KEY);
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

chrome.action.onClicked.addListener((tab) => {
  openSidebarForTab(tab);
  if (tab.id && isProbeableWebUrl(tab.url ?? '')) {
    void probeActiveTabForJob();
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message?.action === 'openSidebar') {
    openSidebarFromSender(sender);
    sendResponse({ success: true });
    const tabId = sender.tab?.id;
    if (tabId != null) {
      void chrome.tabs.get(tabId).then((tab) => {
        if (isProbeableWebUrl(tab.url ?? '')) {
          void probeActiveTabForJob();
        }
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
          await clearCurrentJob();
          await chrome.storage.session.remove(PINNED_JOB_URL_KEY);
          if (cached?.sourceUrl) {
            await chrome.storage.session.remove(sessionKeyForUrl(cached.sourceUrl));
            await chrome.storage.session.remove(extractLockKey(cached.sourceUrl));
          }
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
            sendResponse({ session: null } satisfies GetJobSessionResponse);
            break;
          }
          focusedSidebarUrl = url;
          let session = await readJobSession(url);
          let cachedJob = await readCurrentJob();
          if (!session?.extractedJob && cachedJob) {
            session = await mergeJobSession(url, { extractedJob: cachedJob });
          }
          const job = session?.extractedJob ?? cachedJob;
          sendResponse({ session: session ?? null } satisfies GetJobSessionResponse);

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
              await refreshCheckForUrl(url, job);
              const refreshed = await readJobSession(url);
              if (refreshed) notifyJobSessionUpdated(refreshed);
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
            const session = await mergeJobSession(url, { selectedCvId: cvId });
            notifyJobSessionUpdated(session);
          }
          sendResponse({ success: true });
          break;
        }
        case 'saveJob': {
          const payload = (message as { action: 'saveJob'; payload: SaveJobPayload }).payload;
          sendResponse({ success: true });
          try {
            const result = await jobsApi.save(payload);
            await writeSavedJobToSession(payload.sourceUrl, result.id, result.status);
            const session = await mergeJobSession(payload.sourceUrl, {
              jobAnalysisId: result.id,
              extractedJob: (await readJobSession(payload.sourceUrl))?.extractedJob ?? null,
            });
            await refreshCheckForUrl(payload.sourceUrl);
            notifyJobSessionUpdated((await readJobSession(payload.sourceUrl)) ?? session);
            void chrome.runtime
              .sendMessage({
                action: 'jobSaved',
                jobId: result.id,
                jobStatus: result.status,
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
              .sendMessage({ action: 'cvScoreResult', result: session.score })
              .catch(() => {
                /* sidebar may be closed */
              });
            break;
          }

          try {
            const result = await cvApi.getScore({
              cvId: scoreMsg.cvId,
              jobDescription: scoreMsg.jobDescription,
              jobTitle: scoreMsg.jobTitle,
              company: scoreMsg.company ?? job?.company,
              jobAnalysisId,
              sourceUrl: scoreMsg.sourceUrl ?? job?.sourceUrl ?? url,
              sourceSite: scoreMsg.sourceSite ?? job?.sourceSite,
            });
            if (result.aiUsage) notifyAiUsage(result.aiUsage);
            if (url) {
              const updated = await mergeJobSession(url, {
                score: result,
                jobAnalysisId: result.jobAnalysisId ?? jobAnalysisId,
                selectedCvId: scoreMsg.cvId,
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
            void chrome.runtime
              .sendMessage({
                action: 'cvScoreError',
                message: is429
                  ? 'Daily AI limit reached. Upgrade to Pro for unlimited scoring.'
                  : 'Could not score CV. Please try again.',
              })
              .catch(() => {
                /* sidebar may be closed */
              });
          }
          break;
        }
        case 'generateCoverLetter': {
          const payload = message as Extract<MessageAction, { action: 'generateCoverLetter' }>;
          sendResponse({ success: true });
          const url = payload.sourceUrl ?? (await resolveSessionUrl()) ?? '';
          const session = url ? await readJobSession(url) : null;
          const jobAnalysisId =
            payload.jobAnalysisId ?? session?.jobAnalysisId ?? session?.check?.jobId ?? null;
          try {
            const result = await cvApi.generateCoverLetter({
              ...payload,
              jobAnalysisId,
              sourceUrl: payload.sourceUrl ?? session?.extractedJob?.sourceUrl ?? url,
            });
            if (url) {
              const updated = await mergeJobSession(url, {
                coverLetter: result,
                jobAnalysisId: result.jobAnalysisId ?? jobAnalysisId,
                selectedCvId: payload.cvId,
              });
              notifyJobSessionUpdated(updated);
            }
            void chrome.runtime
              .sendMessage({ action: 'coverLetterResult', result })
              .catch(() => {
                /* sidebar may be closed */
              });
          } catch (error) {
            const is429 =
              error instanceof ApiRequestError && error.statusCode === 429;
            void chrome.runtime
              .sendMessage({
                action: 'coverLetterError',
                message: is429
                  ? 'Daily AI limit reached. Upgrade to Pro for unlimited cover letters.'
                  : 'Could not generate cover letter. Please try again.',
              })
              .catch(() => {
                /* sidebar may be closed */
              });
          }
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
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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
    const url = tab.url ?? '';
    if (!isProbeableWebUrl(url) || isApplyMateAppUrl(url)) return;

    focusedSidebarUrl = url;
    void chrome.runtime
      .sendMessage({ action: 'activeTabChanged', url })
      .catch(() => {
        /* sidebar may be closed */
      });

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
