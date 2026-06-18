import type { ExtractedJob } from '@/shared/types';

/** Stable fingerprint for extracted job text — used to detect JD edits / new extractions. */
export function jobContentFingerprint(job: ExtractedJob | null | undefined): string {
  if (!job) return '';
  return [
    job.title?.trim() ?? '',
    job.company?.trim() ?? '',
    job.description?.trim() ?? '',
    job.location?.trim() ?? '',
    job.salary?.trim() ?? '',
  ].join('\u001f');
}
