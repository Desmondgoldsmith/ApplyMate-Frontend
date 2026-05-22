import type {
  CoachInsight,
  CoachInsightScore,
  DifficultyLevel,
  InterviewDimensionalProfile,
  InterviewTurn,
  NextQuestionType,
  TurnAdaptivePayload,
  TurnAnswerResponse,
} from '@/lib/interview-prep-types';
import { coachInsightDimensionScores } from '@/lib/interviewCoachInsight';

export type AdaptiveWeakAreaKey =
  | 'communication'
  | 'depth'
  | 'structure'
  | 'technical'
  | 'consistency'
  | string;

export const ADAPTIVE_WEAK_AREA_LABELS: Record<string, string> = {
  communication: 'Clarity',
  depth: 'Depth & examples',
  structure: 'Structure (STAR)',
  technical: 'Role relevance',
  consistency: 'Steady pacing',
};

export type InterviewerBehaviorMode = 'calm' | 'coaching' | 'challenging';

export type SkillEvolutionPoint = {
  turnId: string;
  clarity: number;
  structure: number;
  confidence: number;
};

export type SessionAdaptiveSnapshot = {
  profile: InterviewDimensionalProfile | null;
  session: TurnAdaptivePayload['session'] | null;
  recommendedNextTurnId: string | null;
  /** Shown briefly after turn submit (<1s). */
  transitionMessage: string | null;
};

const DIFFICULTY_LABELS: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export function difficultyDisplayLabel(
  level: DifficultyLevel | 'easy' | 'medium' | 'hard' | undefined,
): string {
  if (!level || level === 'adaptive') return 'Adaptive';
  return DIFFICULTY_LABELS[level] ?? 'Medium';
}

export function resolveAdaptiveFromResponse(
  response: TurnAnswerResponse | null | undefined,
): TurnAdaptivePayload | null {
  return response?.adaptive ?? null;
}

export function weakAreaLabel(area: string): string {
  const key = area.trim().toLowerCase();
  return ADAPTIVE_WEAK_AREA_LABELS[key] ?? area.replace(/_/g, ' ');
}

export function pickPrimaryWeakArea(weakAreas: string[] | undefined): string | null {
  const first = weakAreas?.find((w) => w?.trim());
  return first ? weakAreaLabel(first) : null;
}

export function pickImprovingArea(
  strongAreas: string[] | undefined,
  profile: InterviewDimensionalProfile | null,
): string | null {
  const fromStrong = strongAreas?.[0];
  if (fromStrong) return weakAreaLabel(fromStrong);

  if (!profile) return null;
  const scores: Array<{ key: string; value: number }> = [
    { key: 'structure', value: profile.structureScore },
    { key: 'communication', value: profile.communicationClarityScore },
    { key: 'depth', value: profile.technicalDepthScore },
    { key: 'consistency', value: profile.consistencyScore },
  ];
  const best = [...scores].sort((a, b) => b.value - a.value)[0];
  if (!best || best.value < 65) return null;
  return weakAreaLabel(best.key);
}

export function resolveInterviewerBehaviorMode(
  recommendedDifficulty: 'easy' | 'medium' | 'hard' | undefined,
  nextQuestionType: NextQuestionType | undefined,
  weakAnswer?: boolean,
): InterviewerBehaviorMode {
  if (nextQuestionType === 'stress_test' || recommendedDifficulty === 'hard') {
    return 'challenging';
  }
  if (nextQuestionType === 'easy_reset' || recommendedDifficulty === 'easy' || weakAnswer) {
    return 'coaching';
  }
  return 'calm';
}

const BEHAVIOR_COPY: Record<
  InterviewerBehaviorMode,
  { label: string; description: string }
> = {
  calm: { label: 'Calm mode', description: 'Steady pacing, standard follow-ups' },
  coaching: {
    label: 'Coaching mode',
    description: 'Extra guidance and easier follow-ups',
  },
  challenging: {
    label: 'Challenging mode',
    description: 'Deeper probes and higher expectations',
  },
};

export function interviewerBehaviorCopy(mode: InterviewerBehaviorMode) {
  return BEHAVIOR_COPY[mode];
}

