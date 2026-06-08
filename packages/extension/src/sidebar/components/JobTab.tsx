import { useEffect, useReducer, useState, type CSSProperties } from 'react';

import type {
  ExtractedJob,
  JobExtractionState,
  MessageAction,
  SaveState,
} from '@/shared/types';
import { isLikelyJobUrl } from '@/shared/job-page-url';

import { useJobSession } from '../context/JobSessionContext';
const TOKENS = {
  bg: '#080B0A',
  surface: '#0F1512',
  primary: '#00C9B1',
  primaryHover: '#00b5a0',
  teal10: 'rgba(0,201,177,0.10)',
  teal20: 'rgba(0,201,177,0.20)',
  teal30: 'rgba(0,201,177,0.30)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderDefault: 'rgba(255,255,255,0.10)',
  borderHover: 'rgba(255,255,255,0.20)',
  textPrimary: '#F0F4F2',
  textSecondary: 'rgba(240,244,242,0.60)',
  textMuted: 'rgba(240,244,242,0.35)',
  textDisabled: 'rgba(240,244,242,0.25)',
  amber: '#F59E0B',
  red: '#F87171',
  font: 'Inter, system-ui, sans-serif',
} as const;

const WEB_APP_BASE =
  import.meta.env.VITE_WEB_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

const JOB_HUB_URL = `${WEB_APP_BASE}/dashboard/jobs`;

type Action =
  | { type: 'set'; state: JobExtractionState }
  | { type: 'ready'; job: ExtractedJob }
  | { type: 'error'; message: string };

function reducer(_: JobExtractionState, action: Action): JobExtractionState {
  switch (action.type) {
    case 'set':
      return action.state;
    case 'ready':
      return { status: 'ready', job: action.job };
    case 'error':
      return { status: 'error', message: action.message };
    default:
      return { status: 'detecting' };
  }
}

