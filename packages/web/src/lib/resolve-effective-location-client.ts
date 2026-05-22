import type { ResolvedGeoLocation } from '@/store/useLocationStore';

export type EffectiveLocationSource =
  | 'user_override'
  | 'saved_preference'
  | 'ip_detected'
  | 'cv_profile'
  | 'role_default';

export type EffectiveLocationClient = {
  label: string;
  source: EffectiveLocationSource;
};

function labelFromGeo(geo: ResolvedGeoLocation): string | null {
  const city = geo.city?.trim();
  const country = geo.country?.trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || null;
}

/**
 * Mirrors backend priority: user override → saved preference → IP → CV → empty.
 */
export function resolveEffectiveLocationClient(input: {
  userOverride?: string | null;
  savedPreference?: string | null;
  detected?: ResolvedGeoLocation | null;
  cvLocation?: string | null;
}): EffectiveLocationClient {
  const override = input.userOverride?.trim();
  if (override) return { label: override, source: 'user_override' };

  const saved = input.savedPreference?.trim();
  if (saved) return { label: saved, source: 'saved_preference' };

  if (input.detected) {
    const fromIp = labelFromGeo(input.detected);
    if (fromIp) return { label: fromIp, source: 'ip_detected' };
  }

  const cv = input.cvLocation?.trim();
  if (cv) return { label: cv, source: 'cv_profile' };

  return { label: '', source: 'role_default' };
}
