/** Interview voice / STT shared constants and helpers (Phase 1). */

export type AnswerSource = 'typed' | 'browser_stt' | 'whisper' | 'manual';

export type SpeechErrorCode =
  | 'not-allowed'
  | 'audio-capture'
  | 'network'
  | 'no-speech'
  | 'aborted'
  | 'service-not-allowed'
  | 'speech-recognition-error'
  | string;

export type SpeechError = {
  code: SpeechErrorCode;
  message: string;
  recoverable: boolean;
};

export type VoiceHealth = 'good' | 'unstable' | 'fallback';

export type VoiceUiStatus =
  | 'listening'
  | 'paused_tts'
  | 'fallback'
  | 'manual'
  | 'idle'
  | 'speech_processing'
  | 'speech_failed'
  | 'whisper_processing'
  | 'enhancing_audio';

/** User-visible speech capture outcome after stop. */
export type TranscriptionState = 'idle' | 'processing' | 'success' | 'failed';

export type HybridTranscriptSource = 'whisper' | 'browser' | 'manual';

export type HybridTranscript = {
  text: string;
  source: HybridTranscriptSource;
  confidence?: number;
  fallbackRequired?: boolean;
  whisperErrorCode?: string;
};

export type HybridStopResult =
  | {
      status: 'ok';
      transcript: HybridTranscript;
      turnId: string | null;
      epoch: number;
    }
  | {
      status: 'failed';
      message: string;
      errorCode?: string;
      turnId: string | null;
      epoch: number;
    }
  | {
      status: 'browser_only';
      transcript: HybridTranscript;
      turnId: string | null;
      epoch: number;
    };

export type VoiceProcessingStatus =
  | 'idle'
  | 'recording'
  | 'whisper'
  | 'enhancing'
  | 'generating_voice';

export const TURN_ANSWER_MIN_CHARS = 10;
export const TURN_ANSWER_MAX_CHARS = 8000;

export const STT_TRANSCRIPT_DEBOUNCE_MS = 200;
export const STT_AFTER_TTS_DELAY_EDGE_MS = 450;
export const STT_AFTER_TTS_DELAY_DEFAULT_MS = 180;
export const STT_RESTART_DELAY_EDGE_MS = 320;
export const STT_RESTART_DELAY_DEFAULT_MS = 120;
export const STT_MAX_CONSECUTIVE_FAILURES = 2;

export const INTERVIEW_THINKING_DELAY_MS = 650;
export const INTERVIEW_NEXT_QUESTION_PAUSE_MS = 420;
export const INTERVIEW_QUESTION_SPEAK_PAUSE_MS = 380;
/** Retry only transient network/server errors — not 400 TRANSCRIPTION_FAILED. */
export const WHISPER_UPLOAD_MAX_RETRIES = 1;

/** Minimum blob size before Whisper upload (backend Phase A default 1200). */
export const MIN_AUDIO_UPLOAD_BYTES = 1200;

/** Client-side minimum captured audio before treating blob as valid. */
export const RECORDING_MIN_VALID_BYTES = 1200;

/** Voice capture lifecycle — aligns with Phase A backend handoff. */
export type RecordingState =
  | 'idle'
  | 'arming'
  | 'recording'
  | 'finalizing'
  | 'transcribing'
  | 'ready'
  | 'failed';

export type AudioRecorderStopResult =
  | { ok: true; blob: Blob }
  | {
      ok: false;
      error: 'EMPTY_RECORDING' | 'STOP_FAILED';
      fallbackToSTT: boolean;
      message?: string;
    };

/** Wait after getUserMedia before MediaRecorder.start (Edge permission timing). */
export const MIC_WARMUP_BEFORE_RECORD_MS = 300;

export const RECORDING_TIMESLICE_MS = 250;

export const RECORDING_REQUEST_DATA_INTERVAL_MS = 500;

/** Safari/Edge: flush pending chunks before stop(). */
export const RECORDING_FLUSH_BEFORE_STOP_MS = 80;

export const RECORDING_STOP_FINALIZE_MS = 500;

export const RECORDING_STOP_FINALIZE_EDGE_MS = 800;

export function collapseSpeechTranscript(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Edge: wait after TTS before priming microphone. */
export const STT_EDGE_SILENCE_BEFORE_RECORD_MS = 400;

export function isEdgeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Edg\//.test(navigator.userAgent);
}

export function sttDelayAfterTts(): number {
  return isEdgeBrowser() ? STT_AFTER_TTS_DELAY_EDGE_MS : STT_AFTER_TTS_DELAY_DEFAULT_MS;
}

export function sttRecognitionRestartDelay(): number {
  return isEdgeBrowser() ? STT_RESTART_DELAY_EDGE_MS : STT_RESTART_DELAY_DEFAULT_MS;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function isTurnAnswerLongEnough(text: string): boolean {
  return text.replace(/\s+/g, ' ').trim().length >= TURN_ANSWER_MIN_CHARS;
}

export function isBenignRecognitionError(code: string): boolean {
  return code === 'aborted';
}

export function isNoSpeechError(code: string): boolean {
  return code === 'no-speech';
}

export function shouldFallbackToManual(code: string): boolean {
  return code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture';
}

export function shouldRetryStt(code: string): boolean {
  return code === 'no-speech' || code === 'network';
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. You can type your answer instead.';
    case 'audio-capture':
      return 'We could not access your microphone. Switching to typing mode.';
    case 'network':
      return 'Voice recognition lost connection. Retrying…';
    case 'no-speech':
      return 'No speech detected — still listening.';
    default:
      return 'Voice input had a problem. You can keep speaking or type your answer.';
  }
}

export function resolveAnswerSource(options: {
  inputMode: 'voice' | 'type';
  usedBrowserStt: boolean;
  usedWhisper: boolean;
  userEditedTranscript: boolean;
  fellBackToManual: boolean;
}): AnswerSource {
  if (options.inputMode === 'type' && !options.usedBrowserStt && !options.usedWhisper) {
    return 'typed';
  }
  if (options.fellBackToManual || options.userEditedTranscript) return 'manual';
  if (options.usedWhisper) return 'whisper';
  if (options.usedBrowserStt) return 'browser_stt';
  return 'typed';
}

export function mapApiTranscriptionSource(
  source: 'whisper' | 'browser' | 'browser_stt_fallback' | 'fallback' | 'failed',
): HybridTranscriptSource {
  if (source === 'whisper') return 'whisper';
  return 'browser';
}

export const SPEECH_PROCESSING_LABEL = 'Transcribing your answer…';
export const SPEECH_FAILED_LABEL =
  'Could not understand clearly. Try again or type.';
export const ANSWER_RECEIVED_LABEL = 'Answer received';
export const ANALYZING_RESPONSE_LABEL = 'Preparing next question…';
