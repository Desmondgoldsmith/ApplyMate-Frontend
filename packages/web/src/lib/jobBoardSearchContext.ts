import type { EffectiveLocationSource } from '@/lib/resolve-effective-location-client';

const SOURCE_PHRASE: Record<EffectiveLocationSource, string> = {
  user_override: 'from your search filter',
  saved_preference: 'from your saved preference',
  ip_detected: 'from your detected location',
  cv_profile: 'from your CV profile',
  role_default: 'from default search settings',
};

export function searchContextSourcePhrase(source: string | undefined): string {
  if (source && source in SOURCE_PHRASE) {
    return SOURCE_PHRASE[source as EffectiveLocationSource];
  }
  return 'for this search';
}

export function formatSearchContextBanner(input: {
  locationLabel?: string;
  locationSource?: string;
  roleQuery?: string;
}): string | null {
  const label = input.locationLabel?.trim();
  if (!label) return null;
  const phrase = searchContextSourcePhrase(input.locationSource);
  const role = input.roleQuery?.trim();
  if (role) {
    return `Showing ${role} roles near ${label} (${phrase}).`;
  }
  return `Showing jobs near ${label} (${phrase}).`;
}
