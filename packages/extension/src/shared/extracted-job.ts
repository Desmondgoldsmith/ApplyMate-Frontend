import type { ExtractedJob } from '@/shared/types';

/** True when DOM extract did not capture enough to analyze or save reliably. */
export function isExtractedJobIncomplete(job: ExtractedJob | null | undefined): boolean {
  if (!job) return true;
  return (
    !job.title?.trim() ||
    !job.description?.trim() ||
    !job.company?.trim()
  );
}
