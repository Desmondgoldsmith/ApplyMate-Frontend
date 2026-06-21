export type TourId =
  | 'dashboard'
  | 'cv-clinic'
  | 'job-analyzer'
  | 'job-hub'
  | 'job-board';

/** Keys persisted on `uiPrefs.tourPagesCompleted` via PATCH /users/me. */
export type TourPageApiKey =
  | 'dashboard'
  | 'jobBoard'
  | 'jobHub'
  | 'analyzer'
  | 'resumeClinic';

export function tourIdToPageApiKey(tourId: TourId): TourPageApiKey {
  switch (tourId) {
    case 'dashboard':
      return 'dashboard';
    case 'cv-clinic':
      return 'resumeClinic';
    case 'job-analyzer':
      return 'analyzer';
    case 'job-hub':
      return 'jobHub';
    case 'job-board':
      return 'jobBoard';
    default:
      return 'dashboard';
  }
}

export type TourSide = 'top' | 'right' | 'bottom' | 'left';

export type TourStepDef = {
  selector: string;
  title: string;
  description: string;
  side: TourSide;
  align?: 'start' | 'center' | 'end';
  popoverOffset?: number;
  /** Prefer this selector on narrow viewports when present */
  narrowSelector?: string;
  narrowSide?: TourSide;
  beforeHighlight?: () => void;
  /** Mobile: keep step when target mounts after `beforeHighlight` */
  revealOnHighlight?: boolean;
};

export function normalizeTourPath(pathname: string): string {
  return (
    (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/dashboard'
  );
}

/** Global tour runs on the dashboard overview. Page tours run on their routes. */
export function isDashboardTourPath(pathname: string): boolean {
  return normalizeTourPath(pathname) === '/dashboard';
}

export function matchTourId(pathname: string): TourId | null {
  const p = normalizeTourPath(pathname);
  if (p === '/dashboard') return 'dashboard';
  if (p === '/dashboard/cv') return 'cv-clinic';
  if (p === '/dashboard/jobs/analyze') return 'job-analyzer';
  if (p === '/dashboard/jobs') return 'job-hub';
  if (p === '/dashboard/job-board') return 'job-board';
  return null;
}

export const TOUR_STORAGE_PREFIX = 'applymate:tour:';

export function tourStorageKey(
  tourId: TourId,
  userId: string | undefined,
): string {
  const base = `${TOUR_STORAGE_PREFIX}${tourId}`;
  return userId ? `${base}:${userId}` : base;
}

export function tourMeta(tourId: TourId): {
  label: string;
  celebrate: boolean;
} {
  switch (tourId) {
    case 'dashboard':
      return { label: 'Product', celebrate: true };
    case 'cv-clinic':
      return { label: 'CV Clinic', celebrate: false };
    case 'job-analyzer':
      return { label: 'Job Analyzer', celebrate: false };
    case 'job-hub':
      return { label: 'Job Hub', celebrate: false };
    case 'job-board':
      return { label: 'Job Board', celebrate: false };
    default:
      return { label: 'Product', celebrate: false };
  }
}

export function openJobsNavForTour(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('applymate:tour-open-jobs-nav'));
}

export function closeJobsNavForTour(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('applymate:tour-close-jobs-nav'));
  window.dispatchEvent(new CustomEvent('applymate:tour-close-more-nav'));
}

export function openMobileMoreNavForTour(): void {
  openMobileNavForTour();
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('applymate:tour-open-more-nav'));
  }, MOBILE_NAV_REVEAL_MS);
}

export function setMobileNavVisibleForTour(visible: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('applymate:tour-set-nav-visible', { detail: { visible } }),
  );
}

export function openMobileNavForTour(): void {
  setMobileNavVisibleForTour(true);
}

export function closeMobileNavForTour(): void {
  setMobileNavVisibleForTour(false);
  closeJobsNavForTour();
}

function scrollTourTarget(selector: string): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    document.querySelector(selector)?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, 80);
}

/** Wait for bottom nav + jobs sheet animation before driver measures targets. */
export const MOBILE_NAV_REVEAL_MS = 520;
export const MOBILE_JOBS_REVEAL_MS = 420;

function openMobileNavThenJobsForTour(): void {
  openMobileNavForTour();
  window.setTimeout(() => openJobsNavForTour(), MOBILE_NAV_REVEAL_MS);
}

