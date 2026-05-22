/**
 * Common closing placeholders returned by the generate API before a real name is injected.
 * Case-insensitive; only replaces when we have a real display name (not the generic "there" fallback).
 */
const CANDIDATE_PLACEHOLDER_RE = /\[(?:candidate name|your name)\]/gi;

export function substituteCoverLetterCandidateName(text: string, candidateDisplayName: string): string {
  const name = candidateDisplayName.trim();
  if (!name || /^there$/i.test(name)) return text;
  return text.replace(CANDIDATE_PLACEHOLDER_RE, name);
}