export function buildAdaptiveTransitionMessage(
  adaptive: TurnAdaptivePayload | null,
  previousDifficulty: 'easy' | 'medium' | 'hard' | null,
): string | null {
  if (!adaptive?.session) return null;
  const { session } = adaptive;
  if (session.flowChanged) {
    switch (session.nextQuestionType) {
      case 'situational':
        return 'Focusing on scenario-style questions based on your last answer.';
      case 'technical':
        return 'Shifting toward role-specific questions.';
      case 'stress_test':
        return 'Adjusting difficulty — expect a tougher follow-up.';
      case 'easy_reset':
        return 'Easing pace so you can rebuild momentum.';
      case 'behavioral':
      default:
        return 'Adjusting your question mix based on how you answered.';
    }
  }
  if (
    previousDifficulty &&
    previousDifficulty !== session.recommendedDifficulty
  ) {
    if (session.recommendedDifficulty === 'easy') {
      return 'Adjusting difficulty — taking a slightly easier angle.';
    }
    if (session.recommendedDifficulty === 'hard') {
      return 'Adjusting difficulty — pushing a bit further.';
    }
  }
  return null;
}

/** Prefer backend-recommended pending turn while preserving follow-ups at front of slice. */
export function orderPendingTurns(
  pending: InterviewTurn[],
  recommendedNextTurnId: string | null | undefined,
): InterviewTurn[] {
  if (!recommendedNextTurnId || pending.length < 2) return pending;
  const idx = pending.findIndex((t) => t.id === recommendedNextTurnId);
  if (idx <= 0) return pending;
  const next = [...pending];
  const [chosen] = next.splice(idx, 1);
  return [chosen, ...next];
}

export function appendEvolutionPoint(
  history: SkillEvolutionPoint[],
  turnId: string,
  scores: CoachInsightScore,
  profile: InterviewDimensionalProfile | null,
): SkillEvolutionPoint[] {
  const confidence =
    profile?.confidenceScore ??
    Math.round((scores.clarity + scores.depth + scores.structure) / 3);
  const point: SkillEvolutionPoint = {
    turnId,
    clarity: scores.clarity,
    structure: scores.structure,
    confidence,
  };
  if (history.some((p) => p.turnId === turnId)) {
    return history.map((p) => (p.turnId === turnId ? point : p));
  }
  return [...history, point].slice(-12);
}

export function buildEvolutionFromHistory(
  history: SkillEvolutionPoint[],
): { clarity: number[]; structure: number[]; confidence: number[] } {
  return {
    clarity: history.map((p) => p.clarity),
    structure: history.map((p) => p.structure),
    confidence: history.map((p) => p.confidence),
  };
}

export type CoachingSignalLine = {
  tone: 'good' | 'warn' | 'focus';
  text: string;
};

/** Merge Phase 2 coach scores + Phase 3 weak areas into 1–3 subtle lines. */
export function buildCoachingSignalLines(
  scores: CoachInsightScore,
  weakAreas: string[] | undefined,
  strongAreas: string[] | undefined,
): CoachingSignalLine[] {
  const lines: CoachingSignalLine[] = [];
  if (scores.clarity >= 68) {
    lines.push({ tone: 'good', text: 'Good clarity' });
  } else if (scores.clarity < 55) {
    lines.push({ tone: 'warn', text: 'Needs clearer phrasing' });
  }

  if (scores.depth >= 68) {
    lines.push({ tone: 'good', text: 'Solid depth' });
  } else if (scores.depth < 55) {
    lines.push({ tone: 'warn', text: 'Needs more depth' });
  }

  const focus = pickPrimaryWeakArea(weakAreas);
  if (focus && lines.length < 3) {
    lines.push({ tone: 'focus', text: `Focus area: ${focus}` });
  }

  const improving = pickImprovingArea(strongAreas, null);
  if (improving && lines.length < 3 && scores.structure >= 60) {
    lines.push({ tone: 'good', text: `Improving in: ${improving}` });
  }

  return lines.slice(0, 3);
}

export function snapshotFromAdaptive(
  adaptive: TurnAdaptivePayload | null,
  transitionMessage: string | null,
): SessionAdaptiveSnapshot {
  if (!adaptive) {
    return {
      profile: null,
      session: null,
      recommendedNextTurnId: null,
      transitionMessage,
    };
  }
  return {
    profile: adaptive.profile,
    session: adaptive.session,
    recommendedNextTurnId: adaptive.session.recommendedNextTurnId ?? null,
    transitionMessage,
  };
}

export function evolutionPointFromTurnSubmit(
  turnId: string,
  response: TurnAnswerResponse,
): SkillEvolutionPoint | null {
  const insight = response.coachInsight;
  const scores = coachInsightDimensionScores(insight, response.scores);
  const profile = response.adaptive?.profile ?? null;
  return {
    turnId,
    clarity: scores.clarity,
    structure: scores.structure,
    confidence:
      profile?.confidenceScore ??
      Math.round((scores.clarity + scores.depth + scores.structure) / 3),
  };
}