/** Close jobs/more sheets, keep bottom nav visible for primary-bar targets. */
function openMobileNavCloseSheetsForTour(): void {
  closeJobsNavForTour();
  openMobileNavForTour();
}

function smartSide(
  el: Element,
  preferred: TourSide,
  narrow: boolean,
): TourSide {
  if (el.closest('header')) return narrow ? 'bottom' : 'bottom';
  if (el.closest('nav[data-tour="mobile-bottom-nav"]')) return 'top';
  if (el.closest('[data-tour="mobile-jobs-sheet"]')) return 'top';
  if (el.closest('[data-tour="mobile-more-sheet"]')) return 'top';
  if (!narrow) return preferred;
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (rect.top < vh * 0.34) return 'bottom';
  if (rect.bottom > vh * 0.58) return 'top';
  return preferred === 'left' || preferred === 'right' ? 'bottom' : preferred;
}

export function resolveStepSide(
  el: Element,
  def: TourStepDef,
  narrow: boolean,
): TourSide {
  const base = narrow && def.narrowSide ? def.narrowSide : def.side;
  return smartSide(el, base, narrow);
}

export function resolveStepSelector(def: TourStepDef, narrow: boolean): string {
  if (narrow && def.narrowSelector) {
    const alt = document.querySelector(def.narrowSelector);
    if (alt) return def.narrowSelector;
  }
  return def.selector;
}

/** Seven-step global dashboard tour (desktop). */
function dashboardStepsDesktop(): TourStepDef[] {
  const scroll = (sel: string) => () => scrollTourTarget(sel);
  return [
    {
      selector: '[data-tour="todays-plan"]',
      title: 'Your daily action plan',
      description:
        "Every morning, ApplyMate builds you a personalised list of the most important things to do in your job search today. Follow it and you'll always be moving forward.",
      side: 'bottom',
      align: 'start',
      popoverOffset: 18,
    },
    {
      selector: '[data-tour="ai-counter"]',
      title: 'Your AI credits',
      description:
        'Each analysis, cover letter, and AI action uses one credit. Free users get 10 per day. Upgrade to Pro for unlimited AI — no daily caps.',
      side: 'bottom',
      align: 'end',
      popoverOffset: 14,
    },
    {
      selector: '[data-tour="nav-job-board"]',
      title: 'Discover matched jobs',
      description:
        'Browse jobs matched to your CV and location. Each listing shows your fit score before you even click — no pasting required.',
      side: 'right',
      align: 'center',
      popoverOffset: 16,
      revealOnHighlight: true,
      beforeHighlight: openJobsNavForTour,
    },
    {
      selector: '[data-tour="nav-job-analyzer"]',
      title: 'Analyze any job in 60 seconds',
      description:
        'Paste any job description. We score your CV against it, find your gaps, estimate salary, and generate a tailored cover letter — all at once.',
      side: 'right',
      align: 'center',
      popoverOffset: 16,
      revealOnHighlight: true,
      beforeHighlight: openJobsNavForTour,
    },
    {
      selector: '[data-tour="nav-job-hub"]',
      title: 'Your job pipeline',
      description:
        'Track every role you save or analyze — stages, notes, and documents in one hub so nothing slips through.',
      side: 'right',
      align: 'center',
      popoverOffset: 16,
      revealOnHighlight: true,
      beforeHighlight: openJobsNavForTour,
    },
    {
      selector: '[data-tour="nav-cv-clinic"]',
      title: 'Your CV command centre',
      description:
        "Build, score, and refine your CV here. Our AI spots what's weak, tells you exactly how to fix it, then fixes it with one click.",
      side: 'right',
      align: 'center',
      popoverOffset: 16,
    },
    {
      selector: '[data-tour="nav-interview-prep"]',
      title: 'Interview prep with AI',
      description:
        'Practice real interview questions with voice feedback, coaching tips, and scored reports — tailored to roles you are pursuing.',
      side: 'right',
      align: 'center',
      popoverOffset: 16,
    },
    {
      selector: '[data-tour="cv-clinic-section"]',
      narrowSelector: '[data-tour="cv-clinic-section"]',
      title: 'Your CV health at a glance',
      description:
        'See your CV score, which sections need work, and your top improvements — all without leaving the dashboard.',
      side: 'top',
      align: 'start',
      popoverOffset: 18,
      beforeHighlight: scroll('[data-tour="cv-clinic-section"]'),
    },
    {
      selector: '[data-tour="upgrade-card"]',
      title: 'Go unlimited with Pro',
      description:
        'Remove daily limits, unlock AI voice interview practice, and keep your full application history. Cancel any time.',
      side: 'left',
      align: 'start',
      popoverOffset: 18,
      beforeHighlight: scroll('[data-tour="upgrade-card"]'),
    },
  ];
}

