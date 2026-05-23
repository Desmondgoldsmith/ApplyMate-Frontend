'use client';

import { memo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

import { CoachingInsightSkeleton } from '@/components/interview/coaching/CoachingInsightSkeleton';
import { VoiceCaptureStatus } from '@/components/interview/VoiceCaptureStatus';
import { VoiceHealthIndicator } from '@/components/interview/VoiceHealthIndicator';
import { VoiceProcessingBanner } from '@/components/interview/VoiceProcessingBanner';
import { useInterviewVoiceTranscript } from '@/contexts/InterviewVoiceContext';
import {
  isTurnAnswerLongEnough,
  type VoiceProcessingStatus,
} from '@/lib/interviewSpeech';
import { cn } from '@/lib/utils';
import type { InterviewPhase } from './sessionTypes';

export type AnswerPanelProps = {
  phase: InterviewPhase;
  inIntroSelf: boolean;
  typedAnswer: string;
  onTypedAnswerChange: (value: string) => void;
  answerPipelineLabel: string | null;
  showSubmitSkeleton: boolean;
  interviewerThinking: boolean;
  submitTurnPending: boolean;
  answerPipelineStatus: 'idle' | 'submitting' | 'received' | 'analyzing';
  onSubmit: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  voiceProcessingStatus: VoiceProcessingStatus;
  interviewerAudioBusy: boolean;
};

export const AnswerPanel = memo(function AnswerPanel({
  phase,
  inIntroSelf,
  typedAnswer,
  onTypedAnswerChange,
  answerPipelineLabel,
  showSubmitSkeleton,
  interviewerThinking,
  submitTurnPending,
  answerPipelineStatus,
  onSubmit,
  isMuted,
  onToggleMute,
  voiceProcessingStatus,
  interviewerAudioBusy,
}: AnswerPanelProps) {
  const voice = useInterviewVoiceTranscript();
  const {
    stop: stopVoiceCapture,
    isListening,
    recordingState,
    transcriptionState,
    transcriptionMessage,
    usedDeviceCaptions,
    isTranscriptReady,
    retryCapture,
    speechApisReady,
    isSupported: isSpeechRecognitionSupported,
  } = voice;

  const isArmingMic = recordingState === 'arming';
  const isActivelyRecording = recordingState === 'recording';
  const isFinalizingCapture = recordingState === 'finalizing';
  const isProcessingCapture =
    recordingState === 'transcribing' || transcriptionState === 'processing';
  const voiceProcessing =
    voice.isTranscribing || isProcessingCapture
      ? ('whisper' as const)
      : isArmingMic || isFinalizingCapture
        ? ('recording' as const)
        : voiceProcessingStatus;

  const effectiveAnswer =
    voice.inputMode === 'voice' ? voice.transcript : typedAnswer;

  if (phase === 'answer_feedback') {
    return null;
  }

  return (
    <>
      {!speechApisReady ? (
        <p className="text-xs text-white/40">Checking voice support…</p>
      ) : isSpeechRecognitionSupported && !voice.fellBackToManual ? (
        <div className="ip-voice-toggle mx-5 mt-1">
          <button
            type="button"
            onClick={() => {
              if (voice.inputMode === 'voice') return;
              voice.setInputMode('voice');
            }}
            className={cn(
              'ip-voice-tab',
              voice.inputMode === 'voice' && 'ip-voice-tab-active',
            )}
          >
            Voice
          </button>
          <button
            type="button"
            onClick={() => {
              if (voice.inputMode === 'type') return;
              if (voice.isRecording || isListening) {
                stopVoiceCapture();
              }
              if (voice.transcript.trim()) {
                onTypedAnswerChange(
                  typedAnswer.trim()
                    ? `${typedAnswer.trim()} ${voice.transcript.trim()}`
                    : voice.transcript.trim(),
                );
              }
              voice.setInputMode('type');
            }}
            className={cn(
              'ip-voice-tab',
              voice.inputMode === 'type' && 'ip-voice-tab-active',
            )}
          >
            Type
          </button>
        </div>
      ) : (
        <p className="px-5 text-xs text-white/40">
          {voice.fellBackToManual
            ? 'Voice had trouble — type your answer below.'
            : 'Voice input is not supported in this browser. Type your answer below.'}
        </p>
      )}

      {answerPipelineLabel && (phase === 'answering' || interviewerThinking) ? (
        <p
          className="mx-5 mt-2 text-xs font-medium text-[var(--text-teal)]"
          role="status"
          aria-live="polite"
        >
          {answerPipelineLabel}
        </p>
      ) : null}

      {showSubmitSkeleton ? (
        <div className="mx-5 mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <CoachingInsightSkeleton />
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 px-5 pb-2">
        {speechApisReady &&
        voice.inputMode === 'voice' &&
        isSpeechRecognitionSupported &&
        !voice.fellBackToManual ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <VoiceHealthIndicator health={voice.voiceHealth} />
              <VoiceCaptureStatus
                status={voice.uiStatus}
                recordingState={recordingState}
                isRecording={voice.isRecording}
              />
            </div>
            {isArmingMic || isFinalizingCapture || isProcessingCapture ? (
              <div
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2.5"
                aria-busy="true"
              >
                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--bg-surface-1)]" />
                <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-[var(--bg-surface-1)]" />
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  {isArmingMic
                    ? 'Preparing mic…'
                    : isFinalizingCapture
                      ? 'Saving…'
                      : (transcriptionMessage ?? 'Transcribing…')}
                </p>
              </div>
            ) : null}
            {transcriptionState === 'processing' &&
            transcriptionMessage &&
            !isArmingMic &&
            !isFinalizingCapture ? (
              <p
                className="text-xs font-medium text-[var(--text-teal)]"
                role="status"
                aria-live="polite"
              >
                {transcriptionMessage}
              </p>
            ) : null}
            {transcriptionState === 'failed' ? (
              <div
                className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2.5"
                role="alert"
              >
                <p className="text-xs leading-relaxed text-amber-100">
                  {transcriptionMessage ??
                    'Could not understand clearly. Try again or type.'}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-[var(--text-teal)] underline-offset-2 hover:underline"
                  onClick={() => retryCapture()}
                >
                  Retry recording
                </button>
              </div>
            ) : null}
            {usedDeviceCaptions && transcriptionState === 'success' ? (
              <p className="text-[11px] text-amber-100/80">
                Used live captions — review before submit.
              </p>
            ) : null}
            {voice.error?.message &&
            voice.uiStatus !== 'listening' &&
            transcriptionState !== 'failed' ? (
              <p className="text-xs text-amber-200/90">{voice.error.message}</p>
            ) : null}
            <VoiceProcessingBanner status={voiceProcessing} />
            <button
              type="button"
              onClick={() => {
                if (voice.isRecording) {
                  stopVoiceCapture();
                } else {
                  void voice.start();
                }
              }}
              disabled={
                (phase !== 'answering' && !inIntroSelf) ||
                interviewerAudioBusy ||
                isArmingMic ||
                isFinalizingCapture ||
                isProcessingCapture ||
                (voice.isRecording && !isActivelyRecording)
              }
              className={cn(
                'ip-record-btn w-full max-w-full shrink-0 disabled:opacity-50',
                isActivelyRecording && 'ip-record-btn-recording',
              )}
            >
              <span className="text-lg" aria-hidden>
                {isActivelyRecording ? '⏹' : isArmingMic ? '…' : '🎤'}
              </span>
              {isActivelyRecording
                ? 'Stop listening'
                : isArmingMic
                  ? 'Preparing mic…'
                  : 'Start listening'}
            </button>
            <div className="flex min-h-0 flex-1 rounded-xl border border-white/10 bg-[#111616] p-3">
              <textarea
                value={
                  transcriptionState === 'processing'
                    ? (transcriptionMessage ?? 'Transcribing your answer…')
                    : transcriptionState === 'failed'
                      ? ''
                      : voice.transcript
                }
                readOnly={transcriptionState === 'processing'}
                onChange={(e) => voice.setTranscript(e.target.value)}
                placeholder={
                  transcriptionState === 'failed'
                    ? 'Speech failed — tap Retry recording or switch to Type.'
                    : 'Transcript appears here — edit before you submit.'
                }
                className="min-h-[100px] w-full flex-1 resize-none bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-white/30 lg:min-h-0"
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {voice.fellBackToManual ? (
              <VoiceHealthIndicator health="fallback" />
            ) : null}
            <div className="flex min-h-0 flex-1 rounded-xl border border-white/10 bg-[#111616] p-3">
              <textarea
                value={typedAnswer}
                onChange={(e) => onTypedAnswerChange(e.target.value)}
                placeholder="Type your answer here…"
                className="min-h-[120px] w-full flex-1 resize-none bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:outline-none lg:min-h-0"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-3">
        <button
          type="button"
          onClick={onToggleMute}
          className="inline-flex items-center gap-1.5 border-none bg-transparent text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          title="Mute or unmute the interviewer's voice (does not affect your microphone)"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          {isMuted ? 'Interviewer muted' : 'Interviewer audio'}
        </button>
        <button
          type="button"
          className="ip-btn-primary"
          disabled={
            submitTurnPending ||
            answerPipelineStatus === 'submitting' ||
            answerPipelineStatus === 'analyzing' ||
            !(phase === 'answering' || inIntroSelf) ||
            !isTurnAnswerLongEnough(effectiveAnswer) ||
            (voice.inputMode === 'voice' && !isTranscriptReady) ||
            isArmingMic ||
            isFinalizingCapture ||
            isProcessingCapture ||
            (voice.inputMode === 'voice' && transcriptionState === 'failed')
          }
          onClick={onSubmit}
        >
          {submitTurnPending || answerPipelineStatus === 'submitting'
            ? 'Scoring…'
            : inIntroSelf
              ? 'Begin interview'
              : 'Submit answer'}
        </button>
      </div>
    </>
  );
});
