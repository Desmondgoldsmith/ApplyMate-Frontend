import type {
  LiveCoachingResponse,
  PostCoachingResponse,
  PreCoachingResponse,
} from '@/lib/interview-coaching-types';

const preCache = new Map<string, PreCoachingResponse>();
const postCache = new Map<string, PostCoachingResponse>();
const liveCache = new Map<string, LiveCoachingResponse>();

function key(sessionId: string, turnId: string, suffix = ''): string {
  return `${sessionId}:${turnId}${suffix}`;
}

export function getCachedPreCoaching(
  sessionId: string,
  turnId: string,
): PreCoachingResponse | undefined {
  return preCache.get(key(sessionId, turnId));
}

export function setCachedPreCoaching(
  sessionId: string,
  turnId: string,
  data: PreCoachingResponse,
): void {
  preCache.set(key(sessionId, turnId), data);
}

export function getCachedPostCoaching(
  sessionId: string,
  turnId: string,
): PostCoachingResponse | undefined {
  return postCache.get(key(sessionId, turnId));
}

export function setCachedPostCoaching(
  sessionId: string,
  turnId: string,
  data: PostCoachingResponse,
): void {
  postCache.set(key(sessionId, turnId), data);
}

export function getCachedLiveCoaching(
  sessionId: string,
  turnId: string,
  bufferHash: string,
): LiveCoachingResponse | undefined {
  return liveCache.get(key(sessionId, turnId, `:${bufferHash}`));
}

export function setCachedLiveCoaching(
  sessionId: string,
  turnId: string,
  bufferHash: string,
  data: LiveCoachingResponse,
): void {
  liveCache.set(key(sessionId, turnId, `:${bufferHash}`), data);
}

export function clearInterviewCoachingCache(sessionId: string): void {
  for (const k of preCache.keys()) {
    if (k.startsWith(`${sessionId}:`)) preCache.delete(k);
  }
  for (const k of postCache.keys()) {
    if (k.startsWith(`${sessionId}:`)) postCache.delete(k);
  }
  for (const k of liveCache.keys()) {
    if (k.startsWith(`${sessionId}:`)) liveCache.delete(k);
  }
}

/** Cheap fingerprint for live coaching dedupe. */
export function liveBufferFingerprint(buffer: string): string {
  const t = buffer.trim();
  if (!t) return '';
  return `${t.length}:${t.slice(-48)}`;
}
