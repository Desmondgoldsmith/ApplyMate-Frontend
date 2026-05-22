import type {
  CoachInsight,
  CoachInsightScore,
  TurnAnswerResponse,
  TurnAnswerScores,
} from '@/lib/interview-prep-types';

export function resolveCoachInsightFromResponse(
  response: TurnAnswerResponse | null | undefined,
): CoachInsight | null {
  if (!response) return null;
  return response.coachInsight ?? response.turn?.coachInsight ?? null;
}

export function coachInsightDimensionScores(
  insight: CoachInsight | null | undefined,
  legacy?: TurnAnswerScores | null,
): CoachInsightScore {
  if (insight?.score) {
    return {
      clarity: clampScore(insight.score.clarity),
      structure: clampScore(insight.score.structure),
      relevance: clampScore(insight.score.relevance),
      depth: clampScore(insight.score.depth),
    };
  }
  const clarity = legacy?.clarityScore ?? 0;
  const structure = legacy?.structureScore ?? 0;
  const relevance = legacy?.relevanceScore ?? 0;
  return {
    clarity: clampScore(clarity),
    structure: clampScore(structure),
    relevance: clampScore(relevance),
    depth: clampScore(Math.round((clarity + structure + relevance) / 3)),
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Avoid duplicate cache writes when the same insight is re-applied. */
export function coachInsightCacheKey(insight: CoachInsight): string {
  return [
    insight.feedback,
    insight.hint,
    insight.score.clarity,
    insight.score.structure,
    insight.score.relevance,
    insight.score.depth,
    insight.weakAnswer,
    insight.followUpQuestion ?? '',
  ].join('|');
}
