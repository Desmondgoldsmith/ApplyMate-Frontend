'use client';

import { Volume2, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { InterviewVoicePlaybackIssue } from '@/hooks/useInterviewTTS';
import { interviewVoiceDisabledMessage } from '@/lib/interviewVoicePlayback';

type InterviewVoiceBannerProps = {
  issue: InterviewVoicePlaybackIssue | null;
  onDismiss?: () => void;
  onRetryPremium?: () => void;
  onUseDeviceVoice?: () => void;
  deviceVoiceAvailable?: boolean;
};

export function InterviewVoiceBanner({
  issue,
  onDismiss,
  onRetryPremium,
  onUseDeviceVoice,
  deviceVoiceAvailable = false,
}: InterviewVoiceBannerProps) {
  if (!issue) return null;

  /** ElevenLabs unavailable — device voice is used silently; no banner. */
  if (issue.kind === 'browser_fallback') return null;

  const message =
    issue.kind === 'disabled'
      ? `${interviewVoiceDisabledMessage(issue.disabledReason)} ${
          deviceVoiceAvailable
            ? "We couldn't switch to device voice automatically."
            : 'Please read the text on screen.'
        }`
      : issue.kind === 'autoplay_blocked'
        ? 'Your browser blocked audio. Tap below to hear the interviewer.'
        : issue.message;

  return (
    <div
      className="mx-5 mb-3 rounded-[var(--radius-md)] border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium leading-snug">{message}</p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-0.5 text-sky-200/80 transition hover:text-sky-50"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {'requestId' in issue && issue.requestId ? (
        <p className="mt-1 text-xs text-amber-200/70">Reference: {issue.requestId}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetryPremium ? (
          <Button type="button" variant="ghost" className="text-xs" onClick={onRetryPremium}>
            Retry premium voice
          </Button>
        ) : null}
        {deviceVoiceAvailable && onUseDeviceVoice ? (
          <Button
            type="button"
            variant="ghost"
            className="inline-flex items-center gap-1.5 text-xs"
            onClick={onUseDeviceVoice}
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden />
            Use device voice
          </Button>
        ) : null}
      </div>
    </div>
  );
}
