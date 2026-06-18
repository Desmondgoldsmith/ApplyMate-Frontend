/** Align with content extractors — keep API payloads bounded. */
export const MAX_JOB_DESCRIPTION_CHARS = 12_000;

/** Trim whitespace and cap length before POST /extension/cv/score (and similar). */
export function trimJobDescriptionForApi(text: string | null | undefined): string {
  if (!text?.trim()) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_JOB_DESCRIPTION_CHARS);
}
