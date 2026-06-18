import { useJobSession } from '../context/JobSessionContext';

const TOKENS = {
  primary: '#00C9B1',
  surface: '#0F1512',
  border: 'rgba(255,255,255,0.10)',
  text: '#F0F4F2',
  textMuted: 'rgba(240,244,242,0.55)',
  font: 'Inter, system-ui, sans-serif',
} as const;

/** Prompt when user opens a new job page while another analyzed job is still pinned. */
export function PendingNewJobBanner() {
  const { pendingNewJob, switchToPendingNewJob, dismissPendingNewJob, currentJob } =
    useJobSession();

  if (!pendingNewJob) return null;

  const currentLabel = currentJob?.title?.trim() || 'your current job';
  const nextLabel = pendingNewJob.title?.trim() || 'this job';

  return (
    <div
      style={{
        marginBottom: 14,
        borderRadius: 10,
        border: `1px solid ${TOKENS.primary}40`,
        background: 'rgba(0,201,177,0.08)',
        padding: '12px 14px',
        fontFamily: TOKENS.font,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TOKENS.text }}>
        New job detected
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.55, color: TOKENS.textMuted }}>
        You still have analysis for <span style={{ color: TOKENS.text }}>{currentLabel}</span>.
        Switch to <span style={{ color: TOKENS.text }}>{nextLabel}</span> and clear the previous
        job content?
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void switchToPendingNewJob()}
          style={{
            flex: '1 1 auto',
            minWidth: 120,
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: TOKENS.primary,
            color: '#080B0A',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: TOKENS.font,
          }}
        >
          Load new job
        </button>
        <button
          type="button"
          onClick={dismissPendingNewJob}
          style={{
            flex: '1 1 auto',
            minWidth: 100,
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${TOKENS.border}`,
            background: 'transparent',
            color: TOKENS.textMuted,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: TOKENS.font,
          }}
        >
          Keep current
        </button>
      </div>
    </div>
  );
}
