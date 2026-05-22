import type { ProcessingInsights, TurnAnswerResponse } from '@/lib/interview-prep-types';

export type ProcessingInsightsDisplay = {
  headline: string;
  description: string;
  steps: string[];
  interviewerContext?: string;
  whileYouWaitTips: string[];
};

const DEFAULT_DISPLAY: ProcessingInsightsDisplay = {
  headline: 'Analyzing your answer',
  description:
    "We're scoring your response and preparing coaching you can act on before the next question.",
  steps: [
    'Checking how clearly you answered the question',
    'Scoring structure (STAR / situation → result)',
    'Highlighting one focus area and concrete improvements',
    'Drafting an example solution for this theme',
  ],
  whileYouWaitTips: [],
};

export function resolveProcessingInsights(
  response: TurnAnswerResponse | null | undefined,
  options?: {
    coachHints?: string[];
    answeredContext?: string;
  },
): ProcessingInsightsDisplay {
  const pi: ProcessingInsights | undefined = response?.processingInsights;
  const nudges = response?.personalization?.realTimeSignals?.nudges ?? [];
  const hints = options?.coachHints?.filter((h) => h.trim()) ?? [];
  const whileYouWaitTips = [
    ...(pi?.whileYouWaitTips ?? []),
    ...nudges,
    ...hints,
  ]
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  const interviewerContext =
    pi?.interviewerContext?.trim() ||
    response?.answeredQuestion?.context?.trim() ||
    options?.answeredContext?.trim() ||
    undefined;

  if (pi?.headline?.trim()) {
    return {
      headline: pi.headline.trim(),
      description:
        pi.steps?.[0]?.trim() ||
        DEFAULT_DISPLAY.description,
      steps:
        pi.steps?.filter((s) => s.trim()).slice(0, 4) ??
        DEFAULT_DISPLAY.steps,
      interviewerContext,
      whileYouWaitTips,
    };
  }

  return {
    ...DEFAULT_DISPLAY,
    interviewerContext,
    whileYouWaitTips,
  };
}
