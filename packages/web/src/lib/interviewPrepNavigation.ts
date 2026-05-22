import { normalizeSuggestedFollowUps } from '@/lib/interviewPrepSuggestedFollowUps';
import type {
  NextQuestionPayload,
  QuestionProgress,
  TurnAnswerResponse,
} from '@/lib/interview-prep-types';

export function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Next main question after skip or “Next question” (never adaptive probe copy). */
export function resolveNextPlannedNavigation(
  response: TurnAnswerResponse | null | undefined,
): NextQuestionPayload | null {
  if (!response) return null;
  if (response.nextPlannedQuestion?.questionText?.trim()) {
    return response.nextPlannedQuestion;
  }
  if (response.nextQuestion?.source === 'planned' && response.nextQuestion.questionText?.trim()) {
    return response.nextQuestion;
  }
  return null;
}

/** Optional follow-up turn (real DB turn) — user must opt in; never auto-advance on Continue. */
export function resolveOptionalNextNavigation(
  response: TurnAnswerResponse | null | undefined,
): NextQuestionPayload | null {
  if (!response) return null;
  if (response.optionalNextQuestion?.questionText?.trim()) {
    return response.optionalNextQuestion;
  }
  if (response.canCompleteInterview) return null;
  if (
    response.nextQuestion?.source === 'follow_up' &&
    response.nextQuestion.turnId &&
    response.nextQuestion.questionText?.trim()
  ) {
    return response.nextQuestion;
  }
  if (response.followUp?.turnId && response.followUp.question?.trim()) {
    return {
      turnId: response.followUp.turnId,
      questionText: response.followUp.question.trim(),
      source: 'follow_up',
      turnKind: 'follow_up',
    };
  }
  return null;
}

/** User accepted a real follow-up turn — use until answered. */
export function resolveAcceptedFollowUpNavigation(
  response: TurnAnswerResponse | null | undefined,
): NextQuestionPayload | null {
  return resolveOptionalNextNavigation(response);
}

export function resolveAnsweredQuestionText(
  response: TurnAnswerResponse | null | undefined,
): string {
  if (!response) return '';
  return (
    response.answeredQuestion?.questionText?.trim() ||
    response.coachingFeedback?.questionText?.trim() ||
    response.turn?.questionText?.trim() ||
    ''
  );
}

/** User-facing answer line — prefer polished transcript from this submit. */
export function resolveScoredAnswerText(
  response: TurnAnswerResponse | null | undefined,
): string {
  if (!response) return '';
  return (
    response.answeredQuestion?.scoredAnswerText?.trim() ||
    response.turn?.answerText?.trim() ||
    ''
  );
}

export function resolveAnsweredQuestionContext(
  response: TurnAnswerResponse | null | undefined,
): string {
  if (!response) return '';
  return response.answeredQuestion?.context?.trim() || '';
}

export function assertCoachingQuestionAlignment(
  response: TurnAnswerResponse | null | undefined,
): void {
  if (process.env.NODE_ENV === 'production') return;
  const answered = response?.answeredQuestion?.questionText;
  const coaching = response?.coachingFeedback?.questionText;
  if (!answered?.trim() || !coaching?.trim()) return;
  console.assert(
    normalizeQuestionText(coaching) === normalizeQuestionText(answered),
    'Coaching question mismatch',
    { answered, coaching },
  );
}

export type PrepNavigationResult = {
  done: boolean;
  questionText?: string;
  turnId?: string;
};

/**
 * Which turn/question to bind when user taps “Answer this” on a sample or next-question card.
 * Order: real follow_up → chip matches nextPlannedQuestion → null (display-only chip).
 */
export function resolveAnswerNavigationForChip(
  response: TurnAnswerResponse | null | undefined,
  chipText: string,
): NextQuestionPayload | null {
  const chip = chipText.trim();
  if (!chip) return null;

  const optional = resolveOptionalNextNavigation(response);
  if (
    optional?.turnId &&
    normalizeQuestionText(optional.questionText) === normalizeQuestionText(chip)
  ) {
    return optional;
  }

  const planned = resolveNextPlannedNavigation(response);
  if (
    planned?.turnId &&
    normalizeQuestionText(planned.questionText) === normalizeQuestionText(chip)
  ) {
    return planned;
  }

  return null;
}

