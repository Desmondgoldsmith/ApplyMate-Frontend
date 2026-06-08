import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  AiUsageSnapshot,
  CheckResponse,
  CvProfile,
  CvTabState,
  ExtensionJobSession,
  ExtractedJob,
  GetJobSessionResponse,
  MessageAction,
  SaveState,
} from '@/shared/types';
import { isRichScore } from '@/shared/job-session';
import { cvApi } from '@/shared/api';

type ScoreUiState = CvTabState['scoreState'];
type CoverLetterUiState = CvTabState['coverLetterState'];

type JobSessionContextValue = {
  currentJob: ExtractedJob | null;
  jobAnalysisId: string | null;
  checkResult: CheckResponse | null;
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
  scoreState: ScoreUiState;
  setScoreState: (state: ScoreUiState) => void;
  coverLetterState: CoverLetterUiState;
  setCoverLetterState: (state: CoverLetterUiState) => void;
  selectedCvId: string | null;
  setSelectedCvId: (cvId: string) => void;
  profiles: CvProfile[];
  profilesLoading: boolean;
  dashboardUrl: string | null;
  aiUsage: AiUsageSnapshot | null;
  pinnedFromOtherTab: boolean;
  jobLoading: boolean;
  refreshJob: () => Promise<void>;
  reloadPageForJob: () => Promise<void>;
  importJobFromUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
  clearJob: () => Promise<void>;
};

const JobSessionContext = createContext<JobSessionContextValue | null>(null);

function sessionToUi(session: ExtensionJobSession | null): {
  job: ExtractedJob | null;
  scoreState: ScoreUiState;
  coverLetterState: CoverLetterUiState;
  saveState: SaveState;
} {
  if (!session) {
    return {
      job: null,
      scoreState: { status: 'idle' },
      coverLetterState: { status: 'idle' },
      saveState: { status: 'idle' },
    };
  }

  let saveState: SaveState = { status: 'idle' };
  if (session.check?.saved && session.check.jobId && session.check.status) {
    saveState = {
      status: 'saved',
      jobId: session.check.jobId,
      jobStatus: session.check.status,
    };
  }

  return {
    job: session.extractedJob,
    scoreState: session.score ? { status: 'done', result: session.score } : { status: 'idle' },
    coverLetterState: session.coverLetter
      ? { status: 'done', result: session.coverLetter }
      : { status: 'idle' },
    saveState,
  };
}

