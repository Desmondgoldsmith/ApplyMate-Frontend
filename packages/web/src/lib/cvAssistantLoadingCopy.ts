/** In-progress copy for CV assistant and suggestion AI actions (handoff checklist A). */
export const CV_ASSISTANT_GENERATING_MESSAGE = 'Generating changes…';
export const CV_ASSISTANT_APPLYING_FIXES_MESSAGE = 'Applying fixes…';
export const CV_ASSISTANT_VALIDATING_MESSAGE = 'Validating changes…';

export const CV_SUGGESTION_APPLYING_MESSAGE = 'Applying suggestion…';

export const CV_SUGGESTION_ACCEPT_ALL_MESSAGES = [
  'Applying all suggestions…',
  'Validating each suggestion…',
  'Updating your suggestions list…',
] as const;

/** @deprecated Use {@link CV_SUGGESTION_APPLYING_MESSAGE} */
export const CV_SUGGESTION_APPLY_WITH_AI_MESSAGES = [
  CV_SUGGESTION_APPLYING_MESSAGE,
  'Generating fact-based improvements…',
  'Preparing preview…',
] as const;

export type CvAssistantBusyStage =
  | 'generating'
  | 'applying'
  | 'validating'
  | null;

export function cvAssistantBusyMessage(stage: CvAssistantBusyStage): string | null {
  switch (stage) {
    case 'generating':
      return CV_ASSISTANT_GENERATING_MESSAGE;
    case 'applying':
      return CV_ASSISTANT_APPLYING_FIXES_MESSAGE;
    case 'validating':
      return CV_ASSISTANT_VALIDATING_MESSAGE;
    default:
      return null;
  }
}
