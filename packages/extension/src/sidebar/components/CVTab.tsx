import { useEffect, useState, type Dispatch, type ReactNode } from 'react';

import { gapLabelsFromScore } from '@/shared/job-session';
import type {
  CvScoreResult,
  CvTabState,
  ExtractedJob,
  MessageAction,
  TailorStatus,
} from '@/shared/types';

import { useJobSession } from '../context/JobSessionContext';

const TOKENS = {
  bg: '#080B0A',
  surface: '#0F1512',
  primary: '#00C9B1',
  teal10: 'rgba(0,201,177,0.10)',
  teal12: 'rgba(0,201,177,0.12)',
  teal18: 'rgba(0,201,177,0.18)',
  teal25: 'rgba(0,201,177,0.25)',
  teal40: 'rgba(0,201,177,0.40)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderDefault: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,255,255,0.20)',
  textPrimary: '#F0F4F2',
  textSecondary: 'rgba(240,244,242,0.60)',
  textMuted: 'rgba(240,244,242,0.35)',
  textDisabled: 'rgba(240,244,242,0.25)',
  amber: '#F59E0B',
  red: '#F87171',
  green: '#34D399',
  blue: '#60A5FA',
  font: 'Inter, system-ui, sans-serif',
  teal05: 'rgba(0,201,177,0.05)',
  teal15: 'rgba(0,201,177,0.15)',
  teal20border: 'rgba(0,201,177,0.20)',
  green06: 'rgba(52,211,153,0.06)',
  green10: 'rgba(52,211,153,0.10)',
  green15: 'rgba(52,211,153,0.15)',
  green20: 'rgba(52,211,153,0.20)',
  green30: 'rgba(52,211,153,0.30)',
} as const;

const WEB_APP_BASE =
  import.meta.env.VITE_WEB_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

const CV_BUILDER_URL = `${WEB_APP_BASE}/dashboard/cv`;
const CV_PROFILES_URL = `${WEB_APP_BASE}/dashboard/cv-profiles`;

const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(240,244,242,0.4)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;

type CvTabAction =
  | { type: 'selectCv'; cvId: string }
  | { type: 'setScoreState'; state: CvTabState['scoreState'] }
  | { type: 'setCoverLetterState'; state: CvTabState['coverLetterState'] };

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

function scoreColor(value: number): string {
  if (value >= 75) return TOKENS.primary;
  if (value >= 60) return TOKENS.blue;
  if (value >= 40) return TOKENS.amber;
  return TOKENS.red;
}

function scoreLabelPillStyle(
  label: CvScoreResult['scoreLabel'],
): { background: string; border: string; color: string } {
  switch (label) {
    case 'Excellent':
      return {
        background: 'rgba(52,211,153,0.12)',
        border: 'rgba(52,211,153,0.25)',
        color: TOKENS.green,
      };
    case 'Strong':
      return {
        background: TOKENS.teal12,
        border: TOKENS.teal25,
        color: TOKENS.primary,
      };
    case 'Good':
      return {
        background: 'rgba(96,165,250,0.12)',
        border: 'rgba(96,165,250,0.25)',
        color: TOKENS.blue,
      };
    case 'Fair':
      return {
        background: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.25)',
        color: TOKENS.amber,
      };
    case 'Weak':
      return {
        background: 'rgba(248,113,113,0.12)',
        border: 'rgba(248,113,113,0.25)',
        color: TOKENS.red,
      };
    default:
      return {
        background: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.10)',
        color: TOKENS.textSecondary,
      };
  }
}

function Divider() {
  return (
    <div
      style={{ margin: '16px 0', height: 1, background: TOKENS.borderSubtle }}
      aria-hidden
    />
  );
}