export function JobSessionProvider({ children }: { children: ReactNode }) {
  const [currentJob, setCurrentJob] = useState<ExtractedJob | null>(null);
  const [jobAnalysisId, setJobAnalysisId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResponse | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [scoreState, setScoreState] = useState<ScoreUiState>({ status: 'idle' });
  const [coverLetterState, setCoverLetterState] = useState<CoverLetterUiState>({
    status: 'idle',
  });
  const [selectedCvId, setSelectedCvIdState] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<CvProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [pinnedFromOtherTab, setPinnedFromOtherTab] = useState(false);
  const [jobLoading, setJobLoading] = useState(true);
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageSnapshot | null>(null);
  const focusedSessionUrlRef = useRef<string | null>(null);
  const silentHydrateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const applySession = useCallback((session: ExtensionJobSession | null) => {
    const ui = sessionToUi(session);
    setCurrentJob(ui.job);
    setJobAnalysisId(
      session?.jobAnalysisId ??
        session?.check?.jobId ??
        session?.score?.jobAnalysisId ??
        null,
    );
    setCheckResult(session?.check ?? null);
    setSaveState(ui.saveState);
    setScoreState((prev) => {
      if (
        prev.status === 'done' &&
        isRichScore(prev.result) &&
        ui.scoreState.status === 'done' &&
        ui.scoreState.result &&
        !isRichScore(ui.scoreState.result)
      ) {
        return prev;
      }
      return ui.scoreState;
    });
    setCoverLetterState(ui.coverLetterState);
    if (session?.selectedCvId) {
      setSelectedCvIdState(session.selectedCvId);
    }
    setDashboardUrl(
      session?.score?.dashboardUrl ??
        session?.check?.dashboardUrl ??
        session?.coverLetter?.dashboardUrl ??
        null,
    );
  }, []);

  const hydrateSessionCore = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setJobLoading(true);
      try {
        const response = (await chrome.runtime.sendMessage({
          action: 'getJobSession',
        } satisfies MessageAction)) as GetJobSessionResponse | undefined;

        focusedSessionUrlRef.current = response?.session?.pageUrl ?? null;
        applySession(response?.session ?? null);

        if (response?.session?.extractedJob) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeUrl = tab?.url ?? '';
          const jobUrl = response.session.extractedJob.sourceUrl;
          setPinnedFromOtherTab(
            Boolean(
              activeUrl &&
                jobUrl &&
                activeUrl !== jobUrl &&
                (activeUrl.includes('/dashboard') || activeUrl.includes('localhost')),
            ),
          );
        } else {
          setPinnedFromOtherTab(false);
        }
      } catch {
        applySession(null);
      } finally {
        if (showLoading) setJobLoading(false);
      }
    },
    [applySession],
  );

  const hydrateSession = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        clearTimeout(silentHydrateTimerRef.current);
        silentHydrateTimerRef.current = setTimeout(() => {
          void hydrateSessionCore(false);
        }, 250);
        return;
      }
      clearTimeout(silentHydrateTimerRef.current);
      await hydrateSessionCore(true);
    },
    [hydrateSessionCore],
  );

  const refreshJob = useCallback(async () => {
    await hydrateSession();
  }, [hydrateSession]);

  const reloadPageForJob = useCallback(async () => {
    setJobLoading(true);
    try {
      await chrome.runtime.sendMessage({
        action: 'reloadActiveTabForJob',
      } satisfies MessageAction);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await chrome.runtime.sendMessage({ action: 'probeActiveJob' } satisfies MessageAction);
      await hydrateSession();
    } catch {
      await hydrateSession();
    } finally {
      setJobLoading(false);
    }
  }, [hydrateSession]);

  const importJobFromUrl = useCallback(
    async (url: string): Promise<{ ok: boolean; error?: string }> => {
      setJobLoading(true);
      try {
        const response = (await chrome.runtime.sendMessage({
          action: 'importJobFromUrl',
          url,
        } satisfies MessageAction)) as { success?: boolean; error?: string } | undefined;
        if (!response?.success) {
          return { ok: false, error: response?.error ?? 'Enter a valid job page URL.' };
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await chrome.runtime.sendMessage({ action: 'probeActiveJob' } satisfies MessageAction);
        await hydrateSession();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not open job page.' };
      } finally {
        setJobLoading(false);
      }
    },
    [hydrateSession],
  );

  const clearJob = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'clearJob' } satisfies MessageAction);
    } catch {
      /* ignore */
    }
    applySession(null);
    setPinnedFromOtherTab(false);
  }, [applySession]);

  const setSelectedCvId = useCallback((cvId: string) => {
    setSelectedCvIdState(cvId);
    void chrome.runtime.sendMessage({
      action: 'setSelectedCvId',
      cvId,
    } satisfies MessageAction);
  }, []);

  useEffect(() => {
    void hydrateSession();
    void chrome.runtime.sendMessage({ action: 'getCvProfiles' } satisfies MessageAction);
    void cvApi
      .getAiUsage()
      .then(setAiUsage)
      .catch(() => {
        /* usage badge stays loading until an AI action returns aiUsage */
      });
  }, [hydrateSession]);

  useEffect(() => {
    const onMessage = (message: MessageAction) => {
      if (!message || typeof message !== 'object') return;

      if (message.action === 'activeTabChanged' && 'url' in message) {
        focusedSessionUrlRef.current = message.url;
        void hydrateSession({ silent: true });
        return;
      }
      if (message.action === 'jobSessionUpdated' && 'session' in message) {
        if (
          focusedSessionUrlRef.current &&
          message.session.pageUrl !== focusedSessionUrlRef.current
        ) {
          return;
        }
        applySession(message.session);
        return;
      }
      if (message.action === 'jobExtracted' && 'job' in message) {
        if (
          focusedSessionUrlRef.current &&
          message.job.sourceUrl !== focusedSessionUrlRef.current
        ) {
          return;
        }
        setCurrentJob(message.job);
        return;
      }
      if (message.action === 'jobCheckResult' && 'result' in message) {
        if (
          'url' in message &&
          typeof message.url === 'string' &&
          focusedSessionUrlRef.current &&
          message.url !== focusedSessionUrlRef.current
        ) {
          return;
        }
        setCheckResult(message.result);
        if (message.result.saved && message.result.jobId) {
          setJobAnalysisId(message.result.jobId);
          setSaveState({
            status: 'saved',
            jobId: message.result.jobId,
            jobStatus: message.result.status ?? 'saved',
          });
        }
        if (message.result.dashboardUrl) {
          setDashboardUrl(message.result.dashboardUrl);
        }
        if (message.result.aiUsage) setAiUsage(message.result.aiUsage);
        return;
      }
      if (message.action === 'cvProfilesResult' && 'profiles' in message) {
        setProfiles(message.profiles);
        setProfilesLoading(false);
        setSelectedCvIdState((prev) => {
          if (prev) return prev;
          const defaultProfile =
            message.profiles.find((p) => p.isDefault) ?? message.profiles[0];
          return defaultProfile?.id ?? null;
        });
        return;
      }
      if (message.action === 'cvScoreResult' && 'result' in message) {
        setScoreState({ status: 'done', result: message.result });
        setDashboardUrl(message.result.dashboardUrl ?? null);
        if (message.result.aiUsage) setAiUsage(message.result.aiUsage);
        if (message.result.jobAnalysisId) {
          setJobAnalysisId(message.result.jobAnalysisId);
        }
        return;
      }
      if (message.action === 'aiUsageUpdated' && 'aiUsage' in message) {
        setAiUsage(message.aiUsage);
        return;
      }
      if (message.action === 'cvScoreError' && 'message' in message) {
        setScoreState({ status: 'error', message: message.message });
        return;
      }
      if (message.action === 'coverLetterResult' && 'result' in message) {
        setCoverLetterState({ status: 'done', result: message.result });
        if (message.result.dashboardUrl) {
          setDashboardUrl(message.result.dashboardUrl);
        }
        return;
      }
      if (message.action === 'coverLetterError' && 'message' in message) {
        setCoverLetterState({ status: 'error', message: message.message });
        return;
      }
      if (message.action === 'jobSaved') {
        setSaveState({
          status: 'saved',
          jobId: message.jobId,
          jobStatus: message.jobStatus,
        });
        setJobAnalysisId(message.jobId);
        void hydrateSession({ silent: true });
      }
      if (message.action === 'saveError') {
        setSaveState({ status: 'error', message: message.message });
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [applySession, hydrateSession]);

  const value = useMemo(
    () => ({
      currentJob,
      jobAnalysisId,
      checkResult,
      saveState,
      setSaveState,
      scoreState,
      setScoreState,
      coverLetterState,
      setCoverLetterState,
      selectedCvId,
      setSelectedCvId,
      profiles,
      profilesLoading,
      dashboardUrl,
      aiUsage,
      pinnedFromOtherTab,
      jobLoading,
      refreshJob,
      reloadPageForJob,
      importJobFromUrl,
      clearJob,
    }),
    [
      aiUsage,
      checkResult,
      clearJob,
      coverLetterState,
      currentJob,
      dashboardUrl,
      jobAnalysisId,
      jobLoading,
      pinnedFromOtherTab,
      profiles,
      profilesLoading,
      refreshJob,
      reloadPageForJob,
      importJobFromUrl,
      saveState,
      scoreState,
      selectedCvId,
      setSelectedCvId,
    ],
  );

  return (
    <JobSessionContext.Provider value={value}>{children}</JobSessionContext.Provider>
  );
}

export function useJobSession(): JobSessionContextValue {
  const ctx = useContext(JobSessionContext);
  if (!ctx) {
    throw new Error('useJobSession must be used within JobSessionProvider');
  }
  return ctx;
}
