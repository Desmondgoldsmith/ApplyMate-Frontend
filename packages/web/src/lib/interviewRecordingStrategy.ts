import type { RecordingStrategyResponse } from '@/lib/interview-voice-api';
import { RECORDING_MIN_VALID_BYTES } from '@/lib/interviewSpeech';

let cachedStrategy: RecordingStrategyResponse | null = null;
let fetchPromise: Promise<RecordingStrategyResponse> | null = null;

export type DetectedBrowser = 'edge' | 'chrome' | 'safari' | 'firefox' | 'unknown';

export function detectBrowser(): DetectedBrowser {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
  if (/Chrome\//.test(ua)) return 'chrome';
  return 'unknown';
}

/** Label sent as `clientBrowser` multipart field and `x-browser` header. */
export function clientBrowserLabel(): string {
  return detectBrowser();
}

export async function loadRecordingStrategy(
  fetcher: () => Promise<RecordingStrategyResponse>,
): Promise<RecordingStrategyResponse> {
  if (cachedStrategy) return cachedStrategy;
  if (!fetchPromise) {
    fetchPromise = fetcher().then((s) => {
      cachedStrategy = s;
      return s;
    });
  }
  return fetchPromise;
}

export function getCachedRecordingStrategy(): RecordingStrategyResponse | null {
  return cachedStrategy;
}

export function clearRecordingStrategyCache(): void {
  cachedStrategy = null;
  fetchPromise = null;
}

export function pickMimeTypeFromStrategy(
  strategy: RecordingStrategyResponse | null,
): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const chain = [
    strategy?.preferredMimeType,
    ...(strategy?.mimeFallbackChain ?? []),
    'audio/webm;codecs=opus',
    'video/webm',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
  ].filter(Boolean) as string[];

  for (const mime of chain) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

export function minBlobBytesFromStrategy(strategy: RecordingStrategyResponse | null): number {
  return strategy?.minBlobBytes ?? RECORDING_MIN_VALID_BYTES;
}

export function audioUploadFilename(mime: string): string {
  if (mime.includes('mp4')) return 'answer.m4a';
  if (mime.includes('ogg')) return 'answer.ogg';
  if (mime.includes('wav')) return 'answer.wav';
  return 'answer.webm';
}
