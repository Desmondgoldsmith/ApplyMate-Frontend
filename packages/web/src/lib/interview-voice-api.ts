import axios from 'axios';

import { axiosClient, getApiErrorCode, getApiErrorMessage, throwIfApiFailureResponse } from '@/lib/axios';
import {
  TranscriptionFailedError,
  transcriptionErrorMessage,
  transcriptionFailedFromUnknown,
} from '@/lib/interviewTranscriptionErrors';
import { clientBrowserLabel, detectBrowser } from '@/lib/interviewRecordingStrategy';
import { decodeInterviewSpeechBase64 } from '@/lib/interviewVoicePlayback';

export type TurnAudioTranscriptionSource = 'whisper' | 'browser' | 'fallback';

export type TurnAudioTranscriptionResult = {
  transcript: string;
  source: TurnAudioTranscriptionSource;
  durationMs?: number;
  latencyMs?: number;
  confidence?: number;
  cacheHit?: boolean;
  fallbackRequired: boolean;
  errorCode?: string;
  reason?: string;
  audioMeta?: {
    size?: number;
    mime?: string;
    originalMime?: string;
    normalizedMime?: string;
    estimatedQualityScore?: number;
    durationEstimate?: number;
  };
};

export type InterviewerSpeechResult = {
  audioBase64: string;
  contentType: string;
  voiceId: string;
  cacheHit: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export type SynthesizeInterviewerSpeechResponse = {
  data: InterviewerSpeechResult;
  requestId: string | null;
};

export type RecordingStrategyResponse = {
  strategy: 'mediarecorder' | 'native-audio' | 'hybrid-fallback';
  browser: 'chrome' | 'edge' | 'firefox' | 'safari' | 'ios' | 'unknown';
  preferredMimeType: string;
  mimeFallbackChain: string[];
  minBlobBytes: number;
  flushBeforeStop: boolean;
  clientChecklist: string[];
};

function unwrapVoiceData<T>(raw: unknown): T {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.success === false) throw new Error(String(o.error ?? 'Request failed'));
    if ('data' in o && o.data !== undefined) return o.data as T;
  }
  return raw as T;
}

function unwrapSpeechEnvelope(raw: unknown): SynthesizeInterviewerSpeechResponse {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.success === false) {
      throw new Error(String(o.error ?? 'Request failed'));
    }
    const requestId = typeof o.requestId === 'string' ? o.requestId : null;
    if ('data' in o && o.data !== undefined) {
      return { data: o.data as InterviewerSpeechResult, requestId };
    }
    return { data: raw as InterviewerSpeechResult, requestId };
  }
  return { data: raw as InterviewerSpeechResult, requestId: null };
}

function isRetryableTranscriptionHttpStatus(status: number | undefined): boolean {
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
}

export const interviewVoiceApi = {
  getRecordingStrategy: async (): Promise<RecordingStrategyResponse> => {
    const res = await axiosClient.get<unknown>('/audio/recording-strategy');
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapVoiceData<RecordingStrategyResponse>(res.data);
  },

  transcribeTurnAudio: async (
    sessionId: string,
    turnId: string,
    file: Blob,
    browserFallbackTranscript?: string,
    meta?: { clientBrowser?: string; recordingStrategy?: string },
  ): Promise<TurnAudioTranscriptionResult> => {
    const form = new FormData();
    const mime = file.type || 'audio/webm';
    const ext = mime.includes('mp4')
      ? 'm4a'
      : mime.includes('ogg')
        ? 'ogg'
        : mime.includes('wav')
          ? 'wav'
          : 'webm';
    form.append('file', file, `answer.${ext}`);
    form.append('browserFallbackTranscript', (browserFallbackTranscript ?? '').trim());
    const browser = meta?.clientBrowser ?? clientBrowserLabel();
    form.append('clientBrowser', browser);
    if (meta?.recordingStrategy) form.append('recordingStrategy', meta.recordingStrategy);

    try {
      const res = await axiosClient.post<unknown>(
        `/interviews/${sessionId}/turns/${turnId}/audio`,
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'x-browser': detectBrowser(),
          },
        },
      );
      throwIfApiFailureResponse(res.data, res.status);
      const data = unwrapVoiceData<TurnAudioTranscriptionResult>(res.data);

      const rawSource = String(data.source ?? '');
      const transcript = data.transcript?.trim() ?? '';

      if (rawSource === 'fallback' || !transcript) {
        throw new TranscriptionFailedError({
          code: 'TRANSCRIPTION_FAILED',
          message: transcriptionErrorMessage(
            data.errorCode ?? 'BROWSER_FALLBACK_EMPTY',
            data.reason ? `Transcription failed (${data.reason}).` : undefined,
          ),
          errorCode: data.errorCode ?? 'BROWSER_FALLBACK_EMPTY',
          httpStatus: res.status,
        });
      }

      const source: TurnAudioTranscriptionSource =
        rawSource === 'whisper'
          ? 'whisper'
          : rawSource === 'browser' || rawSource === 'browser_stt_fallback'
            ? 'browser'
            : 'browser';

      return {
        ...data,
        transcript,
        source,
        fallbackRequired: Boolean(data.fallbackRequired),
      };
    } catch (err) {
      if (err instanceof TranscriptionFailedError) throw err;
      const code = getApiErrorCode(err);
      if (code === 'TRANSCRIPTION_FAILED' || (axios.isAxiosError(err) && err.response?.status === 400)) {
        throw transcriptionFailedFromUnknown(err);
      }
      throw err;
    }
  },

  transcribeTurnAudioWithRetry: async (
    sessionId: string,
    turnId: string,
    file: Blob,
    browserFallbackTranscript: string,
    maxRetries = 1,
    meta?: { clientBrowser?: string; recordingStrategy?: string },
  ): Promise<TurnAudioTranscriptionResult> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await interviewVoiceApi.transcribeTurnAudio(
          sessionId,
          turnId,
          file,
          browserFallbackTranscript,
          meta,
        );
      } catch (err) {
        lastError = err;
        if (err instanceof TranscriptionFailedError) throw err;
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (!isRetryableTranscriptionHttpStatus(status) || attempt >= maxRetries) {
          throw err;
        }
      }
    }
    throw lastError ?? new Error('Transcription failed');
  },

  /**
   * Phase 2 interviewer TTS — `POST /api/interviews/:sessionId/speech`.
   * Always invoked by the client when interviewer audio should play.
   */
  synthesizeInterviewerSpeech: async (
    sessionId: string,
    body: {
      text: string;
      interviewPersona?: string;
      speakingSpeed?: number;
    },
  ): Promise<SynthesizeInterviewerSpeechResponse> => {
    const res = await axiosClient.post<unknown>(`/interviews/${sessionId}/speech`, {
      text: body.text.trim(),
      interviewPersona: body.interviewPersona,
      speakingSpeed: body.speakingSpeed,
    });
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapSpeechEnvelope(res.data);
  },

  /** @deprecated Use synthesizeInterviewerSpeech */
  getInterviewerSpeech: async (
    sessionId: string,
    body: {
      text: string;
      interviewPersona?: string;
      speakingSpeed?: number;
    },
  ): Promise<InterviewerSpeechResult> => {
    const { data } = await interviewVoiceApi.synthesizeInterviewerSpeech(sessionId, body);
    return data;
  },

  decodeSpeechBlob: decodeInterviewSpeechBase64,
};
