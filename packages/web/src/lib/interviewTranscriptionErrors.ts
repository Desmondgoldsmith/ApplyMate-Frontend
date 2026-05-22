import axios from 'axios';

import { getApiErrorCode, getApiErrorMessage } from '@/lib/axios';

/** Backend `details.errorCode` on audio upload failures. */
export type TurnTranscriptionErrorCode =
  | 'WHISPER_DISABLED'
  | 'WHISPER_EMPTY'
  | 'WHISPER_TIMEOUT'
  | 'WHISPER_DAILY_LIMIT'
  | 'WHISPER_AUDIO_TOO_LONG'
  | 'WHISPER_ERROR'
  | 'BROWSER_FALLBACK_EMPTY'
  | 'TRANSCRIPTION_FAILED'
  | string;

export type TranscriptionFailedDetails = {
  code: string;
  message: string;
  errorCode?: TurnTranscriptionErrorCode;
  httpStatus?: number;
};

export class TranscriptionFailedError extends Error {
  readonly code: string;
  readonly errorCode?: TurnTranscriptionErrorCode;
  readonly httpStatus?: number;

  constructor(details: TranscriptionFailedDetails) {
    super(details.message);
    this.name = 'TranscriptionFailedError';
    this.code = details.code;
    this.errorCode = details.errorCode;
    this.httpStatus = details.httpStatus;
  }
}

function readNestedDetails(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const root = data as Record<string, unknown>;
  const err = root.error;
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    const e = err as Record<string, unknown>;
    const details = e.details;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      return details as Record<string, unknown>;
    }
    return e;
  }
  return root;
}

export function parseTranscriptionErrorCode(error: unknown): TurnTranscriptionErrorCode | undefined {
  if (error instanceof TranscriptionFailedError) return error.errorCode;
  if (!axios.isAxiosError(error)) return undefined;
  const details = readNestedDetails(error.response?.data);
  const fromDetails = details?.errorCode;
  if (typeof fromDetails === 'string' && fromDetails.trim()) return fromDetails.trim();
  const code = getApiErrorCode(error);
  return code ?? undefined;
}

export function isTranscriptionFailedError(error: unknown): boolean {
  if (error instanceof TranscriptionFailedError) return true;
  return getApiErrorCode(error) === 'TRANSCRIPTION_FAILED';
}

export function transcriptionErrorMessage(
  errorCode?: TurnTranscriptionErrorCode | null,
  fallback?: string,
): string {
  switch (errorCode) {
    case 'WHISPER_DISABLED':
      return 'Server transcription is off. Use device captions while speaking or type your answer.';
    case 'WHISPER_EMPTY':
      return "We couldn't hear a clear answer. Try recording again or type your answer.";
    case 'WHISPER_TIMEOUT':
      return 'Transcription timed out. Try again or type your answer.';
    case 'WHISPER_DAILY_LIMIT':
      return 'Daily transcription limit reached. Type your answer or try again tomorrow.';
    case 'WHISPER_AUDIO_TOO_LONG':
      return 'Recording is too long. Stop sooner and submit, or type your answer.';
    case 'WHISPER_ERROR':
      return 'Transcription failed. Try again or type your answer.';
    case 'BROWSER_FALLBACK_EMPTY':
      return 'Could not understand clearly. Speak a bit longer, try again, or type your answer.';
    case 'TRANSCRIPTION_FAILED':
      return "We couldn't capture audio clearly. Please retry or type your answer.";
    default:
      return (
        fallback?.trim() ||
        "We couldn't capture audio clearly. Please retry or type your answer."
      );
  }
}

export function transcriptionFailedFromUnknown(error: unknown): TranscriptionFailedError {
  if (error instanceof TranscriptionFailedError) return error;
  const errorCode = parseTranscriptionErrorCode(error);
  const apiCode = getApiErrorCode(error);
  const message = transcriptionErrorMessage(
    errorCode,
    getApiErrorMessage(error) || undefined,
  );
  return new TranscriptionFailedError({
    code: apiCode ?? 'TRANSCRIPTION_FAILED',
    message,
    errorCode,
    httpStatus: axios.isAxiosError(error) ? error.response?.status : undefined,
  });
}

export function isNoValidTranscriptError(error: unknown): boolean {
  return getApiErrorCode(error) === 'NO_VALID_TRANSCRIPT';
}

export const NO_VALID_TRANSCRIPT_USER_MESSAGE =
  'No valid transcript: record again or type your answer.';
