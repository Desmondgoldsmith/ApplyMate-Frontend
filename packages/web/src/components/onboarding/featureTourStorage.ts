import type { TourId } from '@/components/onboarding/featureTourDefinitions';
import {
  tourIdToPageApiKey,
  tourStorageKey,
} from '@/components/onboarding/featureTourDefinitions';
import type { TourPagesCompletedPrefs, UserUiPrefs } from '@/lib/api';

/** Global product tour — one completion flag for the entire app (v1). */

export const TOUR_COMPLETED_KEY = 'applymate:tour:v1:completed';
export const TOUR_SKIPPED_KEY = 'applymate:tour:v1:skipped';

const LEGACY_DASHBOARD_PREFIX = 'applymate:tour:';
const LEGACY_COMPLETED = 'applymate:tour:completed';

function readLocal(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeLocal(key: string): void {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    /* ignore */
  }
}

/** Device flags are per account, so one person's finished tour never hides another's. */
function readUserLocal(key: string, userId: string | undefined): boolean {
  return userId ? readLocal(`${key}:${userId}`) : false;
}

/** True if this account finished an older (per-page) version of the tour on this device. */
function legacyTourFinished(userId: string | undefined): boolean {
  if (!userId) return false;
  return ['dashboard', 'cv-clinic', 'job-analyzer', 'job-hub', 'job-board']
    .map((page) => `${LEGACY_DASHBOARD_PREFIX}${page}:${userId}`)
    .concat(`${LEGACY_COMPLETED}:${userId}`)
    .some((k) => readLocal(k));
}

function isTourPageCompletedOnServer(
  tourId: TourId,
  uiPrefs?: UserUiPrefs | null,
): boolean {
  if (uiPrefs?.tourCompleted === true) return true;
  const pages = uiPrefs?.tourPagesCompleted;
  if (!pages) return false;
  const key = tourIdToPageApiKey(tourId);
  return pages[key] === true;
}

export function isGlobalTourFinished(
  user:
    | {
        id?: string;
        onboardingCompleted?: boolean;
        uiPrefs?: UserUiPrefs | null;
      }
    | null
    | undefined,
): boolean {
  if (readUserLocal(TOUR_COMPLETED_KEY, user?.id)) return true;
  if (readUserLocal(TOUR_SKIPPED_KEY, user?.id)) return true;
  if (user?.uiPrefs?.tourCompleted === true) return true;
  if (isTourPageCompletedOnServer('dashboard', user?.uiPrefs)) return true;
  if (legacyTourFinished(user?.id)) return true;
  return false;
}

export function shouldShowDashboardTour(
  user:
    | {
        id?: string;
        onboardingCompleted?: boolean;
        uiPrefs?: UserUiPrefs | null;
      }
    | null
    | undefined,
  opts?: { onboardingCompletedOverride?: boolean },
): boolean {
  if (!user?.id) return false;
  const onboardingDone =
    user.onboardingCompleted === true ||
    opts?.onboardingCompletedOverride === true;
  if (!onboardingDone) return false;
  if (user.uiPrefs?.tourCompleted === true) return false;
  if (isTourPageCompletedOnServer('dashboard', user.uiPrefs)) return false;
  if (
    readUserLocal(TOUR_COMPLETED_KEY, user.id) ||
    readUserLocal(TOUR_SKIPPED_KEY, user.id)
  )
    return false;
  if (legacyTourFinished(user.id)) return false;
  return true;
}

export function isPageTourFinished(
  tourId: TourId,
  userId: string | undefined,
  uiPrefs?: UserUiPrefs | null,
): boolean {
  if (isTourPageCompletedOnServer(tourId, uiPrefs)) return true;
  return readLocal(tourStorageKey(tourId, userId));
}

export function shouldShowPageTour(
  tourId: TourId,
  userId: string | undefined,
  uiPrefs?: UserUiPrefs | null,
): boolean {
  if (!userId) return false;
  if (tourId === 'dashboard') return false;
  if (uiPrefs?.tourCompleted === true) return false;
  return !isPageTourFinished(tourId, userId, uiPrefs);
}

export function markPageTourCompleted(tourId: TourId, userId?: string): void {
  writeLocal(tourStorageKey(tourId, userId));
}

export function markPageTourSkipped(tourId: TourId, userId?: string): void {
  writeLocal(tourStorageKey(tourId, userId));
}

export function markGlobalTourCompleted(userId?: string): void {
  if (userId) writeLocal(`${TOUR_COMPLETED_KEY}:${userId}`);
}

export function markGlobalTourSkipped(userId?: string): void {
  if (userId) writeLocal(`${TOUR_SKIPPED_KEY}:${userId}`);
}

export function resetGlobalTourFlags(userId?: string): void {
  try {
    const keys = [
      TOUR_COMPLETED_KEY,
      TOUR_SKIPPED_KEY,
      LEGACY_COMPLETED,
      ...['dashboard', 'cv-clinic', 'job-analyzer', 'job-hub', 'job-board'].map(
        (page) => `${LEGACY_DASHBOARD_PREFIX}${page}`,
      ),
    ];
    const all = userId ? keys.concat(keys.map((k) => `${k}:${userId}`)) : keys;
    for (const k of all) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
