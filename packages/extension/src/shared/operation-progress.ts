import { useEffect, useState } from 'react';

/** Cycle through friendly loading phrases while an async operation runs. */
export function useProgressPhrases(active: boolean, phrases: readonly string[], intervalMs = 3500): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, phrases, intervalMs]);

  return phrases[active ? index : 0] ?? phrases[0] ?? '';
}

export const SCORE_PROGRESS_PHRASES = [
  'Analyzing your CV…',
  'Comparing skills to the job description…',
  'Almost done — scoring your match…',
] as const;

export const COVER_LETTER_PROGRESS_PHRASES = [
  'Writing your cover letter…',
  'Matching your experience to the role…',
  'Almost done — polishing the draft…',
] as const;
