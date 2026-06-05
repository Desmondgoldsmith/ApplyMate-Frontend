import { CV_CHAT_INPUT_MAX_CHARS } from '@/lib/cv-chat-input.constants';

export const CV_CHAT_PASTE_HINT =
  "You can paste your entire CV here — we'll only ask about what's missing.";

export function isCvChatInputOverLimit(length: number): boolean {
  return length > CV_CHAT_INPUT_MAX_CHARS;
}

export function cvChatInputLimitErrorMessage(length: number): string {
  return `That text is too long (${length.toLocaleString()} characters). Please keep it under ${CV_CHAT_INPUT_MAX_CHARS.toLocaleString()} characters.`;
}

/** Soft character count for chat / paste textareas (shows cap when nearing limit). */
export function formatCvChatCharCount(length: number): string {
  const maxLabel = CV_CHAT_INPUT_MAX_CHARS.toLocaleString();
  const lenLabel = length.toLocaleString();
  if (length >= CV_CHAT_INPUT_MAX_CHARS) {
    return `${lenLabel} / ${maxLabel} characters — over limit`;
  }
  if (length >= CV_CHAT_INPUT_MAX_CHARS * 0.85) {
    return `${lenLabel} / ${maxLabel} characters`;
  }
  return `${lenLabel} characters`;
}
