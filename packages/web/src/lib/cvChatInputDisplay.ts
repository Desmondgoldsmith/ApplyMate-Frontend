import { CV_CHAT_INPUT_MAX_CHARS } from '@/lib/cv-chat-input.constants';

export const CV_CHAT_PASTE_HINT =
  "You can paste your entire resume here. We'll only ask about what's missing.";

export function formatCvChatCharCount(length: number): string {
  if (length >= CV_CHAT_INPUT_MAX_CHARS * 0.9) {
    return `${length.toLocaleString()} / ${CV_CHAT_INPUT_MAX_CHARS.toLocaleString()} characters`;
  }
  return `${length.toLocaleString()} characters`;
}

export function cvChatInputLimitErrorMessage(length: number): string {
  return `That message is too long (${length.toLocaleString()} characters). The limit is ${CV_CHAT_INPUT_MAX_CHARS.toLocaleString()} characters. Please shorten it or paste a smaller section.`;
}

export function isCvChatInputOverLimit(length: number): boolean {
  return length > CV_CHAT_INPUT_MAX_CHARS;
}
