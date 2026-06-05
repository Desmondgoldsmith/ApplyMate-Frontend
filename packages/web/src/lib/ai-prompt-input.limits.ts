/**
 * Mirrors backend `src/common/ai/ai-prompt-input.limits.ts`.
 * Backend sanitises and truncates again; these caps align client UX with server limits.
 */
export const AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS = 12_000;

/** Per CV section excerpt embedded in an LLM prompt (summary, bullet batch, etc.). */
export const AI_PROMPT_INPUT_CV_SECTION_MAX_CHARS = 2_000;
