import type { JobSearchUrgency } from '@/lib/api';

/** POST /onboarding discovery fields (whitelist only — no extras). */
export type OnboardingDiscoveryApiFields = {
  focusGetHired: boolean;
  focusStudentLaunchpad: boolean;
  jobSearchUrgency: JobSearchUrgency;
  targetRoles: string[];
  referralSource?: string;
  referralOther?: string;
};

function parseTargetRolesList(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((s) => (s.length > 120 ? s.slice(0, 120) : s));
}

/**
 * Builds the discovery payload for POST /onboarding when leaving step 1.
 * Returns null if required answers are missing (caller should block UX before this).
 */
export function buildOnboardingDiscoveryApiFields(opts: {
  focusHired: boolean;
  focusStudent: boolean;
  jobSearchUrgency: JobSearchUrgency | null;
  targetRolesText: string;
  referralSource: string;
  referralOther: string;
  /** User chose “Skip this step” on the referral screen — valid without `referralOther`. */
  referralSkipped?: boolean;
}): OnboardingDiscoveryApiFields | null {
  if (!opts.jobSearchUrgency) return null;
  const targetRoles = parseTargetRolesList(opts.targetRolesText);
  if (opts.referralSkipped === true || opts.referralSource.trim() === 'Skipped') {
    return {
      focusGetHired: opts.focusHired,
      focusStudentLaunchpad: opts.focusStudent,
      jobSearchUrgency: opts.jobSearchUrgency,
      targetRoles,
    };
  }
  const ref = opts.referralSource.trim();
  if (!ref) return null;
  if (ref === 'Other' && !opts.referralOther.trim()) return null;
  const out: OnboardingDiscoveryApiFields = {
    focusGetHired: opts.focusHired,
    focusStudentLaunchpad: opts.focusStudent,
    jobSearchUrgency: opts.jobSearchUrgency,
    targetRoles,
    referralSource: ref,
  };
  if (ref === 'Other') {
    out.referralOther = opts.referralOther.trim().slice(0, 500);
  }
  return out;
}
