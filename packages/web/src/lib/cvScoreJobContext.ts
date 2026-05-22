/**
 * Client-side mirror of backend `trimCvScoreJobContext`:
 * meaningful job match needs JD length ≥ 40 and/or target role length ≥ 3 (after trim).
 */
export function cvScoreJobContextMeaningful(jobDescription?: string | null, targetRole?: string | null): boolean {
  const jd = (jobDescription ?? '').trim();
  const role = (targetRole ?? '').trim();
  return jd.length >= 40 || role.length >= 3;
}

/** Prefer POST body for long job descriptions (URL-safe, matches backend max 12000). */
export function cvScorePreferDetailedPostBodyForJobDescription(jobDescription?: string | null): boolean {
  const jd = (jobDescription ?? '').trim();
  return jd.length > 400;
}
