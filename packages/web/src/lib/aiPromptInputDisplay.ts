import { AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS } from '@/lib/ai-prompt-input.limits';

export function isJobDescriptionOverAiLimit(length: number): boolean {
  return length > AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS;
}

export function formatJobDescriptionCharCount(length: number): string {
  const maxLabel = AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS.toLocaleString();
  const lenLabel = length.toLocaleString();
  if (length >= AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS) {
    return `${lenLabel} / ${maxLabel} characters — at limit`;
  }
  if (length >= AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS * 0.85) {
    return `${lenLabel} / ${maxLabel} characters`;
  }
  return `${lenLabel} characters`;
}
