import {
  type WelcomeTourStep,
  WELCOME_TOUR_STEPS,
} from '@/components/dashboard/welcome-tour/welcomeTourSteps';
import {
  isGlobalTourFinished,
  markGlobalTourCompleted,
  markGlobalTourSkipped,
  shouldShowDashboardTour,
} from '@/components/onboarding/featureTourStorage';
import type { TourPagesCompletedPrefs, UserUiPrefs } from '@/lib/api';

export type TourUser = {
  id: string;
  onboardingCompleted: boolean;
  uiPrefs: UserUiPrefs | null;
};

export type PageTour = {
  id: 'dashboard' | 'cv';
  steps: WelcomeTourStep[];
  /** Saved on the account once the tour is finished or skipped. */
  prefKey: keyof TourPagesCompletedPrefs;
  /** Whether this user should get the tour automatically. */
  shouldAutoStart: (user: TourUser) => boolean;
  markDone: (user: TourUser | null, outcome: 'completed' | 'skipped') => void;
};

/** Plain-language tour of the CV editor. Desktop and phone controls differ; hidden steps are skipped. */
export const CV_TOUR_STEPS: WelcomeTourStep[] = [
  {
    id: 'cv-page',
    target: 'cv-document',
    title: 'This is your CV',
    body: 'Click any text to change it. Select words to make them bold, italic or a link. Everything saves on its own.',
  },
  {
    id: 'cv-design',
    target: 'cv-template',
    title: 'Change the design',
    body: 'Try another design any time. Your words stay exactly the same.',
  },
  {
    id: 'cv-download',
    target: 'cv-download',
    title: 'Download it',
    body: 'Get a PDF to send to employers, or a Word file if they ask for one.',
  },
  {
    id: 'cv-tools-mobile',
    target: 'cv-tools-mobile',
    title: 'Design and download',
    body: 'Change the design, add a section or download your CV from here.',
  },
  {
    id: 'cv-score',
    target: 'cv-insights',
    title: 'Your score and tips',
    body: 'See how strong your CV is and what to fix first. “Fix with AI” suggests a rewrite, and nothing changes until you accept it.',
  },
  {
    id: 'cv-ask-ai',
    target: 'cv-ask-ai',
    title: 'Ask AI for anything',
    body: 'Type what you want, like “make my summary shorter”. You review every change before it goes in.',
  },
  {
    id: 'cv-help',
    target: 'help-menu',
    title: 'See this again',
    body: 'Open Help at the top of the screen to replay this tour.',
  },
];

const CV_TOUR_LOCAL_KEY = 'careerkite:tour:cv:done';

function localDone(key: string, userId: string | undefined): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    return window.localStorage.getItem(`${key}:${userId}`) === '1';
  } catch {
    return false;
  }
}

function setLocalDone(key: string, userId: string | undefined): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(`${key}:${userId}`, '1');
  } catch {
    /* private mode */
  }
}

const DASHBOARD_TOUR: PageTour = {
  id: 'dashboard',
  steps: WELCOME_TOUR_STEPS,
  prefKey: 'dashboard',
  shouldAutoStart: (user) =>
    shouldShowDashboardTour(user) && !isGlobalTourFinished(user),
  markDone: (user, outcome) => {
    if (outcome === 'completed') markGlobalTourCompleted(user?.id);
    else markGlobalTourSkipped(user?.id);
  },
};

const CV_TOUR: PageTour = {
  id: 'cv',
  steps: CV_TOUR_STEPS,
  prefKey: 'resumeClinic',
  shouldAutoStart: (user) =>
    user.uiPrefs?.tourPagesCompleted?.resumeClinic !== true &&
    !localDone(CV_TOUR_LOCAL_KEY, user.id),
  markDone: (user) => setLocalDone(CV_TOUR_LOCAL_KEY, user?.id),
};

/** The tour for a dashboard path, if that page has one. */
export function pageTourForPath(pathname: string): PageTour | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/dashboard') return DASHBOARD_TOUR;
  if (path === '/dashboard/cv') return CV_TOUR;
  return null;
}
