import type {
  CoachingSnapshot,
  NextQuestionPayload,
  TurnAnswerResponse,
} from '@/lib/interview-prep-types';

export type TurnCoachingUiState = {
  loading: boolean;
  partial: boolean;
  data: CoachingSnapshot | null;
};

export const EMPTY_COACHING_UI_STATE: TurnCoachingUiState = {
  loading: false,
  partial: false,
  data: null,
};

/** Strip echoed question text from improved-answer copy. */
export function sanitizeImprovedAnswer(
  text: string,
  questionText?: string,
): string {
  let out = text.trim();
  if (!out) return '';

  const q = (questionText ?? '').trim();
  if (q.length > 12) {
    const lower = out.toLowerCase();
    const qLower = q.toLowerCase();
    if (lower.startsWith(qLower) || lower.includes(`based on the question`)) {
      out = out.slice(q.length).trim().replace(/^[:\-–—]\s*/, '');
    }
  }

  out = out
    .replace(/^based on (the )?question[^.]*\.?\s*/i, '')
    .replace(/^regarding (the )?question[^.]*\.?\s*/i, '')
    .trim();

  return out;
}

export function displayImprovedAnswer(
  snapshot: CoachingSnapshot,
  questionText?: string,
): string {
  const raw =
    snapshot.improvedAnswerSafe?.trim() ||
    snapshot.improvedAnswer?.trim() ||
    '';
  return sanitizeImprovedAnswer(raw, questionText);
}

export function coachingSnapshotFromResponse(
  response: TurnAnswerResponse | null | undefined,
): CoachingSnapshot | null {
  if (!response?.coachingSnapshot) return null;
  return response.coachingSnapshot;
}

export function followUpItemsFromSnapshot(
  snapshot: CoachingSnapshot | null,
  legacyFollowUp: TurnAnswerResponse['followUp'],
  nextHint?: string,
): Array<{ question: string; reason: string }> {
  const items: Array<{ question: string; reason: string }> = [];
  const hint = nextHint?.trim() || snapshot?.nextHint?.trim() || '';

  for (const q of snapshot?.followUpQuestions ?? []) {
    const question = q.trim();
    if (!question || items.some((i) => i.question === question)) continue;
    items.push({
      question,
      reason: hint || 'Helps the interviewer understand your answer better.',
    });
    if (items.length >= 2) break;
  }

  if (items.length < 2 && legacyFollowUp?.question?.trim()) {
    items.push({
      question: legacyFollowUp.question.trim(),
      reason: hint || 'Follow-up on what you shared.',
    });
  }

  return items.slice(0, 2);
}

export function shouldPreferFollowUpNext(
  nextQuestion: NextQuestionPayload | null | undefined,
): boolean {
  return nextQuestion?.source === 'follow_up';
}

export function beginCoachingUiState(): TurnCoachingUiState {
  return { loading: true, partial: false, data: null };
}

export function partialCoachingUiState(): TurnCoachingUiState {
  return { loading: true, partial: true, data: null };
}

export function readyCoachingUiState(data: CoachingSnapshot): TurnCoachingUiState {
  return { loading: false, partial: false, data };
}