function SpinnerRow({ label }: { label: string }) {
  return (
    <div
      style={{
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.borderSubtle}`,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <style>{`@keyframes applymate-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 20,
          height: 20,
          border: '2px solid rgba(0,201,177,0.2)',
          borderTopColor: TOKENS.primary,
          borderRadius: '50%',
          animation: 'applymate-spin 0.8s linear infinite',
          flexShrink: 0,
        }}
        aria-hidden
      />
      <span
        style={{
          marginLeft: 10,
          fontSize: 13,
          color: TOKENS.textSecondary,
          fontFamily: TOKENS.font,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function NotAJobPageView({
  onReloadPage,
  onImportUrl,
  reloading,
  importing,
  importError,
  onJobListingPage,
}: {
  onReloadPage: () => void;
  onImportUrl: (url: string) => void;
  reloading: boolean;
  importing: boolean;
  importError: string | null;
  onJobListingPage: boolean;
}) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [jobUrl, setJobUrl] = useState('');

  const submitUrl = () => {
    const trimmed = jobUrl.trim();
    if (!trimmed) return;
    onImportUrl(trimmed);
  };

  return (
    <div
      style={{
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.borderSubtle}`,
        borderRadius: 12,
        padding: 20,
        fontFamily: TOKENS.font,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `2px solid ${TOKENS.borderDefault}`,
          margin: '0 auto',
        }}
        aria-hidden
      />
      <p
        style={{
          marginTop: 12,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          color: TOKENS.textPrimary,
        }}
      >
        {onJobListingPage ? 'Job not detected yet' : 'No job detected'}
      </p>
      <p
        style={{
          marginTop: 8,
          textAlign: 'center',
          fontSize: 12,
          lineHeight: 1.6,
          color: TOKENS.textSecondary,
        }}
      >
        {onJobListingPage
          ? 'This looks like a job listing page, but ApplyMate has not read the posting yet. Refresh the page to load the job into the extension.'
          : 'Open a job listing on LinkedIn, Indeed, a company careers page, or any site with a job description — or paste a job link below.'}
      </p>
      {onJobListingPage ? (
        <button
          type="button"
          disabled={reloading}
          style={{
            marginTop: 16,
            width: '100%',
            background: reloading ? TOKENS.teal10 : TOKENS.primary,
            border: 'none',
            borderRadius: 8,
            padding: '11px 12px',
            color: reloading ? TOKENS.textSecondary : '#080B0A',
            fontSize: 13,
            fontWeight: 600,
            cursor: reloading ? 'wait' : 'pointer',
            fontFamily: TOKENS.font,
          }}
          onClick={onReloadPage}
        >
          {reloading ? 'Refreshing page…' : 'Refresh page to detect job'}
        </button>
      ) : null}
      {!showUrlInput ? (
        <button
          type="button"
          style={{
            marginTop: onJobListingPage ? 8 : 16,
            width: '100%',
            background: 'transparent',
            border: `1px solid ${TOKENS.borderDefault}`,
            borderRadius: 8,
            padding: 10,
            color: TOKENS.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: TOKENS.font,
          }}
          onClick={() => setShowUrlInput(true)}
        >
          Paste job link
        </button>
      ) : (
        <div style={{ marginTop: 16 }}>
          <input
            type="url"
            placeholder="https://company.com/careers/job-title"
            value={jobUrl}
            disabled={importing}
            onChange={(e) => setJobUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl();
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: TOKENS.bg,
              border: `1px solid ${TOKENS.borderDefault}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: TOKENS.textPrimary,
              fontSize: 13,
              fontFamily: TOKENS.font,
            }}
          />
          {importError ? (
            <p style={{ marginTop: 8, fontSize: 11, color: TOKENS.red }}>{importError}</p>
          ) : (
            <p style={{ marginTop: 8, fontSize: 11, color: TOKENS.textMuted }}>
              Opens the job page in your current tab and detects the posting.
            </p>
          )}
          <button
            type="button"
            disabled={importing || !jobUrl.trim()}
            onClick={submitUrl}
            style={{
              marginTop: 10,
              width: '100%',
              background: importing ? TOKENS.teal10 : TOKENS.primary,
              border: 'none',
              borderRadius: 8,
              padding: '10px 12px',
              color: importing ? TOKENS.textSecondary : '#080B0A',
              fontSize: 13,
              fontWeight: 600,
              cursor: importing || !jobUrl.trim() ? 'not-allowed' : 'pointer',
              fontFamily: TOKENS.font,
            }}
          >
            {importing ? 'Opening job page…' : 'Open & detect job'}
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${TOKENS.red}`,
        borderRadius: '0 8px 8px 0',
        padding: 16,
        background: TOKENS.surface,
        fontFamily: TOKENS.font,
      }}
    >
      <p style={{ fontSize: 13, color: TOKENS.red, margin: 0 }}>{message}</p>
      <p style={{ marginTop: 6, fontSize: 12, color: TOKENS.textSecondary }}>
        You can paste the job details manually below.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 12,
          background: 'transparent',
          border: `1px solid ${TOKENS.borderDefault}`,
          borderRadius: 8,
          padding: '6px 12px',
          color: TOKENS.textSecondary,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: TOKENS.font,
        }}
      >
        Try again
      </button>
    </div>
  );
}

function SaveJobButton({
  job,
  saveState,
  setSaveState,
}: {
  job: ExtractedJob;
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
}) {
  const handleSave = () => {
    if (saveState.status === 'saving' || saveState.status === 'saved') return;
    setSaveState({ status: 'saving' });
    void chrome.runtime.sendMessage({
      action: 'saveJob',
      payload: {
        title: job.title,
        ...(job.company?.trim() ? { company: job.company.trim() } : {}),
        location: job.location?.trim() ? job.location : undefined,
        description: job.description?.trim() ? job.description : undefined,
        salary: job.salary ?? undefined,
        jobType: job.jobType ?? undefined,
        experienceLevel: job.experienceLevel ?? undefined,
        postedDate: job.postedDate ?? undefined,
        sourceUrl: job.sourceUrl,
        sourceSite: job.sourceSite,
      },
    } satisfies MessageAction);
  };

  const openJobHub = () => {
    void chrome.tabs.create({ url: JOB_HUB_URL });
  };

  if (saveState.status === 'saved') {
    return (
      <div>
        <button
          type="button"
          disabled
          style={{
            width: '100%',
            padding: 11,
            background: TOKENS.teal10,
            border: `1px solid ${TOKENS.teal30}`,
            color: TOKENS.primary,
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            cursor: 'default',
            fontFamily: TOKENS.font,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden>✓</span>
          <span>Saved to Job Hub</span>
        </button>
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 11,
              color: 'rgba(240,244,242,0.50)',
            }}
          >
            Status: {saveState.jobStatus}
          </span>
          <button
            type="button"
            onClick={openJobHub}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              fontSize: 11,
              color: TOKENS.primary,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            View in Job Hub →
          </button>
        </div>
      </div>
    );
  }

  if (saveState.status === 'error') {
    return (
      <div>
        <button
          type="button"
          disabled
          style={{
            width: '100%',
            padding: 11,
            background: 'rgba(248,113,113,0.10)',
            border: '1px solid rgba(248,113,113,0.30)',
            color: TOKENS.red,
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            cursor: 'default',
            fontFamily: TOKENS.font,
          }}
        >
          {saveState.message}
        </button>
        <button
          type="button"
          onClick={() => setSaveState({ status: 'idle' })}
          style={{
            marginTop: 8,
            padding: 0,
            border: 'none',
            background: 'none',
            fontSize: 12,
            color: TOKENS.textSecondary,
            cursor: 'pointer',
            fontFamily: TOKENS.font,
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const saving = saveState.status === 'saving';

  return (
    <button
      type="button"
      disabled={saving}
      onClick={handleSave}
      style={{
        width: '100%',
        padding: 11,
        background: saving ? 'rgba(0,201,177,0.5)' : TOKENS.primary,
        color: TOKENS.bg,
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 8,
        border: 'none',
        cursor: saving ? 'not-allowed' : 'pointer',
        fontFamily: TOKENS.font,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!saving) e.currentTarget.style.background = TOKENS.primaryHover;
      }}
      onMouseLeave={(e) => {
        if (!saving) e.currentTarget.style.background = TOKENS.primary;
      }}
    >
      {saving ? (
        <>
          <style>{`@keyframes applymate-spin-sm { to { transform: rotate(360deg); } }`}</style>
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid rgba(8,11,10,0.25)',
              borderTopColor: TOKENS.bg,
              borderRadius: '50%',
              animation: 'applymate-spin-sm 0.8s linear infinite',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <span>Saving...</span>
        </>
      ) : (
        'Save to Job Hub'
      )}
    </button>
  );
}

function JobReadyView({
  job,
  saveState,
  setSaveState,
  onClear,
  pinnedFromOtherTab,
  jobAnalysisId,
  hasAnalysis,
}: {
  job: ExtractedJob;
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
  onClear: () => void;
  pinnedFromOtherTab: boolean;
  jobAnalysisId: string | null;
  hasAnalysis: boolean;
}) {
  const [descExpanded, setDescExpanded] = useState(false);

  const badgeParts = [job.sourceSite];
  if (!hasAnalysis && job.extractedBy === 'ai-fallback') {
    badgeParts.push('AI extracted');
  }

  const metaPills = [job.location, job.jobType, job.experienceLevel].filter(
    (v): v is string => Boolean(v?.trim()),
  );

  const openAnalyzer = () => {
    const analysisId =
      jobAnalysisId ?? (saveState.status === 'saved' ? saveState.jobId : null);
    if (analysisId) {
      const params = new URLSearchParams({
        source: 'extension',
        jobId: analysisId,
        jobTitle: job.title,
        company: job.company ?? '',
      });
      if (job.description?.trim()) {
        params.set('description', job.description);
      }
      void chrome.tabs.create({
        url: `${WEB_APP_BASE}/dashboard/jobs/analyze?${params.toString()}`,
      });
      return;
    }
    const params = new URLSearchParams({
      source: 'extension',
      jobTitle: job.title,
      company: job.company ?? '',
      description: job.description ?? '',
    });
    void chrome.tabs.create({
      url: `${WEB_APP_BASE}/dashboard/jobs/analyze?${params.toString()}`,
    });
  };

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: TOKENS.textMuted,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    margin: 0,
  };

  const divider = (
    <div
      style={{ margin: '16px 0', height: 1, background: TOKENS.borderSubtle }}
      aria-hidden
    />
  );

  return (
    <div style={{ fontFamily: TOKENS.font }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'inline-block',
            background: TOKENS.teal10,
            border: `1px solid ${TOKENS.teal20}`,
            borderRadius: 20,
            padding: '3px 10px',
            fontSize: 11,
            color: TOKENS.primary,
            fontWeight: 500,
          }}
        >
          {badgeParts.join(' · ')}
        </span>
        <h2
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 16,
            fontWeight: 600,
            color: TOKENS.textPrimary,
            lineHeight: 1.3,
          }}
        >
          {job.title}
        </h2>
        {job.company ? (
          <p style={{ marginTop: 4, marginBottom: 0, fontSize: 13, color: 'rgba(240,244,242,0.70)' }}>
            {job.company}
          </p>
        ) : null}
        {metaPills.length > 0 ? (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {metaPills.map((pill) => (
              <span
                key={pill}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20,
                  padding: '2px 8px',
                  fontSize: 11,
                  color: 'rgba(240,244,242,0.50)',
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        ) : null}
        {pinnedFromOtherTab ? (
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 11, color: TOKENS.textMuted }}>
            Kept from a previous job page — clear when you are done.
          </p>
        ) : null}
        </div>
        <button
          type="button"
          onClick={onClear}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: `1px solid ${TOKENS.borderDefault}`,
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            color: TOKENS.textSecondary,
            cursor: 'pointer',
            fontFamily: TOKENS.font,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = TOKENS.borderHover;
            e.currentTarget.style.color = TOKENS.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = TOKENS.borderDefault;
            e.currentTarget.style.color = TOKENS.textSecondary;
          }}
        >
          Clear
        </button>
      </div>

      {job.salary ? (
        <>
          {divider}
          <div>
            <p style={labelStyle}>Salary</p>
            <p
              style={{
                marginTop: 4,
                marginBottom: 0,
                fontSize: 14,
                color: TOKENS.amber,
                fontWeight: 500,
              }}
            >
              {job.salary}
            </p>
            <p style={{ marginTop: 3, marginBottom: 0, fontSize: 11, color: TOKENS.textMuted }}>
              AI estimate · Not verified market data
            </p>
          </div>
        </>
      ) : null}

      {divider}

      <div>
        <p style={labelStyle}>Description</p>
        <div
          className="am-scroll"
          style={{
            marginTop: 6,
            fontSize: 12,
            color: TOKENS.textSecondary,
            lineHeight: 1.6,
            maxHeight: descExpanded ? 'none' : 120,
            overflowY: descExpanded ? 'visible' : 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {job.description || 'No description extracted.'}
        </div>
        {job.description && job.description.length > 180 ? (
          <button
            type="button"
            onClick={() => setDescExpanded((v) => !v)}
            style={{
              marginTop: 8,
              padding: 0,
              border: 'none',
              background: 'none',
              fontSize: 12,
              color: TOKENS.primary,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
          >
            {descExpanded ? 'Show less' : 'Show more'}
          </button>
        ) : null}
      </div>

      {divider}

      <div>
        <SaveJobButton job={job} saveState={saveState} setSaveState={setSaveState} />
        <button
          type="button"
          onClick={openAnalyzer}
          style={{
            marginTop: 8,
            width: '100%',
            background: 'transparent',
            border: `1px solid ${TOKENS.borderDefault}`,
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            color: TOKENS.textSecondary,
            cursor: 'pointer',
            fontFamily: TOKENS.font,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = TOKENS.borderHover;
            e.currentTarget.style.color = TOKENS.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = TOKENS.borderDefault;
            e.currentTarget.style.color = TOKENS.textSecondary;
          }}
        >
          Open full analyzer →
        </button>
      </div>
    </div>
  );
}

export function JobTab() {
  const {
    currentJob,
    saveState,
    setSaveState,
    pinnedFromOtherTab,
    jobLoading,
    jobAnalysisId,
    checkResult,
    scoreState,
    refreshJob,
    reloadPageForJob,
    importJobFromUrl,
    clearJob,
  } = useJobSession();

  const [state, dispatch] = useReducer(reducer, { status: 'detecting' } satisfies JobExtractionState);
  const [onJobListingPage, setOnJobListingPage] = useState(false);
  const [reloadingPage, setReloadingPage] = useState(false);
  const [importingUrl, setImportingUrl] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setOnJobListingPage(Boolean(tab?.url && isLikelyJobUrl(tab.url)));
    });
  }, [currentJob, jobLoading, state.status]);

  useEffect(() => {
    if (jobLoading) {
      dispatch({ type: 'set', state: { status: 'detecting' } });
      return;
    }
    if (currentJob) {
      dispatch({ type: 'ready', job: currentJob });
      return;
    }
    dispatch({ type: 'set', state: { status: 'not-a-job-page' } });
  }, [currentJob, jobLoading]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    chrome.runtime.sendMessage(
      { action: 'checkJobSaved', url: state.job.sourceUrl } satisfies MessageAction,
      () => {
        /* session context handles enriched check response */
      },
    );
  }, [state.status, state.status === 'ready' ? state.job.sourceUrl : null]);

  useEffect(() => {
    const onMessage = (message: MessageAction) => {
      if (!message || typeof message !== 'object') return;
      if (message.action === 'jobExtracted' && 'job' in message) {
        dispatch({ type: 'ready', job: message.job });
        return;
      }
      if (message.action === 'extractionError' && 'message' in message) {
        dispatch({ type: 'error', message: message.message });
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const refreshExtraction = () => void refreshJob();

  const reloadPage = () => {
    setReloadingPage(true);
    dispatch({ type: 'set', state: { status: 'detecting' } });
    void reloadPageForJob().finally(() => {
      setReloadingPage(false);
    });
  };

  const handleImportUrl = (url: string) => {
    setImportError(null);
    setImportingUrl(true);
    dispatch({ type: 'set', state: { status: 'detecting' } });
    void importJobFromUrl(url)
      .then((result) => {
        if (!result.ok) {
          setImportError(result.error ?? 'Could not open that URL.');
          dispatch({ type: 'set', state: { status: 'not-a-job-page' } });
        }
      })
      .finally(() => {
        setImportingUrl(false);
      });
  };

  if (state.status === 'detecting') {
    return (
      <div>
        <SpinnerRow label={reloadingPage ? 'Refreshing page…' : 'Scanning page...'} />
        {onJobListingPage && !reloadingPage ? (
          <button
            type="button"
            style={{
              marginTop: 12,
              width: '100%',
              background: TOKENS.primary,
              border: 'none',
              borderRadius: 8,
              padding: '11px 12px',
              color: '#080B0A',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
            onClick={reloadPage}
          >
            Refresh page to detect job
          </button>
        ) : null}
      </div>
    );
  }

  if (state.status === 'extracting') {
    return <SpinnerRow label="Extracting job details..." />;
  }

  if (state.status === 'not-a-job-page') {
    return (
      <NotAJobPageView
        onReloadPage={reloadPage}
        onImportUrl={handleImportUrl}
        reloading={reloadingPage}
        importing={importingUrl}
        importError={importError}
        onJobListingPage={onJobListingPage}
      />
    );
  }

  if (state.status === 'error') {
    return <ErrorView message={state.message} onRetry={() => void refreshExtraction()} />;
  }

  if (state.status === 'ready') {
    return (
      <JobReadyView
        job={state.job}
        saveState={saveState}
        setSaveState={setSaveState}
        onClear={() => void clearJob()}
        pinnedFromOtherTab={pinnedFromOtherTab}
        jobAnalysisId={
          jobAnalysisId ??
          (scoreState.status === 'done' ? scoreState.result.jobAnalysisId ?? null : null)
        }
        hasAnalysis={Boolean(
          checkResult?.hasAnalysis ||
            (scoreState.status === 'done' && scoreState.result.matchScore != null),
        )}
      />
    );
  }

  return null;
}
