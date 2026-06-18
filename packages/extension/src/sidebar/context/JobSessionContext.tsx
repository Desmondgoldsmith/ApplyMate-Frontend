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
import { isAlignedExtensionScore, isRichScore } from '@/shared/job-session';
import { jobContentFingerprint } from '@/shared/job-content-fingerprint';
import { jobUrlsMatch } from '@/shared/job-page-url';

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
  busyOperation: 'scoring' | 'coverLetter' | null;
  selectedCvId: string | null;
  setSelectedCvId: (cvId: string) => void;
  profiles: CvProfile[];
  profilesLoading: boolean;
  dashboardUrl: string | null;
  aiUsage: AiUsageSnapshot | null;
  pinnedFromOtherTab: boolean;
  pendingNewJob: ExtractedJob | null;
  switchToPendingNewJob: () => Promise<void>;
  dismissPendingNewJob: () => void;
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
      companyLogoUrl: session.check.companyLogoUrl ?? null,
    };
  } else if (session.score?.jobAnalysisId && (session.score.persisted || session.jobAnalysisId)) {
    saveState = {
      status: 'saved',
      jobId: session.score.jobAnalysisId,
      jobStatus: session.check?.status ?? 'analyzed',
      companyLogoUrl: session.check?.companyLogoUrl ?? null,
    };
  }

  return {
    job: session.extractedJob,
    scoreState: isAlignedExtensionScore(session.score)
      ? { status: 'done', result: session.score! }
      : { status: 'idle' },
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
  const [busyOperation, setBusyOperation] = useState<'scoring' | 'coverLetter' | null>(null);
  const [selectedCvId, setSelectedCvIdState] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<CvProfile[]>([]);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [pinnedFromOtherTab, setPinnedFromOtherTab] = useState(false);
  const [pendingNewJob, setPendingNewJob] = useState<ExtractedJob | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageSnapshot | null>(null);
  const focusedSessionUrlRef = useRef<string | null>(null);
  const silentHydrateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const resetAnalysisUi = useCallback(() => {
    setScoreState({ status: 'idle' });
    setCoverLetterState({ status: 'idle' });
    setSaveState({ status: 'idle' });
    setJobAnalysisId(null);
    setCheckResult(null);
    setDashboardUrl(null);
    setBusyOperation(null);
  }, []);

  const syncPinnedFromOtherTab = useCallback(
    (activeUrl: string, jobUrl: string | null | undefined) => {
      setPinnedFromOtherTab(
        Boolean(activeUrl?.trim() && jobUrl?.trim() && !jobUrlsMatch(activeUrl, jobUrl)),
      );
    },
    [],
  );

  const applySession = useCallback(
    (
      session: ExtensionJobSession | null,
      inFlight?: 'scoring' | 'coverLetter' | null,
    ) => {
    const ui = sessionToUi(session);

    setCurrentJob(() => ui.job);
    setJobAnalysisId(
      session?.jobAnalysisId ??
        session?.check?.jobId ??
        session?.score?.jobAnalysisId ??
        null,
    );
    setCheckResult(session?.check ?? null);
    setSaveState((prev) => {
      const next = ui.saveState;
      if (!session) return next;
      if (
        prev.status === 'saved' &&
        next.status === 'idle' &&
        session.jobAnalysisId &&
        prev.jobId === session.jobAnalysisId
      ) {
        return prev;
      }
      return next;
    });
    setScoreState((prev) => {
      if (!session) return inFlight === 'scoring' ? { status: 'loading' } : { status: 'idle' };

      if (inFlight === 'scoring' && !session.score) {
        return { status: 'loading' };
      }

      if (!session.score && !session.check?.hasAnalysis) {
        if (prev.status === 'loading') return prev;
        return { status: 'idle' };
      }

      if (!isAlignedExtensionScore(session.score) && session.check?.hasAnalysis) {
        if (inFlight === 'scoring') return { status: 'loading' };
        return { status: 'idle' };
      }

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
    setCoverLetterState((prev) => {
      if (!session) {
        return inFlight === 'coverLetter' ? { status: 'loading' } : { status: 'idle' };
      }
      if (inFlight === 'coverLetter' && !session.coverLetter?.coverLetter?.trim()) {
        return { status: 'loading' };
      }
      if (session.coverLetter?.coverLetter?.trim()) {
        return { status: 'done', result: session.coverLetter };
      }
      if (prev.status === 'loading') return prev;
      return { status: 'idle' };
    });
    setBusyOperation(inFlight ?? null);
    if (!session) {
      const defaultProfile =
        profilesRef.current.find((p) => p.isDefault) ?? profilesRef.current[0];
      setSelectedCvIdState(defaultProfile?.id ?? null);
    } else if (session.selectedCvId) {
      setSelectedCvIdState(session.selectedCvId);
    } else {
      const serverCvId =
        session?.score?.selectedCvProfileId?.trim() ||
        session?.check?.selectedCvProfileId?.trim();
      if (serverCvId) {
        setSelectedCvIdState(serverCvId);
      } else {
        const defaultProfile =
          profilesRef.current.find((p) => p.isDefault) ?? profilesRef.current[0];
        setSelectedCvIdState(defaultProfile?.id ?? null);
      }
    }
    setDashboardUrl(
      session?.score?.dashboardUrl ??
        session?.check?.dashboardUrl ??
        session?.coverLetter?.dashboardUrl ??
        null,
    );
  },
    [],
  );

  const hydrateSessionCore = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setJobLoading(true);
      try {
        const response = (await chrome.runtime.sendMessage({
          action: 'getJobSession',
        } satisfies MessageAction)) as GetJobSessionResponse | undefined;

        focusedSessionUrlRef.current = response?.session?.pageUrl ?? null;
        applySession(response?.session ?? null, response?.inFlight ?? null);

        if (response?.session?.extractedJob) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeUrl = tab?.url ?? '';
          const jobUrl = response.session.extractedJob.sourceUrl;
          syncPinnedFromOtherTab(activeUrl, jobUrl);
        } else {
          setPinnedFromOtherTab(false);
        }
      } catch {
        if (!showLoading) return;
        applySession(null);
      } finally {
        if (showLoading) setJobLoading(false);
      }
    },
    [applySession, syncPinnedFromOtherTab],
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
    setJobLoading(true);
    try {
      await chrome.runtime.sendMessage({ action: 'probeActiveJob' } satisfies MessageAction);
      await hydrateSessionCore(true);
    } catch {
      await hydrateSessionCore(true);
    } finally {
      setJobLoading(false);
    }
  }, [hydrateSessionCore]);

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
    resetAnalysisUi();
    setPinnedFromOtherTab(false);
    setPendingNewJob(null);
  }, [applySession, resetAnalysisUi]);

  const switchToPendingNewJob = useCallback(async () => {
    if (!pendingNewJob) return;
    const job = pendingNewJob;
    setPendingNewJob(null);
    setJobLoading(true);
    try {
      await chrome.runtime.sendMessage({
        action: 'switchToNewJob',
        job,
      } satisfies MessageAction);
      await hydrateSessionCore(false);
    } finally {
      setJobLoading(false);
    }
  }, [hydrateSessionCore, pendingNewJob]);

  const dismissPendingNewJob = useCallback(async () => {
    const url = pendingNewJob?.sourceUrl;
    setPendingNewJob(null);
    try {
      await chrome.runtime.sendMessage({
        action: 'dismissPendingNewJob',
        url,
      } satisfies MessageAction);
      await hydrateSessionCore(false);
    } catch {
      /* ignore */
    }
  }, [hydrateSessionCore, pendingNewJob]);

  const pendingNewJobRef = useRef<ExtractedJob | null>(null);
  pendingNewJobRef.current = pendingNewJob;

  const setSelectedCvId = useCallback((cvId: string) => {
    setSelectedCvIdState(cvId);
    void chrome.runtime.sendMessage({
      action: 'setSelectedCvId',
      cvId,
    } satisfies MessageAction);
  }, []);

  useEffect(() => {
    void hydrateSessionCore(false);
    void chrome.runtime.sendMessage({ action: 'getCvProfiles' } satisfies MessageAction);
    void chrome.runtime.sendMessage({ action: 'getAiUsage' } satisfies MessageAction);
  }, [hydrateSessionCore]);

  useEffect(() => {
    const onMessage = (message: MessageAction) => {
      if (!message || typeof message !== 'object') return;

      if (message.action === 'activeTabChanged' && 'url' in message) {
        const activeUrl = message.url;
        const sessionUrl =
          'sessionUrl' in message && typeof message.sessionUrl === 'string'
            ? message.sessionUrl
            : focusedSessionUrlRef.current;
        focusedSessionUrlRef.current = sessionUrl ?? null;
        syncPinnedFromOtherTab(activeUrl, sessionUrl);
        if (pendingNewJobRef.current) return;
        void hydrateSession({ silent: true });
        return;
      }
      if (message.action === 'sidebarOpened') {
        void hydrateSession({ silent: true });
        void chrome.runtime.sendMessage({ action: 'probeActiveJob' } satisfies MessageAction);
        return;
      }
      if (message.action === 'pendingNewJob' && 'job' in message) {
        setPendingNewJob(message.job);
        if ('previousJob' in message && message.previousJob) {
          setCurrentJob(message.previousJob);
          focusedSessionUrlRef.current =
            ('previousUrl' in message && typeof message.previousUrl === 'string'
              ? message.previousUrl
              : message.previousJob.sourceUrl) ?? null;
        }
        return;
      }
      if (message.action === 'jobCleared') {
        applySession(null);
        resetAnalysisUi();
        setPinnedFromOtherTab(false);
        setSelectedCvIdState(() => {
          const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
          return defaultProfile?.id ?? null;
        });
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
        void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          const jobUrl =
            message.session.extractedJob?.sourceUrl ?? message.session.pageUrl;
          syncPinnedFromOtherTab(tab?.url ?? '', jobUrl);
        });
        return;
      }
      if (message.action === 'jobExtracted' && 'job' in message) {
        if (pendingNewJobRef.current) return;
        if (
          focusedSessionUrlRef.current &&
          message.job.sourceUrl !== focusedSessionUrlRef.current
        ) {
          return;
        }
        const nextJob = message.job;
        setCurrentJob((prev) => {
          if (
            prev &&
            jobContentFingerprint(prev) !== jobContentFingerprint(nextJob)
          ) {
            resetAnalysisUi();
          }
          return nextJob;
        });
        void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          syncPinnedFromOtherTab(tab?.url ?? '', nextJob.sourceUrl);
        });
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
            companyLogoUrl: message.result.companyLogoUrl ?? null,
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
      if (message.action === 'cvScoreStarted') {
        setBusyOperation('scoring');
        setScoreState({ status: 'loading' });
        return;
      }
      if (message.action === 'cvScoreResult' && 'result' in message) {
        setBusyOperation(null);
        setScoreState({ status: 'done', result: message.result });
        setDashboardUrl(message.result.dashboardUrl ?? null);
        if (message.result.aiUsage) setAiUsage(message.result.aiUsage);
        if (message.result.jobAnalysisId) {
          setJobAnalysisId(message.result.jobAnalysisId);
        }
        const serverCvId = message.result.selectedCvProfileId?.trim();
        if (serverCvId) setSelectedCvIdState(serverCvId);
        return;
      }
      if (message.action === 'aiUsageUpdated' && 'aiUsage' in message) {
        setAiUsage(message.aiUsage);
        return;
      }
      if (message.action === 'cvScoreError' && 'message' in message) {
        setBusyOperation(null);
        setScoreState({ status: 'error', message: message.message });
        return;
      }
      if (message.action === 'coverLetterStarted') {
        setBusyOperation('coverLetter');
        setCoverLetterState({ status: 'loading' });
        return;
      }
      if (message.action === 'coverLetterResult' && 'result' in message) {
        setBusyOperation(null);
        setCoverLetterState({ status: 'done', result: message.result });
        if (message.result.dashboardUrl) {
          setDashboardUrl(message.result.dashboardUrl);
        }
        return;
      }
      if (message.action === 'coverLetterError' && 'message' in message) {
        setBusyOperation(null);
        setCoverLetterState({ status: 'error', message: message.message });
        return;
      }
      if (message.action === 'jobSaved') {
        setSaveState({
          status: 'saved',
          jobId: message.jobId,
          jobStatus: message.jobStatus,
          companyLogoUrl: message.companyLogoUrl ?? null,
        });
        setJobAnalysisId(message.jobId);
        return;
      }
      if (message.action === 'saveError') {
        setSaveState({ status: 'error', message: message.message });
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [applySession, hydrateSession, profiles, resetAnalysisUi, syncPinnedFromOtherTab]);

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
      busyOperation,
      selectedCvId,
      setSelectedCvId,
      profiles,
      profilesLoading,
      dashboardUrl,
      aiUsage,
      pinnedFromOtherTab,
      pendingNewJob,
      switchToPendingNewJob,
      dismissPendingNewJob,
      jobLoading,
      refreshJob,
      reloadPageForJob,
      importJobFromUrl,
      clearJob,
    }),
    [
      aiUsage,
      busyOperation,
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