/** Mobile: reveal bottom nav / jobs sheet, then spotlight the exact control. */
function dashboardStepsMobile(): TourStepDef[] {
  const scroll = (sel: string) => () => scrollTourTarget(sel);
  const settleContent = () => {
    closeMobileNavForTour();
    window.setTimeout(() => scrollTourTarget('[data-tour="todays-plan"]'), 120);
  };
  return [
    {
      selector: '[data-tour="todays-plan"]',
      title: 'Your daily action plan',
      description:
        "Every morning, ApplyMate builds you a personalised list of the most important things to do in your job search today. Follow it and you'll always be moving forward.",
      side: 'bottom',
      align: 'start',
      beforeHighlight: settleContent,
    },
    {
      selector: '[data-tour="ai-counter"]',
      title: 'Your AI credits',
      description:
        'Each analysis, cover letter, and AI action uses one credit. Free users get 10 per day. Upgrade to Pro for unlimited AI — no daily caps.',
      side: 'bottom',
      align: 'end',
      popoverOffset: 10,
      beforeHighlight: closeMobileNavForTour,
    },
    {
      selector: '[data-tour="nav-jobs-workspace"]',
      title: 'Jobs on your phone',
      description:
        'Tap Jobs in the bar below to open Job Board, Analyzer, and Hub — your whole pipeline in one place.',
      side: 'top',
      narrowSide: 'top',
      revealOnHighlight: true,
      beforeHighlight: openMobileNavForTour,
    },
    {
      selector: '[data-tour="nav-job-board"]',
      title: 'Discover matched jobs',
      description:
        'Browse jobs matched to your CV and location. Each listing shows your fit score before you even click — no pasting required.',
      side: 'top',
      revealOnHighlight: true,
      beforeHighlight: openMobileNavThenJobsForTour,
    },
    {
      selector: '[data-tour="nav-job-analyzer"]',
      title: 'Analyze any job in 60 seconds',
      description:
        'Paste any job description. We score your CV against it, find your gaps, estimate salary, and generate a tailored cover letter — all at once.',
      side: 'top',
      revealOnHighlight: true,
      beforeHighlight: openMobileNavThenJobsForTour,
    },
    {
      selector: '[data-tour="nav-job-hub"]',
      title: 'Your job pipeline',
      description:
        'Track every saved and analyzed role — drag cards across stages and keep notes without losing context.',
      side: 'top',
      revealOnHighlight: true,
      beforeHighlight: openMobileNavThenJobsForTour,
    },
    {
      selector: '[data-tour="nav-cv-clinic"]',
      title: 'Your CV command centre',
      description:
        "Build, score, and refine your CV here. Our AI spots what's weak, tells you exactly how to fix it, then fixes it with one click.",
      side: 'top',
      revealOnHighlight: true,
      beforeHighlight: openMobileNavCloseSheetsForTour,
    },
    {
      selector: '[data-tour="nav-interview-prep"]',
      title: 'Interview prep with AI',
      description:
        'Tap More, then Prep — practice voice interviews with coaching and scored feedback for the roles you are targeting.',
      side: 'top',
      revealOnHighlight: true,
      beforeHighlight: openMobileMoreNavForTour,
    },
    {
      selector: '[data-tour="cv-clinic-section"]',
      narrowSelector: '[data-tour="cv-clinic-section"]',
      title: 'Your CV health at a glance',
      description:
        'See your CV score, which sections need work, and your top improvements — all without leaving the dashboard.',
      side: 'bottom',
      beforeHighlight: () => {
        closeMobileNavForTour();
        scroll('[data-tour="cv-clinic-section"]')();
      },
    },
    {
      selector: '[data-tour="upgrade-card"]',
      title: 'Go unlimited with Pro',
      description:
        'Remove daily limits, unlock AI voice interview practice, and keep your full application history. Cancel any time.',
      side: 'bottom',
      beforeHighlight: () => {
        closeMobileNavForTour();
        scroll('[data-tour="upgrade-card"]')();
      },
    },
  ];
}

export function dashboardTourSteps(narrow: boolean): TourStepDef[] {
  return narrow ? dashboardStepsMobile() : dashboardStepsDesktop();
}

