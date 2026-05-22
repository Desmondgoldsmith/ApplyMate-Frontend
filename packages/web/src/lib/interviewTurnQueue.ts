import type { InterviewTurn } from '@/lib/interview-prep-types';
import type { InterviewQuestion, InterviewSession } from '@/lib/api';

/** Build ordered queue of turns still needing an answer. */
export function buildPendingTurnQueue(turns: InterviewTurn[] | undefined): InterviewTurn[] {
  if (!turns?.length) return [];
  const sorted = [...turns].sort((a, b) => a.order - b.order);
  const pending = sorted.filter((t) => t.status === 'pending');
  if (pending.length > 0) return pending;
  const unanswered = sorted.filter((t) => !t.answerText?.trim());
  if (unanswered.length > 0) return unanswered;
  return sorted.slice(0, 1);
}

export function sessionHasPrepTurns(session: InterviewSession | undefined): boolean {
  return Boolean(session?.turns && session.turns.length > 0);
}

/**
 * Text shown for a turn — prefer server `questionText` (stable per session).
 * Falls back to `questions[]` by id only when turn text is missing (legacy).
 */
export function resolveTurnQuestionText(
  turn: InterviewTurn,
  questions: InterviewQuestion[],
): string {
  if (turn.questionText?.trim()) return turn.questionText.trim();
  const match = questions.find((q) => q.id === turn.questionId);
  return match?.question?.trim() ?? 'Interview question';
}

/** Main question turn only — excludes optional follow-ups (depth > 0, follow_up kind). */
export function isMainInterviewTurn(turn: InterviewTurn): boolean {
  if ((turn.depth ?? 0) > 0) return false;
  if (turn.turnKind === 'follow_up') return false;
  if (turn.parentTurnId) return false;
  return true;
}

function followUpQuestionIds(questions: InterviewQuestion[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const q of questions ?? []) {
    const section = (q as InterviewQuestion & { section?: string }).section;
    if (section === 'follow_up') ids.add(q.id);
  }
  return ids;
}

/** Build `/interviews/:id/submit` payload — main questions only. */
export function buildSubmitAnswersFromTurns(
  turns: InterviewTurn[],
  localByQuestionId: Map<string, { answerText: string; durationSeconds: number }>,
  questions?: InterviewQuestion[],
): Array<{ questionId: string; answerText: string; durationSeconds: number }> {
  const excludedQuestionIds = followUpQuestionIds(questions);
  const mainAnswered = [...turns]
    .filter(isMainInterviewTurn)
    .filter((t) => t.status === 'answered' || t.status === 'evaluated')
    .sort((a, b) => a.order - b.order);

  const out: Array<{ questionId: string; answerText: string; durationSeconds: number }> = [];
  const seen = new Set<string>();

  for (const turn of mainAnswered) {
    const qid = turn.questionId;
    if (!qid || seen.has(qid) || excludedQuestionIds.has(qid)) continue;
    const text = turn.answerText?.trim() ?? localByQuestionId.get(qid)?.answerText?.trim() ?? '';
    if (!text) continue;
    seen.add(qid);
    out.push({
      questionId: qid,
      answerText: text,
      durationSeconds: turn.durationSeconds ?? localByQuestionId.get(qid)?.durationSeconds ?? 30,
    });
  }

  return out;
}

export function speakingSpeedStorageKey(sessionId: string): string {
  return `applymate:interview:speakingSpeed:${sessionId}`;
}
