import { api } from '@/lib/api';
import { isValidExternalApplyUrl, pickApplyUrlFromRecord } from '@/lib/jobApplyUrlPick';

export { isValidExternalApplyUrl, pickApplyUrlFromRecord } from '@/lib/jobApplyUrlPick';

/** Open the employer posting in a new tab (never routes in-app). */
export function openExternalJobApplyUrl(url: string) {
  const trimmed = url.trim();
  if (!isValidExternalApplyUrl(trimmed)) return;
  window.open(trimmed, '_blank', 'noopener,noreferrer');
}

/**
 * Resolve posting URL from analysis row and/or discovery listing id.
 * Prefers explicit `applyUrl` on the analysis when the API provides it.
 */
export async function resolveJobApplyUrl(opts: {
  applyUrl?: string | null;
  jobListingId?: string | null;
}): Promise<string | null> {
  if (isValidExternalApplyUrl(opts.applyUrl)) return opts.applyUrl.trim();

  const listingId = opts.jobListingId?.trim();
  if (!listingId) return null;

  try {
    const listing = await api.jobDiscovery.getDetail(listingId);
    if (isValidExternalApplyUrl(listing.url)) return listing.url.trim();
  } catch {
    /* listing may be gone */
  }
  return null;
}