function cvClinicPageSteps(narrow: boolean): TourStepDef[] {
  const side = (s: TourSide): TourSide => (narrow ? 'bottom' : s);
  return [
    {
      selector: '[data-tour="cv-clinic-intro"]',
      title: 'Welcome to CV Clinic',
      description:
        'This is your CV workspace — create, upload, score, and refine profiles. Everything saves automatically as you edit.',
      side: side('bottom'),
    },
    {
      selector: '[data-tour="cv-clinic-actions"]',
      title: 'Quick actions',
      description:
        'Start a new CV, upload a PDF, open analysis history, or jump straight to cover letters.',
      side: side('bottom'),
    },
    {
      selector: '[data-tour="cv-clinic-library"]',
      title: 'Your CV library',
      description:
        'Open any CV to enter the editor — live preview, AI suggestions, templates, and export.',
      side: side('top'),
      narrowSide: 'bottom',
    },
  ];
}

function jobAnalyzerPageSteps(narrow: boolean): TourStepDef[] {
  return [
    {
      selector: '[data-tour="analyzer-form"]',
      title: 'Analyze any job',
      description:
        'Paste the full job description, add title and company if you have them, then run Analyze.',
      side: narrow ? 'bottom' : 'right',
      popoverOffset: 20,
    },
    {
      selector: '[data-tour="analyzer-results"]',
      title: 'Results & tailoring',
      description:
        'Match score, gap insights, cover letter, and CV tailoring live here after analysis.',
      side: narrow ? 'bottom' : 'left',
      popoverOffset: 20,
    },
    {
      selector: '[data-tour="analyzer-history"]',
      title: 'Recent analyses',
      description:
        'Reopen past roles without re-pasting — handy when comparing multiple applications.',
      side: 'top',
      narrowSide: 'bottom',
    },
  ];
}

function jobHubPageSteps(narrow: boolean): TourStepDef[] {
  return [
    {
      selector: '[data-tour="job-hub-header"]',
      title: 'Job Hub — your pipeline',
      description:
        'Every role you save or analyze lands here. Track stages, notes, and documents without losing context.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="job-hub-search"]',
      title: 'Find roles fast',
      description:
        'Search by title or company, switch board vs list view, and open a card to see the full detail panel.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="job-hub-analyze-cta"]',
      title: 'Analyze a new role',
      description:
        'Send a fresh job description to the Analyzer — we prefill the form so you can score and tailor in one flow.',
      side: narrow ? 'bottom' : 'left',
    },
    {
      selector: '[data-tour="job-hub-board"]',
      title: 'Board & stages',
      description:
        'Drag cards across Applied → Interview → Offer (or use the list). Stages sync with your dashboard plan.',
      side: narrow ? 'bottom' : 'top',
    },
  ];
}

function jobBoardPageSteps(narrow: boolean): TourStepDef[] {
  return [
    {
      selector: '[data-tour="job-board-filters"]',
      title: 'Search & filters',
      description:
        'Choose your CV, location, keywords, and work mode. Defaults use your profile — tap Search when you change filters.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="job-board-listings"]',
      title: 'Matched listings',
      description:
        'Each card shows fit against your CV. Open a role to read the description, bookmark it, or jump to Analyze.',
      side: narrow ? 'bottom' : 'right',
    },
    {
      selector: '[data-tour="job-board-detail"]',
      narrowSelector: '[data-tour="job-board-listings"]',
      title: narrow ? 'Job details' : 'Role detail panel',
      description: narrow
        ? 'On mobile, the full job view opens as a sheet after you tap a listing — bookmark, analyze, or apply from there.'
        : 'The right panel shows full details, match breakdown, and actions — bookmark, analyze, or apply without leaving the board.',
      side: narrow ? 'bottom' : 'left',
    },
  ];
}

export function stepsForTour(tourId: TourId, narrow: boolean): TourStepDef[] {
  switch (tourId) {
    case 'dashboard':
      return dashboardTourSteps(narrow);
    case 'cv-clinic':
      return cvClinicPageSteps(narrow);
    case 'job-analyzer':
      return jobAnalyzerPageSteps(narrow);
    case 'job-hub':
      return jobHubPageSteps(narrow);
    case 'job-board':
      return jobBoardPageSteps(narrow);
    default:
      return [];
  }
}

export const DASHBOARD_TOUR_STEP_COUNT = 9;