export function textsToExcludeFromSuggestedFollowUps(
  response: TurnAnswerResponse | null | undefined,
): string[] {
  if (!response) return [];
  const out: string[] = [];
  const planned = response.nextPlannedQuestion?.questionText?.trim();
  if (planned) out.push(planned);
  const optional = response.optionalNextQuestion?.questionText?.trim();
  if (optional) out.push(optional);
  const next = response.nextQuestion?.questionText?.trim();
  if (next && response.nextQuestion?.source === 'planned' && next !== planned) {
    out.push(next);
  }
  for (const chip of normalizeSuggestedFollowUps(response.suggestedFollowUps)) {
    if (!chip.practiceOnly && chip.questionText) out.push(chip.questionText);
  }
  return out;
}

/** Label for the primary advance CTA after coaching feedback. */
export function resolvePrepContinueLabel(
  questionProgress: QuestionProgress | null | undefined,
  turnIndex: number,
  turnQueueLength: number,
): string {
  if (questionProgress && questionProgress.mainTotal > 0) {
    return questionProgress.mainPending <= 0 ? 'Finish interview' : 'Next main question';
  }
  return turnIndex + 1 >= turnQueueLength ? 'Finish interview' : 'Next question';
}

export function mainQuestionsComplete(
  questionProgress: QuestionProgress | null | undefined,
): boolean {
  return Boolean(questionProgress && questionProgress.mainTotal > 0 && questionProgress.mainPending <= 0);
}

/** Whether the user may end the session without advancing stale optional turns. */
export function canEndInterviewSession(
  questionProgress: QuestionProgress | null | undefined,
  response?: TurnAnswerResponse | null,
): boolean {
  return (
    response?.canCompleteInterview === true || mainQuestionsComplete(questionProgress)
  );
}

/** Server-reported optional follow-ups the user has already answered. */
export function optionalFollowUpsAnsweredCount(
  progress: QuestionProgress | null | undefined,
): number {
  if (!progress) return 0;
  if (
    typeof progress.optionalFollowUpAnswered === 'number' &&
    Number.isFinite(progress.optionalFollowUpAnswered)
  ) {
    return Math.max(0, Math.round(progress.optionalFollowUpAnswered));
  }
  const total = progress.optionalFollowUpTotal ?? 0;
  const pending = progress.optionalFollowUpPending ?? 0;
  return Math.max(0, total - pending);
}

export function formatMainProgressLabel(
  progress: QuestionProgress | null | undefined,
  currentMainQuestionNumber?: number | null,
  extraSidePracticeAnswered = 0,
): {
  main: string;
  optionalBadge: string | null;
} {
  if (!progress || progress.mainTotal <= 0) {
    return { main: '', optionalBadge: null };
  }
  const total = progress.mainTotal;
  const current =
    currentMainQuestionNumber != null && currentMainQuestionNumber > 0
      ? Math.min(currentMainQuestionNumber, total)
      : Math.min(progress.mainAnswered + 1, total);
  const main = `Question ${current} of ${total}`;
  const optionalAnswered =
    optionalFollowUpsAnsweredCount(progress) + Math.max(0, extraSidePracticeAnswered);
  const optionalBadge =
    optionalAnswered > 0 ? `+${optionalAnswered} optional answered` : null;
  return { main, optionalBadge };
}

export function applyTurnSyncFromResponse(
  response: TurnAnswerResponse | null | undefined,
): string | null {
  if (!response?.turnSync?.corrected) return null;
  return response.turnSync.resolvedTurnId?.trim() || null;
}

export function resolveActiveTurnIdAfterSubmit(
  response: TurnAnswerResponse | null | undefined,
  requestedTurnId: string,
): string {
  const synced = applyTurnSyncFromResponse(response);
  if (synced) return synced;
  return (
    response?.answeredQuestion?.turnId?.trim() ||
    response?.turn?.id?.trim() ||
    requestedTurnId
  );
}