function InlineSpinner({ size = 20 }: { size?: number }) {
  return (
    <>
      <style>{`@keyframes applymate-cv-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: size,
          height: size,
          border: '2px solid rgba(0,201,177,0.2)',
          borderTopColor: TOKENS.primary,
          borderRadius: '50%',
          animation: 'applymate-cv-spin 0.8s linear infinite',
          flexShrink: 0,
        }}
        aria-hidden
      />
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 8px',
        fontSize: 11,
        fontWeight: 600,
        color: TOKENS.textMuted,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontFamily: TOKENS.font,
      }}
    >
      {children}
    </p>
  );
}

function CvSelectorSection({
  state,
  dispatch,
}: {
  state: CvTabState;
  dispatch: Dispatch<CvTabAction>;
}) {
  const selectedProfile = state.profiles.find((p) => p.id === state.selectedCvId);

  if (state.profilesLoading) {
    return (
      <div>
        <SectionLabel>Using CV</SectionLabel>
        <style>{`@keyframes applymate-cv-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
        <div
          style={{
            height: 36,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            width: '100%',
            animation: 'applymate-cv-pulse 1.5s ease-in-out infinite',
          }}
          aria-hidden
        />
      </div>
    );
  }

  if (state.profiles.length === 0) {
    return (
      <div>
        <SectionLabel>Using CV</SectionLabel>
        <div
          style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: 8,
            padding: 12,
            fontFamily: TOKENS.font,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: TOKENS.amber }}>No CV profiles found.</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(240,244,242,0.40)' }}>
            Create a CV on the dashboard first.
          </p>
          <button
            type="button"
            onClick={() => void chrome.tabs.create({ url: CV_BUILDER_URL })}
            style={{
              marginTop: 10,
              fontSize: 12,
              background: 'transparent',
              color: TOKENS.amber,
              border: '1px solid rgba(245,158,11,0.30)',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(245,158,11,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Go to CV Builder →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Using CV</SectionLabel>
      <select
        value={state.selectedCvId ?? ''}
        onChange={(e) => dispatch({ type: 'selectCv', cvId: e.target.value })}
        style={{
          width: '100%',
          padding: '9px 32px 9px 12px',
          background: TOKENS.surface,
          border: `1px solid ${TOKENS.borderDefault}`,
          borderRadius: 8,
          color: TOKENS.textPrimary,
          fontSize: 13,
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: CHEVRON_SVG,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          fontFamily: TOKENS.font,
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = TOKENS.borderHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = TOKENS.borderDefault;
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = 'none';
          e.currentTarget.style.borderColor = TOKENS.primary;
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,201,177,0.15)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = TOKENS.borderDefault;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {state.profiles.map((profile) => (
          <option
            key={profile.id}
            value={profile.id}
            style={{ background: TOKENS.surface, color: TOKENS.textPrimary }}
          >
            {profile.name}
            {profile.isDefault ? ' (Default)' : ''}
          </option>
        ))}
      </select>
      {selectedProfile ? (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: TOKENS.textDisabled }}>
          Last updated {relativeTime(selectedProfile.lastUpdated)}
        </p>
      ) : null}
    </div>
  );
}

function NoJobWarning() {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${TOKENS.borderDefault}`,
        borderRadius: 8,
        padding: 14,
        fontFamily: TOKENS.font,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TOKENS.textSecondary }}>
        Open a job listing first
      </p>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 12,
          color: TOKENS.textMuted,
          lineHeight: 1.6,
        }}
      >
        Navigate to a job page and the CV scoring and cover letter features will activate
        automatically.
      </p>
    </div>
  );
}

function ScoreRing({ score, animatedScore }: { score: number; animatedScore: number }) {
  const color = scoreColor(score);
  const dashLength = animatedScore * 2.01;

  return (
    <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
      <circle
        cx="40"
        cy="40"
        r="32"
        fill="none"
        stroke={TOKENS.borderSubtle}
        strokeWidth="6"
      />
      <circle
        cx="40"
        cy="40"
        r="32"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        strokeDasharray={`${dashLength} 201`}
        style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
      />
      <text
        x="40"
        y="36"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill={color}
        fontFamily={TOKENS.font}
      >
        {Math.round(animatedScore)}
      </text>
      <text
        x="40"
        y="50"
        textAnchor="middle"
        fontSize="10"
        fill="rgba(240,244,242,0.30)"
        fontFamily={TOKENS.font}
      >
        / 100
      </text>
    </svg>
  );
}

function MatchScoreSection({
  state,
  dispatch,
  currentJob,
  jobAnalysisId,
  dashboardUrl,
  hasAnalysis,
}: {
  state: CvTabState;
  dispatch: Dispatch<CvTabAction>;
  currentJob: ExtractedJob;
  jobAnalysisId: string | null;
  dashboardUrl: string | null;
  hasAnalysis: boolean;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (state.scoreState.status !== 'done') {
      setAnimatedScore(0);
      return;
    }
    const target = state.scoreState.result.matchScore;
    const timeout = window.setTimeout(() => setAnimatedScore(target), 50);
    return () => window.clearTimeout(timeout);
  }, [state.scoreState]);

  const pillStyle =
    state.scoreState.status === 'done'
      ? scoreLabelPillStyle(state.scoreState.result.scoreLabel)
      : null;

  const analysisUrl =
    dashboardUrl ??
    (state.scoreState.status === 'done'
      ? state.scoreState.result.dashboardUrl
      : null) ??
    `${WEB_APP_BASE}/dashboard/jobs`;

  const cardStyle = {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.borderSubtle}`,
    borderRadius: 10,
    padding: 16,
    fontFamily: TOKENS.font,
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <SectionLabel>Match score</SectionLabel>
        {state.scoreState.status === 'done' && pillStyle ? (
          <span
            style={{
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: pillStyle.background,
              border: `1px solid ${pillStyle.border}`,
              color: pillStyle.color,
            }}
          >
            {state.scoreState.result.scoreLabel}
          </span>
        ) : null}
      </div>

      {state.scoreState.status === 'idle' ? (
        <div style={cardStyle}>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 12,
              color: 'rgba(240,244,242,0.40)',
              lineHeight: 1.5,
            }}
          >
            See how well your CV matches this job across skills, experience, keywords, seniority,
            and industry.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!state.selectedCvId) return;
              dispatch({ type: 'setScoreState', state: { status: 'loading' } });
              void chrome.runtime.sendMessage({
                action: 'getCvScore',
                cvId: state.selectedCvId,
                jobDescription: currentJob.description,
                jobTitle: currentJob.title,
                company: currentJob.company,
                jobAnalysisId,
                sourceUrl: currentJob.sourceUrl,
                sourceSite: currentJob.sourceSite,
              } satisfies MessageAction);
            }}
            style={{
              width: '100%',
              padding: 10,
              background: TOKENS.teal10,
              border: `1px solid ${TOKENS.teal25}`,
              borderRadius: 8,
              color: TOKENS.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = TOKENS.teal18;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = TOKENS.teal10;
            }}
          >
            Get match score{hasAnalysis ? '' : ' (uses 1 free AI)'}
          </button>
        </div>
      ) : null}

      {state.scoreState.status === 'loading' ? (
        <div
          style={{
            ...cardStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <InlineSpinner />
          <span style={{ fontSize: 12, color: 'rgba(240,244,242,0.40)' }}>
            Analysing your CV...
          </span>
        </div>
      ) : null}

      {state.scoreState.status === 'error' ? (
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
            {state.scoreState.message}
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'setScoreState', state: { status: 'idle' } })}
            style={{
              marginTop: 8,
              padding: 0,
              border: 'none',
              background: 'none',
              fontSize: 12,
              color: 'rgba(240,244,242,0.40)',
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {state.scoreState.status === 'done' ? (() => {
        const scoreResult = state.scoreState.result;
        const gapLabels = gapLabelsFromScore(scoreResult);
        const salaryNote = scoreResult.salaryEstimate?.note?.toLowerCase() ?? '';
        const salaryFromPosting =
          scoreResult.salaryEstimate?.source === 'job_description' &&
          !salaryNote.includes('no specific pay band');
        return (
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <ScoreRing score={scoreResult.matchScore} animatedScore={animatedScore} />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: TOKENS.primary,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {(() => {
                  const cached = scoreResult.fromCache ? 'Cached · ' : '';
                  if (scoreResult.scoreSource === 'heuristic') return `${cached}Estimated match`;
                  if (scoreResult.scoreSource === 'ai') return `${cached}AI analyzed`;
                  return `${cached}AI analyzed`;
                })()}
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: TOKENS.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                Gaps below come from the server — open the full analyzer for tailoring and salary
                detail.
              </p>
            </div>
          </div>

          {scoreResult.locationEligibility?.message ? (
            <div
              style={{
                marginTop: 12,
                borderRadius: 10,
                border: '1px solid rgba(56,189,248,0.25)',
                background: 'rgba(56,189,248,0.08)',
                padding: '10px 12px',
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(186,230,253,0.92)', lineHeight: 1.5 }}>
                {scoreResult.locationEligibility.message}
              </p>
            </div>
          ) : null}

          {scoreResult.salaryEstimate ? (
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  borderRadius: 20,
                  border: `1px solid ${salaryFromPosting ? 'rgba(52,211,153,0.30)' : 'rgba(245,158,11,0.30)'}`,
                  background: salaryFromPosting ? 'rgba(52,211,153,0.10)' : 'rgba(245,158,11,0.10)',
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: salaryFromPosting ? TOKENS.green : TOKENS.amber,
                }}
              >
                {salaryFromPosting ? 'From job posting' : 'AI estimate'}
              </span>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: TOKENS.textSecondary }}>
                {scoreResult.salaryEstimate.currency}{' '}
                {Math.round(scoreResult.salaryEstimate.min).toLocaleString()} –{' '}
                {Math.round(scoreResult.salaryEstimate.max).toLocaleString()}
                {scoreResult.salaryEstimate.basis ? ` / ${scoreResult.salaryEstimate.basis}` : ''}
              </p>
            </div>
          ) : null}

          <div
            style={{ margin: '14px 0', height: 1, background: TOKENS.borderSubtle }}
            aria-hidden
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(52,211,153,0.80)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Strengths
              </p>
              {scoreResult.topStrengths.slice(0, 3).map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: TOKENS.green,
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: TOKENS.textSecondary,
                      lineHeight: 1.4,
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(248,113,113,0.80)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Gaps
              </p>
              {gapLabels.map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: TOKENS.red,
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: TOKENS.textSecondary,
                      lineHeight: 1.4,
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {scoreResult.recommendation ? (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 12,
                color: 'rgba(240,244,242,0.50)',
                lineHeight: 1.6,
                fontStyle: 'italic',
                borderLeft: `2px solid ${TOKENS.borderDefault}`,
                paddingLeft: 10,
              }}
            >
              {scoreResult.recommendation}
            </p>
          ) : null}

          {scoreResult.fromCache ? (
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 11,
                color: TOKENS.textMuted,
              }}
            >
              Loaded saved analysis — no AI used.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void chrome.tabs.create({ url: analysisUrl })}
            style={{
              marginTop: 12,
              width: '100%',
              padding: 10,
              background: TOKENS.primary,
              color: TOKENS.bg,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
          >
            View full analysis in ApplyMate →
          </button>

          <button
            type="button"
            onClick={() => dispatch({ type: 'setScoreState', state: { status: 'idle' } })}
            style={{
              marginTop: 10,
              padding: 0,
              border: 'none',
              background: 'none',
              fontSize: 11,
              color: 'rgba(240,244,242,0.30)',
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(240,244,242,0.60)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(240,244,242,0.30)';
            }}
          >
            Rescore with different CV ↑
          </button>
        </div>
        );
      })() : null}
    </div>
  );
}

