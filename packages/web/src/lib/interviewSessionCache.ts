import type { CoachInsight, SimulationState, TurnAnswerResponse } from '@/lib/interview-prep-types';
import type { SessionAdaptiveSnapshot } from '@/lib/interviewAdaptive';
import type { InterviewSession } from '@/lib/api';
import { resolveCoachInsightFromResponse } from '@/lib/interviewCoachInsight';

const MAX_COACHING_ENTRIES = 200;
const MAX_SESSIONS = 32;

type CoachingEntry = {
  insight: CoachInsight;
  response: TurnAnswerResponse;
  cachedAt: number;
};

type SessionBundle = {
  session?: InterviewSession;
  adaptive?: SessionAdaptiveSnapshot;
  simulation?: SimulationState;
  coaching: Map<string, CoachingEntry>;
  lastGoodAt: number;
};

const sessions = new Map<string, SessionBundle>();

function touchSession(sessionId: string): SessionBundle {
  let bundle = sessions.get(sessionId);
  if (!bundle) {
    bundle = { coaching: new Map(), lastGoodAt: Date.now() };
    sessions.set(sessionId, bundle);
    if (sessions.size > MAX_SESSIONS) {
      const oldest = [...sessions.entries()].sort((a, b) => a[1].lastGoodAt - b[1].lastGoodAt)[0];
      if (oldest) sessions.delete(oldest[0]);
    }
  }
  bundle.lastGoodAt = Date.now();
  return bundle;
}

export function interviewCacheKey(sessionId: string, turnId: string): string {
  return `${sessionId}:${turnId}`;
}

export function getCachedCoaching(
  sessionId: string,
  turnId: string,
): CoachInsight | null {
  return sessions.get(sessionId)?.coaching.get(turnId)?.insight ?? null;
}

export function getCachedTurnResponse(
  sessionId: string,
  turnId: string,
): TurnAnswerResponse | null {
  return sessions.get(sessionId)?.coaching.get(turnId)?.response ?? null;
}

export function setCachedTurnResponse(sessionId: string, response: TurnAnswerResponse): void {
  const turnId = response.turn?.id;
  if (!turnId) return;
  const bundle = touchSession(sessionId);
  const insight = resolveCoachInsightFromResponse(response);
  if (!insight) return;

  bundle.coaching.set(turnId, {
    insight,
    response,
    cachedAt: Date.now(),
  });

  if (bundle.coaching.size > MAX_COACHING_ENTRIES) {
    const first = bundle.coaching.keys().next().value;
    if (first) bundle.coaching.delete(first);
  }
}

export function setCachedSession(sessionId: string, session: InterviewSession): void {
  const bundle = touchSession(sessionId);
  bundle.session = session;
}

export function getCachedSession(sessionId: string): InterviewSession | undefined {
  return sessions.get(sessionId)?.session;
}

export function setCachedAdaptive(
  sessionId: string,
  snapshot: SessionAdaptiveSnapshot,
): void {
  const bundle = touchSession(sessionId);
  bundle.adaptive = snapshot;
}

export function getCachedAdaptive(
  sessionId: string,
): SessionAdaptiveSnapshot | undefined {
  return sessions.get(sessionId)?.adaptive;
}

export function setCachedSimulation(
  sessionId: string,
  state: SimulationState,
): void {
  const bundle = touchSession(sessionId);
  bundle.simulation = state;
}

export function getCachedSimulation(sessionId: string): SimulationState | undefined {
  return sessions.get(sessionId)?.simulation;
}

export function clearInterviewSessionCache(sessionId: string): void {
  sessions.delete(sessionId);
}
