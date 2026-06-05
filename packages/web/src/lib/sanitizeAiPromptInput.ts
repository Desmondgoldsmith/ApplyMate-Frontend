/**
 * Client-side mirror of backend AI prompt input guards (audit 3.4).
 * Neutralises common instruction-override phrases and enforces per-field length caps
 * before user text is sent to AI-backed API routes.
 */

import {
  AI_PROMPT_INPUT_CV_SECTION_MAX_CHARS,
  AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS,
} from '@/lib/ai-prompt-input.limits';
import { CV_CHAT_INPUT_MAX_CHARS } from '@/lib/cv-chat-input.constants';

/** Instruction-override phrases — kept in sync with backend injection patterns. */
const AI_PROMPT_INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /\byou\s+are\s+now\b/gi,
  /\bsystem\s+prompt\b/gi,
  /\bas\s+an?\s+ai\b/gi,
  /\bas\s+a\s+language\s+model\b/gi,
  /reveal\s+(your\s+)?(system\s+)?prompt/gi,
  /output\s+(the\s+)?system\s+prompt/gi,
  /repeat\s+(the\s+)?(above|system)\s+instructions/gi,
  /\bnew\s+instructions\s*:/gi,
  /<\|im_start\|>/gi,
  /\[INST\]/gi,
];

const FILTERED = '[filtered]';

export type SanitizeAiPromptInputResult = {
  text: string;
  injectionReplacements: number;
  truncated: boolean;
};

function countInjectionReplacements(before: string, after: string): number {
  if (before === after) return 0;
  const filteredLen = FILTERED.length;
  let count = 0;
  let i = 0;
  while (i < after.length) {
    if (after.startsWith(FILTERED, i)) {
      count += 1;
      i += filteredLen;
      continue;
    }
    i += 1;
  }
  return count;
}

/** Replace known prompt-injection phrases with `[filtered]`. */
export function neutralizeAiPromptInjection(input: string): {
  text: string;
  injectionReplacements: number;
} {
  let text = input;
  for (const pattern of AI_PROMPT_INJECTION_PATTERNS) {
    text = text.replace(pattern, FILTERED);
  }
  return {
    text,
    injectionReplacements: countInjectionReplacements(input, text),
  };
}

export function truncateAiPromptInput(text: string, maxChars: number): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxChars), truncated: true };
}

export function sanitizeAiPromptInput(
  raw: string,
  maxChars: number,
): SanitizeAiPromptInputResult {
  const { text: neutralized, injectionReplacements } =
    neutralizeAiPromptInjection(raw);
  const { text, truncated } = truncateAiPromptInput(neutralized, maxChars);
  return { text, injectionReplacements, truncated };
}

/** Sanitise + truncate user text destined for an LLM prompt (API layer). */
export function prepareAiPromptUserText(raw: string, maxChars: number): string {
  return sanitizeAiPromptInput(raw, maxChars).text;
}

export function prepareJobDescriptionForAi(raw: string): string {
  return prepareAiPromptUserText(
    raw,
    AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS,
  );
}

export function prepareCvSectionTextForAi(raw: string): string {
  return prepareAiPromptUserText(raw, AI_PROMPT_INPUT_CV_SECTION_MAX_CHARS);
}

export function prepareCvChatTextForAi(raw: string): string {
  return prepareAiPromptUserText(raw, CV_CHAT_INPUT_MAX_CHARS);
}
