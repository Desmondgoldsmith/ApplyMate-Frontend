'use client';

import type { RecordingState, VoiceUiStatus } from '@/lib/interviewSpeech';
import { cn } from '@/lib/utils';

const STATUS_COPY: Record<VoiceUiStatus, { emoji: string; label: string }> = {
  listening: { emoji: '🎤', label: 'Recording active' },
  paused_tts: { emoji: '⏸', label: 'Paused — interviewer speaking' },
  fallback: { emoji: '⚠', label: 'Fallback — type your answer' },
  manual: { emoji: '⌨', label: 'Manual — type your answer' },
  idle: { emoji: '🎤', label: 'Tap to speak' },
  speech_processing: { emoji: '✨', label: 'Transcribing your answer…' },
  speech_failed: { emoji: '⚠', label: 'Speech failed — retry or type' },
  whisper_processing: { emoji: '✨', label: 'Transcribing your answer…' },
  enhancing_audio: { emoji: '🔊', label: 'Enhancing audio…' },
};

const RECORDING_STATE_COPY: Record<
  Exclude<RecordingState, 'idle' | 'ready'>,
  { emoji: string; label: string }
> = {
  arming: { emoji: '🎤', label: 'Preparing mic…' },
  recording: { emoji: '🔴', label: 'Recording active' },
  finalizing: { emoji: '💾', label: 'Saving…' },
  transcribing: { emoji: '✨', label: 'Transcribing…' },
  failed: { emoji: '⚠', label: 'Recording failed — retry or type' },
};

export function VoiceCaptureStatus({
  status,
  recordingState,
  isRecording,
  className,
}: {
  status: VoiceUiStatus;
  recordingState?: RecordingState;
  isRecording?: boolean;
  className?: string;
}) {
  const fromRecordingState =
    recordingState && recordingState !== 'idle' && recordingState !== 'ready'
      ? RECORDING_STATE_COPY[recordingState]
      : recordingState === 'ready'
        ? { emoji: '✓', label: 'Transcript ready — review before submit' }
        : null;

  const copy =
    fromRecordingState ??
    (status === 'speech_processing' ||
    status === 'whisper_processing' ||
    status === 'enhancing_audio' ||
    status === 'speech_failed'
      ? STATUS_COPY[status]
      : isRecording && status === 'listening'
        ? STATUS_COPY.listening
        : STATUS_COPY[status]);

  const showPulse = recordingState === 'recording' || (isRecording && status === 'listening');

  return (
    <p
      className={cn(
        'flex items-center justify-center gap-1.5 text-center text-xs text-[var(--text-muted)]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {showPulse ? (
        <span
          className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500"
          aria-hidden
        />
      ) : (
        <span className="shrink-0" aria-hidden>
          {copy.emoji}
        </span>
      )}
      <span>{copy.label}</span>
    </p>
  );
}
