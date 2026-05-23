import type { SuggestedFollowUp } from '@/lib/interview-prep-types';

/** Normalize legacy string[] or new object[] from API. */
export function normalizeSuggestedFollowUps(
  raw: SuggestedFollowUp[] | string[] | undefined,
): SuggestedFollowUp[] {
  if (!raw?.length) return [];
  const out: SuggestedFollowUp[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const questionText = item.trim();
      if (!questionText) continue;
      out.push({
        questionText,
        practiceOnly: true,
        contextLabel: 'Optional practice',
      });
      continue;
    }
    const questionText = item.questionText?.trim();
    if (!questionText) continue;
    out.push({
      questionText,
      practiceOnly: item.practiceOnly ?? true,
      parentQuestionText: item.parentQuestionText?.trim(),
      contextLabel: item.contextLabel?.trim() || 'Optional practice',
    });
  }
  return out;
}
