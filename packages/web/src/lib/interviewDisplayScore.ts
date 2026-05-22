import type { InterviewResult, InterviewSession } from '@/lib/api';
import { interviewResultFromPoll } from '@/lib/interviewEvaluationPoll';
import type { InterviewEvaluationPollState } from '@/lib/interviewEvaluationPoll';
import type { ProgressTrendPoint } from '@/lib/interview-prep-types';

/** Same score the interview report shows: readiness first, then overall/composite. */
export type InterviewScoreSources = {
  readinessScore?: number | null;
  overallScore?: number | null;
  compositeScore?: number | null;
};

export function resolveInterviewDisplayScore(sources: InterviewScoreSources): number | null {
  if (typeof sources.readinessScore === 'number' && Number.isFinite(sources.readinessScore)) {
    return clampScore(sources.readinessScore);
  }
  const fallback = sources.overallScore ?? sources.compositeScore;
  if (typeof fallback === 'number' && Number.isFinite(fallback)) {
    return clampScore(fallback);
  }
  return null;
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

export function scoreFromProgressTrendPoint(point: ProgressTrendPoint): number | null {
  return resolveInterviewDisplayScore({
    readinessScore: point.readinessScore,
    compositeScore: point.compositeScore,
  });
}

export function scoreFromInterviewResult(result: InterviewResult | null | undefined): number | null {
  if (!result) return null;
  return resolveInterviewDisplayScore({
    readinessScore: result.readinessScore,
    overallScore: result.overallScore,
  });
}

export function scoreFromInterviewSession(
  session: Pick<InterviewSession, 'readinessScore' | 'overallScore' | 'result'>,
): number | null {
  return resolveInterviewDisplayScore({
    readinessScore: session.readinessScore ?? session.result?.readinessScore,
    overallScore: session.overallScore ?? session.result?.overallScore,
  });
}

export function scoreFromSessionWithCachedResult(
  session: Pick<InterviewSession, 'id' | 'readinessScore' | 'overallScore' | 'result'>,
  options?: {
    progressScore?: number | null;
    cachedPoll?: InterviewEvaluationPollState | null;
  },
): number | null {
  const cachedResult = interviewResultFromPoll(options?.cachedPoll);
  return (
    scoreFromInterviewResult(cachedResult) ??
    scoreFromInterviewSession(session) ??
    (options?.progressScore != null ? clampScore(options.progressScore) : null)
  );
}

/** Align progress trend points with session/result readiness scores when available. */
export function enrichProgressTrendPoints(
  points: ProgressTrendPoint[],
  sessions: InterviewSession[],
): ProgressTrendPoint[] {
  if (!points.length) return points;
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return points.map((point) => {
    const session = byId.get(point.sessionId);
    const fromSession = session ? scoreFromInterviewSession(session) : null;
    const fromPoint = scoreFromProgressTrendPoint(point);
    const score = fromSession ?? fromPoint;
    if (score == null) return point;
    return {
      ...point,
      readinessScore: score,
      compositeScore: score,
    };
  });
}

export function averageDisplayScore(points: ProgressTrendPoint[]): number | null {
  const scores = points
    .map((p) => scoreFromProgressTrendPoint(p))
    .filter((s): s is number => s != null);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
