import type { TourId } from '@/components/onboarding/featureTourDefinitions';
import { tourStorageKey } from '@/components/onboarding/featureTourDefinitions';

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

/** True if any legacy per-page or dashboard tour flag was set. */
function legacyTourFinished(userId: string | undefined): boolean {
  const keys = [
    LEGACY_COMPLETED,
    userId ? `${LEGACY_COMPLETED}:${userId}` : '',
    `${LEGACY_DASHBOARD_PREFIX}dashboard`,
    userId ? `${LEGACY_DASHBOARD_PREFIX}dashboard:${userId}` : '',
    `${LEGACY_DASHBOARD_PREFIX}cv-clinic`,
    userId ? `${LEGACY_DASHBOARD_PREFIX}cv-clinic:${userId}` : '',
    `${LEGACY_DASHBOARD_PREFIX}job-analyzer`,
    userId ? `${LEGACY_DASHBOARD_PREFIX}job-analyzer:${userId}` : '',
    `${LEGACY_DASHBOARD_PREFIX}job-hub`,
    userId ? `${LEGACY_DASHBOARD_PREFIX}job-hub:${userId}` : '',
    `${LEGACY_DASHBOARD_PREFIX}job-board`,
    userId ? `${LEGACY_DASHBOARD_PREFIX}job-board:${userId}` : '',
  ].filter(Boolean);
  return keys.some((k) => readLocal(k));
}

export function isGlobalTourFinished(
  user:
    | {
        id?: string;
        onboardingCompleted?: boolean;
        uiPrefs?: { tourCompleted?: boolean } | null;
      }
    | null
    | undefined,
): boolean {
  if (readLocal(TOUR_COMPLETED_KEY)) return true;
  if (readLocal(TOUR_SKIPPED_KEY)) return true;
  if (user?.uiPrefs?.tourCompleted === true) return true;
  if (legacyTourFinished(user?.id)) return true;
  return false;
}

export function shouldShowDashboardTour(
  user:
    | {
        id?: string;
        onboardingCompleted?: boolean;
        uiPrefs?: { tourCompleted?: boolean } | null;
      }
    | null
    | undefined,
  opts?: { onboardingCompletedOverride?: boolean },
): boolean {
  if (!user?.id) return false;
  const onboardingDone =
    user.onboardingCompleted === true || opts?.onboardingCompletedOverride === true;
  if (!onboardingDone) return false;
  return !isGlobalTourFinished(user);
}

export function isPageTourFinished(
  tourId: TourId,
  userId: string | undefined,
): boolean {
  return readLocal(tourStorageKey(tourId, userId));
}

export function shouldShowPageTour(
  tourId: TourId,
  userId: string | undefined,
): boolean {
  if (!userId) return false;
  if (tourId === 'dashboard') return false;
  return !isPageTourFinished(tourId, userId);
}

export function markPageTourCompleted(
  tourId: TourId,
  userId?: string,
): void {
  writeLocal(tourStorageKey(tourId, userId));
}

export function markPageTourSkipped(
  tourId: TourId,
  userId?: string,
): void {
  writeLocal(tourStorageKey(tourId, userId));
}

export function markGlobalTourCompleted(userId?: string): void {
  writeLocal(TOUR_COMPLETED_KEY);
  if (userId) {
    writeLocal(`${LEGACY_COMPLETED}:${userId}`);
    writeLocal(`${LEGACY_DASHBOARD_PREFIX}dashboard:${userId}`);
  }
  writeLocal(LEGACY_COMPLETED);
  writeLocal(`${LEGACY_DASHBOARD_PREFIX}dashboard`);
}

export function markGlobalTourSkipped(): void {
  writeLocal(TOUR_SKIPPED_KEY);
}

export function resetGlobalTourFlags(userId?: string): void {
  try {
    const keys = [
      TOUR_COMPLETED_KEY,
      TOUR_SKIPPED_KEY,
      LEGACY_COMPLETED,
      userId ? `${LEGACY_COMPLETED}:${userId}` : '',
      `${LEGACY_DASHBOARD_PREFIX}dashboard`,
      userId ? `${LEGACY_DASHBOARD_PREFIX}dashboard:${userId}` : '',
      `${LEGACY_DASHBOARD_PREFIX}cv-clinic`,
      userId ? `${LEGACY_DASHBOARD_PREFIX}cv-clinic:${userId}` : '',
      `${LEGACY_DASHBOARD_PREFIX}job-analyzer`,
      userId ? `${LEGACY_DASHBOARD_PREFIX}job-analyzer:${userId}` : '',
      `${LEGACY_DASHBOARD_PREFIX}job-hub`,
      userId ? `${LEGACY_DASHBOARD_PREFIX}job-hub:${userId}` : '',
      `${LEGACY_DASHBOARD_PREFIX}job-board`,
      userId ? `${LEGACY_DASHBOARD_PREFIX}job-board:${userId}` : '',
    ].filter(Boolean);
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
