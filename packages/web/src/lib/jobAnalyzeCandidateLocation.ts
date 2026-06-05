/** Optional body fields for POST /jobs/analyze (AI salary fallback). */
export type JobAnalyzeCandidateLocationFields = {
  candidateLocation?: string;
  candidateCountryCode?: string;
};

export function jobAnalyzeCandidateLocationFields(input: {
  userLocation?: string | null;
  jobSearchLocation?: string | null;
  selectedLocation?: string | null;
  detectedCountryCode?: string | null;
  cvProfileLocation?: string | null;
}): JobAnalyzeCandidateLocationFields {
  const candidateLocation =
    input.userLocation?.trim() ||
    input.selectedLocation?.trim() ||
    input.jobSearchLocation?.trim() ||
    input.cvProfileLocation?.trim() ||
    '';

  const candidateCountryCode = input.detectedCountryCode?.trim().toUpperCase() ?? '';

  const out: JobAnalyzeCandidateLocationFields = {};
  if (candidateLocation) out.candidateLocation = candidateLocation;
  if (candidateCountryCode) out.candidateCountryCode = candidateCountryCode;
  return out;
}
