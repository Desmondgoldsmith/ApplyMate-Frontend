import { useCallback, useEffect, useState } from 'react';

import type { MessageAction, RequestRecentJobsResponse, SavedJob } from '@/shared/types';

import { useJobSession } from '../context/JobSessionContext';
import { CompanyLogoBadge } from './CompanyLogoBadge';

const TOKENS = {
  bg: '#080B0A',
  surface: '#0F1512',
  primary: '#00C9B1',
  teal10: 'rgba(0,201,177,0.10)',
  teal20: 'rgba(0,201,177,0.20)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderDefault: 'rgba(255,255,255,0.10)',
  borderHover: 'rgba(255,255,255,0.20)',
  textPrimary: '#F0F4F2',
  textSecondary: 'rgba(240,244,242,0.60)',
  textMuted: 'rgba(240,244,242,0.35)',
  red: '#F87171',
  blue: '#60A5FA',
  amber: '#F59E0B',
  green: '#34D399',
  font: 'Inter, system-ui, sans-serif',
} as const;

const WEB_APP_BASE =
  import.meta.env.VITE_WEB_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

const JOB_HUB_URL = `${WEB_APP_BASE}/dashboard/jobs`;

type HistoryState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; jobs: SavedJob[] }
  | { status: 'error' };

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function statusPillStyle(status: string): {
  background: string;
  border: string;
  color: string;
} {
  const key = status.toUpperCase();
  if (key === 'SAVED' || key === 'BOOKMARKED') {
    return {
      background: TOKENS.teal10,
      border: `1px solid ${TOKENS.teal20}`,
      color: TOKENS.primary,
    };
  }
  if (key === 'APPLIED') {
    return {
      background: 'rgba(59,130,246,0.10)',
      border: '1px solid rgba(59,130,246,0.20)',
      color: TOKENS.blue,
    };
  }
  if (key === 'INTERVIEWING') {
    return {
      background: 'rgba(245,158,11,0.10)',
      border: '1px solid rgba(245,158,11,0.20)',
      color: TOKENS.amber,
    };
  }
  if (key === 'OFFER') {
    return {
      background: 'rgba(52,211,153,0.10)',
      border: '1px solid rgba(52,211,153,0.20)',
      color: TOKENS.green,
    };
  }
  if (key === 'REJECTED') {
    return {
      background: 'rgba(248,113,113,0.10)',
      border: '1px solid rgba(248,113,113,0.20)',
      color: TOKENS.red,
    };
  }
  return {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(240,244,242,0.50)',
  };
}

function LoadingSkeletons() {
  return (
    <div style={{ fontFamily: TOKENS.font }}>
      <style>{`@keyframes applymate-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 60,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            marginBottom: 8,
            animation: 'applymate-pulse 1.5s ease-in-out infinite',
          }}
          aria-hidden
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '32px 16px',
        textAlign: 'center',
        fontFamily: TOKENS.font,
      }}
    >
      <div style={{ position: 'relative', width: 32, height: 44, margin: '0 auto' }}>
        <div
          style={{
            width: 32,
            height: 40,
            border: '2px solid rgba(255,255,255,0.12)',
            borderRadius: '4px 4px 0 0',
          }}
          aria-hidden
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgba(255,255,255,0.12)',
          }}
          aria-hidden
        />
      </div>
      <p
        style={{
          marginTop: 16,
          fontSize: 14,
          fontWeight: 600,
          color: TOKENS.textPrimary,
        }}
      >
        No saved jobs yet
      </p>
      <p
        style={{
          marginTop: 6,
          fontSize: 12,
          lineHeight: 1.6,
          color: 'rgba(240,244,242,0.40)',
        }}
      >
        Jobs you save from any job board will appear here.
      </p>
      <button
        type="button"
        onClick={() => void chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/' })}
        style={{
          marginTop: 20,
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
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = TOKENS.borderDefault;
        }}
      >
        Browse job boards →
      </button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${TOKENS.red}`,
        background: 'rgba(248,113,113,0.06)',
        borderRadius: '0 8px 8px 0',
        padding: 14,
        fontFamily: TOKENS.font,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: TOKENS.red }}>
        Couldn&apos;t load saved jobs
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 10,
          fontSize: 12,
          background: 'transparent',
          color: TOKENS.textSecondary,
          border: `1px solid ${TOKENS.borderDefault}`,
          borderRadius: 6,
          padding: '6px 12px',
          cursor: 'pointer',
          fontFamily: TOKENS.font,
        }}
      >
        Retry
      </button>
    </div>
  );
}

