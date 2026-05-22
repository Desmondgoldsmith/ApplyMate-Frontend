import type { SuggestedFollowUp } from '@/lib/interview-prep-types';

/** Normalize legacy string[] or new object[] from API. */
export function normalizeSuggestedFollowUps(
  raw: SuggestedFollowUp[] | string[] | undefined,
): SuggestedFollowUp[] {
  if (!raw?.length) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const questionText = item.trim();
        if (!questionText) return null;
        return {
          questionText,
          practiceOnly: true,
          contextLabel: 'Optional practice',
        } satisfies SuggestedFollowUp;
      }
      const questionText = item.questionText?.trim();
      if (!questionText) return null;
      return {
        questionText,
        practiceOnly: item.practiceOnly ?? true,
        parentQuestionText: item.parentQuestionText?.trim(),
        contextLabel: item.contextLabel?.trim() || 'Optional practice',
      } satisfies SuggestedFollowUp;
    })
    .filter((x): x is SuggestedFollowUp => Boolean(x));
}