function CoverLetterSection({
  state,
  dispatch,
  currentJob,
  jobAnalysisId,
}: {
  state: CvTabState;
  dispatch: Dispatch<CvTabAction>;
  currentJob: ExtractedJob;
  jobAnalysisId: string | null;
}) {
  const [editedLetter, setEditedLetter] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.coverLetterState.status === 'done') {
      setEditedLetter(state.coverLetterState.result.coverLetter);
    }
  }, [state.coverLetterState]);

  const cardStyle = {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.borderSubtle}`,
    borderRadius: 10,
    padding: 16,
    fontFamily: TOKENS.font,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedLetter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div>
      <SectionLabel>Cover letter</SectionLabel>

      {state.coverLetterState.status === 'idle' ? (
        <div style={cardStyle}>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 12,
              color: 'rgba(240,244,242,0.40)',
              lineHeight: 1.5,
            }}
          >
            Generate a tailored cover letter using your CV and this job description.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!state.selectedCvId) return;
              dispatch({ type: 'setCoverLetterState', state: { status: 'loading' } });
              void chrome.runtime.sendMessage({
                action: 'generateCoverLetter',
                cvId: state.selectedCvId,
                jobDescription: currentJob.description,
                jobTitle: currentJob.title,
                company: currentJob.company,
                jobLocation: currentJob.location?.trim() ? currentJob.location : undefined,
                jobType: currentJob.jobType ?? undefined,
                jobAnalysisId,
                sourceUrl: currentJob.sourceUrl,
              } satisfies MessageAction);
            }}
            style={{
              width: '100%',
              padding: 10,
              background: TOKENS.teal10,
              border: `1px solid ${TOKENS.teal25}`,
              borderRadius: 8,
              color: TOKENS.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = TOKENS.teal18;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = TOKENS.teal10;
            }}
          >
            Generate cover letter
          </button>
        </div>
      ) : null}

      {state.coverLetterState.status === 'loading' ? (
        <div
          style={{
            ...cardStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <InlineSpinner />
          <span style={{ fontSize: 12, color: 'rgba(240,244,242,0.40)' }}>
            Writing your cover letter...
          </span>
        </div>
      ) : null}

      {state.coverLetterState.status === 'error' ? (
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
            {state.coverLetterState.message}
          </p>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: 'setCoverLetterState', state: { status: 'idle' } })
            }
            style={{
              marginTop: 8,
              padding: 0,
              border: 'none',
              background: 'none',
              fontSize: 12,
              color: 'rgba(240,244,242,0.40)',
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {state.coverLetterState.status === 'done' ? (
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.textPrimary }}>
              Your cover letter
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${TOKENS.borderDefault}`,
                borderRadius: 20,
                padding: '2px 8px',
                fontSize: 11,
                color: TOKENS.textMuted,
              }}
            >
              {state.coverLetterState.result.wordCount} words
            </span>
          </div>
          <textarea
            value={editedLetter}
            onChange={(e) => setEditedLetter(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 200,
              maxHeight: 320,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${TOKENS.borderDefault}`,
              borderRadius: 8,
              padding: 12,
              color: TOKENS.textPrimary,
              fontSize: 12,
              lineHeight: 1.7,
              fontFamily: TOKENS.font,
              resize: 'vertical',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = 'none';
              e.currentTarget.style.borderColor = TOKENS.teal40;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = TOKENS.borderDefault;
            }}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => void handleCopy()}
              style={{
                flex: 1,
                padding: 9,
                background: 'transparent',
                border: `1px solid ${TOKENS.borderDefault}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                color: copied ? TOKENS.primary : 'rgba(240,244,242,0.70)',
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
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'setCoverLetterState', state: { status: 'idle' } })
              }
              style={{
                flex: 1,
                padding: 9,
                background: 'transparent',
                border: `1px solid ${TOKENS.borderDefault}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                color: 'rgba(240,244,242,0.70)',
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
              Regenerate
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TailorCvSection({
  currentJob,
  selectedCvId,
  tailorState,
  setTailorState,
}: {
  currentJob: ExtractedJob;
  selectedCvId: string | null;
  tailorState: TailorStatus;
  setTailorState: (state: TailorStatus) => void;
}) {
  const openDashboardAgain = async () => {
    const stored = await chrome.storage.session.get('activeTailorSession');
    const raw = stored.activeTailorSession;
    if (typeof raw !== 'string') return;
    try {
      const session = JSON.parse(raw) as { dashboardUrl?: string };
      if (session.dashboardUrl) {
        void chrome.tabs.create({ url: session.dashboardUrl });
      }
    } catch {
      /* ignore */
    }
  };

  const handleCancel = () => {
    void chrome.storage.session.remove('activeTailorSession');
    setTailorState({ status: 'idle' });
  };

  const handleInitiate = () => {
    if (!selectedCvId) return;
    setTailorState({ status: 'initiating' });
    void chrome.runtime.sendMessage({
      action: 'initiateTailor',
      payload: {
        cvId: selectedCvId,
        jobTitle: currentJob.title,
        company: currentJob.company ?? '',
        jobDescription: currentJob.description ?? '',
        returnToUrl: currentJob.sourceUrl,
        jobLocation: currentJob.location?.trim() ? currentJob.location : undefined,
        jobType: currentJob.jobType ?? undefined,
      },
    } satisfies MessageAction);
  };

  if (tailorState.status === 'initiating') {
    return (
      <div>
        <button
          type="button"
          disabled
          style={{
            width: '100%',
            padding: 11,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${TOKENS.borderDefault}`,
            borderRadius: 8,
            fontSize: 13,
            color: TOKENS.textMuted,
            cursor: 'not-allowed',
            fontFamily: TOKENS.font,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <InlineSpinner size={14} />
          <span>Opening dashboard...</span>
        </button>
      </div>
    );
  }

  if (tailorState.status === 'in-progress') {
    return (
      <div
        style={{
          background: TOKENS.teal05,
          border: `1px solid ${TOKENS.teal15}`,
          borderRadius: 10,
          padding: 14,
          fontFamily: TOKENS.font,
        }}
      >
        <style>{`@keyframes applymate-pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: TOKENS.primary,
              animation: 'applymate-pulse-dot 1.5s ease-in-out infinite',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.primary }}>
            Tailoring in progress
          </span>
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: 'rgba(240,244,242,0.40)',
            lineHeight: 1.5,
          }}
        >
          Finish tailoring on the dashboard then come back here.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void openDashboardAgain()}
            style={{
              flex: 1,
              padding: 8,
              background: 'transparent',
              border: `1px solid ${TOKENS.teal20border}`,
              borderRadius: 8,
              fontSize: 12,
              color: 'rgba(0,201,177,0.70)',
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,201,177,0.40)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = TOKENS.teal20border;
            }}
          >
            Open dashboard again
          </button>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: `1px solid ${TOKENS.borderDefault}`,
              borderRadius: 8,
              fontSize: 12,
              color: TOKENS.textMuted,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = TOKENS.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = TOKENS.textMuted;
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (tailorState.status === 'completed') {
    return (
      <div
        style={{
          background: TOKENS.green06,
          border: `1px solid ${TOKENS.green20}`,
          borderRadius: 10,
          padding: 14,
          fontFamily: TOKENS.font,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: TOKENS.green15,
              border: `1px solid ${TOKENS.green30}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 12,
              color: TOKENS.green,
            }}
            aria-hidden
          >
            ✓
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.green }}>
            CV tailored successfully
          </span>
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: 'rgba(240,244,242,0.40)',
            lineHeight: 1.5,
          }}
        >
          Your tailored CV is ready. Use it when applying to this job.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void chrome.tabs.create({ url: CV_PROFILES_URL })}
            style={{
              flex: 1,
              padding: 8,
              background: TOKENS.green10,
              border: `1px solid ${TOKENS.green20}`,
              borderRadius: 8,
              fontSize: 12,
              color: TOKENS.green,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = TOKENS.green15;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = TOKENS.green10;
            }}
          >
            View tailored CV
          </button>
          <button
            type="button"
            onClick={() => setTailorState({ status: 'idle' })}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: `1px solid ${TOKENS.borderDefault}`,
              borderRadius: 8,
              fontSize: 12,
              color: TOKENS.textMuted,
              cursor: 'pointer',
              fontFamily: TOKENS.font,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = TOKENS.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = TOKENS.textMuted;
            }}
          >
            Tailor again
          </button>
        </div>
      </div>
    );
  }

  if (tailorState.status === 'error') {
    return (
      <div
        style={{
          borderLeft: `3px solid ${TOKENS.red}`,
          background: 'rgba(248,113,113,0.06)',
          borderRadius: '0 10px 10px 0',
          padding: 14,
          fontFamily: TOKENS.font,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: TOKENS.red }}>{tailorState.message}</p>
        <button
          type="button"
          onClick={() => setTailorState({ status: 'idle' })}
          style={{
            marginTop: 8,
            padding: 0,
            border: 'none',
            background: 'none',
            fontSize: 12,
            color: 'rgba(240,244,242,0.40)',
            cursor: 'pointer',
            fontFamily: TOKENS.font,
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleInitiate}
        style={{
          width: '100%',
          padding: 11,
          background: 'transparent',
          border: `1px solid ${TOKENS.borderDefault}`,
          borderRadius: 8,
          fontSize: 13,
          color: 'rgba(240,244,242,0.70)',
          cursor: 'pointer',
          fontFamily: TOKENS.font,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = TOKENS.borderHover;
          e.currentTarget.style.color = TOKENS.textPrimary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = TOKENS.borderDefault;
          e.currentTarget.style.color = 'rgba(240,244,242,0.70)';
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1px solid ${TOKENS.borderHover}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            flexShrink: 0,
          }}
          aria-hidden
        >
          →
        </span>
        Tailor CV to this job
      </button>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          color: TOKENS.textDisabled,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Opens the dashboard. You&apos;ll be redirected back after tailoring.
      </p>
    </div>
  );
}

export function CVTab() {
  const session = useJobSession();
  const [tailorState, setTailorState] = useState<TailorStatus>({ status: 'idle' });

  const state: CvTabState = {
    profiles: session.profiles,
    profilesLoading: session.profilesLoading,
    selectedCvId: session.selectedCvId,
    currentJob: session.currentJob,
    scoreState: session.scoreState,
    coverLetterState: session.coverLetterState,
  };

  const dispatch: Dispatch<CvTabAction> = (action) => {
    switch (action.type) {
      case 'selectCv':
        session.setSelectedCvId(action.cvId);
        break;
      case 'setScoreState':
        session.setScoreState(action.state);
        break;
      case 'setCoverLetterState':
        session.setCoverLetterState(action.state);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.session.get([
        'tailorCompleted',
        'activeTailorSession',
      ]);

      if (typeof stored.tailorCompleted === 'string') {
        try {
          const data = JSON.parse(stored.tailorCompleted) as { tailoredCvId?: string };
          if (data.tailoredCvId) {
            setTailorState({ status: 'completed', tailoredCvId: data.tailoredCvId });
          }
        } catch {
          /* ignore */
        }
        void chrome.storage.session.remove('tailorCompleted');
      } else if (typeof stored.activeTailorSession === 'string') {
        try {
          const tailorSession = JSON.parse(stored.activeTailorSession) as { sessionId?: string };
          if (tailorSession.sessionId) {
            setTailorState({ status: 'in-progress', sessionId: tailorSession.sessionId });
            void chrome.runtime.sendMessage({
              action: 'checkTailorStatus',
              sessionId: tailorSession.sessionId,
            } satisfies MessageAction);
          }
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  useEffect(() => {
    const onMessage = (message: MessageAction) => {
      if (!message || typeof message !== 'object') return;
      if (message.action === 'tailorInitiated' && 'session' in message) {
        setTailorState({
          status: 'in-progress',
          sessionId: message.session.sessionId,
        });
        return;
      }
      if (message.action === 'tailorInitiateError' && 'message' in message) {
        setTailorState({ status: 'error', message: message.message });
        return;
      }
      if (message.action === 'tailorStatusResult') {
        if (message.completed && message.tailoredCvId) {
          setTailorState({
            status: 'completed',
            tailoredCvId: message.tailoredCvId,
          });
        }
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const hasProfiles = !state.profilesLoading && state.profiles.length > 0;
  const showJobSections = hasProfiles && state.currentJob !== null && state.selectedCvId;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: TOKENS.font,
      }}
    >
      <CvSelectorSection state={state} dispatch={dispatch} />

      {!hasProfiles ? null : (
        <>
          <Divider />

          {state.currentJob === null ? <NoJobWarning /> : null}

          {showJobSections ? (
            <>
              <MatchScoreSection
                state={state}
                dispatch={dispatch}
                currentJob={state.currentJob!}
                jobAnalysisId={session.jobAnalysisId}
                dashboardUrl={session.dashboardUrl}
                hasAnalysis={Boolean(session.checkResult?.hasAnalysis)}
              />
              <Divider />
              <CoverLetterSection
                state={state}
                dispatch={dispatch}
                currentJob={state.currentJob!}
                jobAnalysisId={session.jobAnalysisId}
              />
              <Divider />
              <TailorCvSection
                currentJob={state.currentJob!}
                selectedCvId={state.selectedCvId}
                tailorState={tailorState}
                setTailorState={setTailorState}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
