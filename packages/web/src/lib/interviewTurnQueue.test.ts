import { describe, expect, it } from 'vitest';

import type { InterviewTurn } from '@/lib/interview-prep-types';
import type { InterviewQuestion } from '@/lib/api';
import { buildSubmitAnswersFromTurns, isMainInterviewTurn } from '@/lib/interviewTurnQueue';

function turn(partial: Partial<InterviewTurn> & Pick<InterviewTurn, 'id' | 'questionId' | 'order'>): InterviewTurn {
  return {
    depth: 0,
    category: 'behavioral',
    questionText: 'Q',
    status: 'answered',
    answerText: 'answer',
    ...partial,
  };
}

describe('isMainInterviewTurn', () => {
  it('accepts main depth-0 turns', () => {
    expect(isMainInterviewTurn(turn({ id: '1', questionId: 'q1', order: 1 }))).toBe(true);
  });

  it('rejects follow-up depth and kind', () => {
    expect(isMainInterviewTurn(turn({ id: '2', questionId: 'q1', order: 2, depth: 1 }))).toBe(false);
    expect(
      isMainInterviewTurn(
        turn({ id: '3', questionId: 'q1', order: 2, turnKind: 'follow_up', parentTurnId: '1' }),
      ),
    ).toBe(false);
  });
});

describe('buildSubmitAnswersFromTurns', () => {
  it('includes only answered main turns', () => {
    const turns = [
      turn({ id: 't1', questionId: 'main-1', order: 1, answerText: 'A1' }),
      turn({
        id: 't2',
        questionId: 'main-1',
        order: 2,
        depth: 1,
        parentTurnId: 't1',
        turnKind: 'follow_up',
        answerText: 'follow up',
      }),
      turn({ id: 't3', questionId: 'main-2', order: 3, answerText: 'A2' }),
      turn({ id: 't4', questionId: 'main-3', order: 4, status: 'pending' }),
    ];
    const payload = buildSubmitAnswersFromTurns(turns, new Map());
    expect(payload).toHaveLength(2);
    expect(payload.map((a) => a.questionId).sort()).toEqual(['main-1', 'main-2']);
  });

  it('excludes questions marked section follow_up', () => {
    const turns = [turn({ id: 't1', questionId: 'fu-q', order: 1, answerText: 'x' })];
    const questions: InterviewQuestion[] = [
      {
        id: 'fu-q',
        order: 1,
        category: 'behavioral',
        question: 'Follow',
        section: 'follow_up',
      },
    ];
    expect(buildSubmitAnswersFromTurns(turns, new Map(), questions)).toHaveLength(0);
  });
});