function JobRow({ job, selectedCvId }: { job: SavedJob; selectedCvId: string | null }) {
  const pill = statusPillStyle(job.status);

  const openJob = () => {
    void chrome.runtime.sendMessage({
      action: 'openRecentJob',
      jobId: job.id,
      cvId: selectedCvId,
    } satisfies MessageAction);
  };

  return (
    <button
      type="button"
      onClick={openJob}
      style={{
        width: '100%',
        textAlign: 'left',
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.borderSubtle}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: TOKENS.font,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = TOKENS.borderSubtle;
        e.currentTarget.style.background = TOKENS.surface;
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 8, flex: 1 }}>
          <CompanyLogoBadge company={job.company || job.title} logoUrl={job.companyLogoUrl} size={28} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: TOKENS.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 160,
          }}
        >
          {job.title}
        </span>
        </div>
        <span
          style={{
            borderRadius: 20,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 500,
            flexShrink: 0,
            background: pill.background,
            border: pill.border,
            color: pill.color,
            textTransform: 'uppercase',
          }}
        >
          {job.status}
        </span>
      </div>
      <div
        style={{
          marginTop: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'rgba(240,244,242,0.50)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 120,
          }}
        >
          {job.company}
        </span>
        {job.sourceSite ? (
          <>
            <span style={{ fontSize: 11, color: 'rgba(240,244,242,0.20)' }}>·</span>
            <span style={{ fontSize: 11, color: 'rgba(240,244,242,0.30)' }}>
              {job.sourceSite}
            </span>
          </>
        ) : null}
      </div>
      <p style={{ marginTop: 4, marginBottom: 0, fontSize: 10, color: 'rgba(240,244,242,0.25)' }}>
        {relativeTime(job.savedAt)}
      </p>
    </button>
  );
}

function JobsList({ jobs, selectedCvId }: { jobs: SavedJob[]; selectedCvId: string | null }) {
  return (
    <div style={{ fontFamily: TOKENS.font }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.textPrimary }}>
          Saved jobs
        </span>
        <span
          style={{
            background: TOKENS.teal10,
            border: `1px solid ${TOKENS.teal20}`,
            borderRadius: 20,
            padding: '2px 8px',
            fontSize: 11,
            color: TOKENS.primary,
          }}
        >
          {jobs.length} jobs
        </span>
      </div>
      <div>
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} selectedCvId={selectedCvId} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => void chrome.tabs.create({ url: JOB_HUB_URL })}
        style={{
          marginTop: 12,
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'none',
          fontSize: 12,
          color: 'rgba(240,244,242,0.40)',
          textAlign: 'center',
          cursor: 'pointer',
          fontFamily: TOKENS.font,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = TOKENS.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(240,244,242,0.40)';
        }}
      >
        View all in Job Hub →
      </button>
    </div>
  );
}

export function HistoryTab() {
  const [state, setState] = useState<HistoryState>({ status: 'loading' });
  const { selectedCvId } = useJobSession();

  const loadJobs = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const response = (await chrome.runtime.sendMessage({
        action: 'requestRecentJobs',
      } satisfies MessageAction)) as RequestRecentJobsResponse | undefined;

      const jobs = response?.jobs ?? [];
      if (jobs.length === 0) {
        setState({ status: 'empty' });
      } else {
        setState({ status: 'ready', jobs });
      }
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  if (state.status === 'loading') {
    return <LoadingSkeletons />;
  }

  if (state.status === 'empty') {
    return <EmptyState />;
  }

  if (state.status === 'error') {
    return <ErrorState onRetry={() => void loadJobs()} />;
  }

  return <JobsList jobs={state.jobs} selectedCvId={selectedCvId} />;
}
