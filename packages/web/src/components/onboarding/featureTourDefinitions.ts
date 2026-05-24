export type TourId =
  | 'dashboard'
  | 'cv-clinic'
  | 'job-analyzer'
  | 'job-hub'
  | 'job-board';

export type TourSide = 'top' | 'right' | 'bottom' | 'left';

export type TourStepDef = {
  selector: string;
  title: string;
  description: string;
  side: TourSide;
  align?: 'start' | 'center' | 'end';
  stagePadding?: number;
  stageRadius?: number;
  popoverOffset?: number;
  /** Prefer this selector on narrow viewports when present */
  narrowSelector?: string;
  narrowSide?: TourSide;
  beforeHighlight?: () => void;
  /** Mobile: keep step when target mounts after `beforeHighlight` (e.g. bottom nav). */
  revealOnHighlight?: boolean;
};

export const TOUR_STORAGE_PREFIX = 'applymate:tour:';

export function tourStorageKey(
  tourId: TourId,
  userId: string | undefined,
): string {
  const base = `${TOUR_STORAGE_PREFIX}${tourId}`;
  return userId ? `${base}:${userId}` : base;
}

export function normalizeTourPath(pathname: string): string {
  return (
    (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/dashboard'
  );
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

export function openJobsNavForTour(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('applymate:tour-open-jobs-nav'));
}

export function closeJobsNavForTour(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('applymate:tour-close-jobs-nav'));
  window.dispatchEvent(new CustomEvent('applymate:tour-close-more-nav'));
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

function openMobileNavThenJobsForTour(): void {
  openMobileNavForTour();
  window.setTimeout(() => openJobsNavForTour(), 320);
}

function smartSide(
  el: Element,
  preferred: TourSide,
  narrow: boolean,
): TourSide {
  if (!narrow) return preferred;
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (rect.top < vh * 0.28) return 'bottom';
  if (rect.bottom > vh * 0.72) return 'top';
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

function dashboardStepsMobile(): TourStepDef[] {
  const scroll = (selector: string) => () => scrollTourTarget(selector);
  return [
    {
      selector: '[data-tour="ai-counter"]',
      title: 'Daily AI credits',
      description:
        'Analyses, cover letters, and AI edits use credits. Free accounts get 5 per day; Pro is unlimited.',
      side: 'bottom',
      stagePadding: 6,
      stageRadius: 10,
      popoverOffset: 14,
    },
    {
      selector: '[data-tour="mobile-nav-toggle"]',
      title: 'More options on your phone',
      description:
        'Tap this grid button anytime to open the menu bar — Jobs, CV Clinic, Interview Prep, and the rest of the app live there.',
      side: 'top',
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 16,
      beforeHighlight: () => closeMobileNavForTour(),
    },
    {
      selector: '[data-tour="recommended-move"]',
      title: 'Recommended move',
      description:
        'Your single best next action — ranked by fit, urgency, and momentum. Start here when you are not sure what to do.',
      side: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
      beforeHighlight: scroll('[data-tour="recommended-move"]'),
    },
    {
      selector: '[data-tour="dashboard-focus"]',
      title: 'Your focus',
      description:
        'A short list of what needs attention now — follow-ups, interviews, and CV fixes.',
      side: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
      beforeHighlight: scroll('[data-tour="dashboard-focus"]'),
    },
    {
      selector: '[data-tour="todays-plan"]',
      title: "Today's Plan",
      description:
        'Your daily briefing — top priorities, CV fixes, and applications to finish. Refresh after you complete something.',
      side: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
      beforeHighlight: scroll('[data-tour="todays-plan"]'),
    },
    {
      selector: '[data-tour="cv-clinic-card"]',
      title: 'CV Clinic',
      description:
        'Score, edit, and improve your CV from here when the dashboard flags work to do.',
      side: 'bottom',
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 18,
      beforeHighlight: scroll('[data-tour="cv-clinic-card"]'),
    },
    {
      selector: '[data-tour="getting-started"]',
      title: 'Setup checklist',
      description:
        'Track the milestones that unlock the full product — most people finish in one session.',
      side: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
      beforeHighlight: scroll('[data-tour="getting-started"]'),
    },
    {
      selector: '[data-tour="nav-jobs-workspace"]',
      title: 'Jobs menu',
      description:
        'We opened the menu for you. Tap Jobs to reach Job Hub, Job Analyzer, and Job Board.',
      side: 'top',
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 16,
      revealOnHighlight: true,
      beforeHighlight: openMobileNavForTour,
    },
    {
      selector: '[data-tour="nav-job-hub"]',
      title: 'Job Hub — your pipeline',
      description:
        'Every role you save or analyze lands here — track stages, notes, and documents.',
      side: 'top',
      stagePadding: 6,
      stageRadius: 10,
      popoverOffset: 14,
      revealOnHighlight: true,
      beforeHighlight: openMobileNavThenJobsForTour,
    },
    {
      selector: '[data-tour="nav-job-analyzer"]',
      title: 'Job Analyzer',
      description:
        'Paste any job description to score your CV, find gaps, and draft a tailored cover letter.',
      side: 'top',
      stagePadding: 6,
      stageRadius: 10,
      popoverOffset: 14,
      revealOnHighlight: true,
      beforeHighlight: openMobileNavThenJobsForTour,
    },
    {
      selector: '[data-tour="upgrade-card"]',
      title: 'Go further with Pro',
      description:
        'Remove daily limits and keep your full application history. Cancel anytime.',
      side: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
      beforeHighlight: () => {
        closeMobileNavForTour();
        scrollTourTarget('[data-tour="upgrade-card"]');
      },
    },
  ];
}

function dashboardStepsDesktop(): TourStepDef[] {
  const side = (s: TourSide) => s;
  return [
    {
      selector: '[data-tour="todays-plan"]',
      title: "Today's Plan — your daily briefing",
      description:
        'We stack your best next moves here: CV fixes, roles to review, and applications to finish. Hit Refresh plan after you complete something so the list stays accurate.',
      side: side('bottom'),
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
    },
    {
      selector: '[data-tour="todays-plan-primary"]',
      title: 'Start with your top priority',
      description:
        'The first card in Top priorities is your #1 action right now — ranked by fit, urgency, and momentum. Do that one first, then work down the list.',
      side: side('bottom'),
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 18,
    },
    {
      selector: '[data-tour="ai-counter"]',
      title: 'Daily AI credits',
      description:
        'Analyses, cover letters, and AI edits use credits. Free accounts get 5 per day; Pro is unlimited.',
      side: side('bottom'),
      stagePadding: 6,
      stageRadius: 10,
      popoverOffset: 14,
    },
    {
      selector: '[data-tour="recommended-move"]',
      title: 'Recommended move',
      description:
        'Your single best next action — ranked by fit, urgency, and momentum. Start here when you are not sure what to do.',
      side: side('bottom'),
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
    },
    {
      selector: '[data-tour="dashboard-focus"]',
      title: 'Your focus',
      description:
        'A short list of what needs attention now — follow-ups, interviews, and CV fixes. Work through these after your recommended move.',
      side: side('bottom'),
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
    },
    {
      selector: '[data-tour="nav-job-hub"]',
      title: 'Job Hub — your pipeline',
      description:
        'Every role you save or analyze lands here. Track stages, notes, and documents without losing context.',
      side: 'right' as TourSide,
      stagePadding: 6,
      stageRadius: 10,
      popoverOffset: 16,
      beforeHighlight: openJobsNavForTour,
    },
    {
      selector: '[data-tour="nav-job-analyzer"]',
      title: 'Job Analyzer — any role in ~60s',
      description:
        'Paste a job description to score your CV, surface gaps, estimate salary, and draft a tailored cover letter.',
      side: 'right' as TourSide,
      stagePadding: 6,
      stageRadius: 10,
      popoverOffset: 16,
      beforeHighlight: openJobsNavForTour,
    },
    {
      selector: '[data-tour="cv-clinic-card"]',
      narrowSelector: '[data-tour="cv-clinic-card"]',
      title: 'CV Clinic on your dashboard',
      description:
        'When your CV needs work, we surface it here with a clear fix. Open CV Clinic to score, edit, and apply AI improvements in one place.',
      side: side('top'),
      narrowSide: 'bottom',
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 20,
    },
    {
      selector: '[data-tour="getting-started"]',
      title: 'Your setup checklist',
      description:
        'Track the four milestones that unlock the full product — most people finish in their first session.',
      side: side('top'),
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
    },
    {
      selector: '[data-tour="upgrade-card"]',
      title: 'Go further with Pro',
      description:
        'Remove daily limits, unlock deeper analysis, and keep your full application history. Cancel anytime.',
      side: side('left'),
      narrowSide: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 18,
    },
  ];
}

function dashboardSteps(narrow: boolean): TourStepDef[] {
  return narrow ? dashboardStepsMobile() : dashboardStepsDesktop();
}

function cvClinicSteps(narrow: boolean): TourStepDef[] {
  const side = (s: TourSide) => (narrow ? 'bottom' : s) as TourSide;
  return [
    {
      selector: '[data-tour="cv-clinic-intro"]',
      title: 'Welcome to CV Clinic',
      description:
        'This is your CV workspace — create, upload, score, and refine profiles. Everything saves automatically as you edit.',
      side: side('bottom'),
      stagePadding: 10,
      stageRadius: 14,
    },
    {
      selector: '[data-tour="cv-clinic-actions"]',
      title: 'Quick actions',
      description:
        'Start a new CV, upload a PDF, open analysis history, or jump straight to cover letters. Pick the path that matches where you are today.',
      side: side('bottom'),
      stagePadding: 8,
      stageRadius: 12,
    },
    {
      selector: '[data-tour="cv-clinic-library"]',
      title: 'Your CV library',
      description:
        'Open any CV to enter the editor — live preview, AI suggestions, templates, and export. Search and switch views (cards or table) as your list grows.',
      side: side('top'),
      narrowSide: 'bottom',
      stagePadding: 8,
      stageRadius: 12,
    },
  ];
}

function jobAnalyzerSteps(narrow: boolean): TourStepDef[] {
  return [
    {
      selector: '[data-tour="analyzer-form"]',
      title: 'Analyze any job',
      description:
        'Paste the full job description, add title and company if you have them, then run Analyze. We score fit against your active CV and build an AI recruiter report.',
      side: narrow ? 'bottom' : 'right',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 20,
    },
    {
      selector: '[data-tour="analyzer-results"]',
      title: 'Results & tailoring',
      description:
        'Match score, gap insights, cover letter, and CV tailoring live here after analysis. Use Score improvement tips, then tailor sections before you apply.',
      side: narrow ? 'bottom' : 'left',
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 20,
    },
    {
      selector: '[data-tour="analyzer-history"]',
      title: 'Recent analyses',
      description:
        'Reopen past roles without re-pasting — handy when you are comparing multiple applications or continuing later.',
      side: 'top',
      narrowSide: 'bottom',
      stagePadding: 8,
      stageRadius: 12,
    },
  ];
}

function jobHubSteps(narrow: boolean): TourStepDef[] {
  return [
    {
      selector: '[data-tour="job-hub-header"]',
      title: 'Job Hub — your pipeline',
      description:
        'Every role you save or analyze lands here. Track stages, notes, emails, and documents without losing context.',
      side: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
    },
    {
      selector: '[data-tour="job-hub-search"]',
      title: 'Find roles fast',
      description:
        'Search by title or company, switch board vs list view, and open a card to see the full detail panel.',
      side: narrow ? 'bottom' : 'bottom',
      stagePadding: 8,
      stageRadius: 12,
    },
    {
      selector: '[data-tour="job-hub-analyze-cta"]',
      title: 'Analyze a new role',
      description:
        'Send a fresh job description to the Analyzer — we prefill the form so you can score and tailor in one flow.',
      side: narrow ? 'bottom' : 'left',
      stagePadding: 6,
      stageRadius: 10,
    },
    {
      selector: '[data-tour="job-hub-board"]',
      title: 'Board & stages',
      description:
        'Drag cards across Applied → Interview → Offer (or use the list). Stages sync with your dashboard plan and reminders.',
      side: narrow ? 'bottom' : 'top',
      stagePadding: 8,
      stageRadius: 12,
    },
  ];
}

function jobBoardSteps(narrow: boolean): TourStepDef[] {
  return [
    {
      selector: '[data-tour="job-board-filters"]',
      title: 'Search & filters',
      description:
        'Choose your CV, location, keywords, and work mode. Defaults use your profile — tap Search when you change filters.',
      side: 'bottom',
      stagePadding: 10,
      stageRadius: 14,
    },
    {
      selector: '[data-tour="job-board-listings"]',
      title: 'Matched listings',
      description:
        'Each card shows fit against your CV. Open a role to read the description, bookmark it, or jump to Analyze with one click.',
      side: narrow ? 'bottom' : 'right',
      stagePadding: 8,
      stageRadius: 12,
    },
    {
      selector: '[data-tour="job-board-detail"]',
      narrowSelector: '[data-tour="job-board-listings"]',
      title: narrow ? 'Job details' : 'Role detail panel',
      description: narrow
        ? 'On mobile, the full job view opens as a sheet after you tap a listing — bookmark, analyze, or apply from there.'
        : 'The right panel shows full details, match breakdown, and actions — bookmark, analyze, or apply without leaving the board.',
      side: narrow ? 'bottom' : 'left',
      stagePadding: 8,
      stageRadius: 12,
    },
  ];
}

export function stepsForTour(tourId: TourId, narrow: boolean): TourStepDef[] {
  switch (tourId) {
    case 'dashboard':
      return dashboardSteps(narrow);
    case 'cv-clinic':
      return cvClinicSteps(narrow);
    case 'job-analyzer':
      return jobAnalyzerSteps(narrow);
    case 'job-hub':
      return jobHubSteps(narrow);
    case 'job-board':
      return jobBoardSteps(narrow);
    default:
      return [];
  }
}

export function tourMeta(tourId: TourId): {
  label: string;
  celebrate: boolean;
} {
  switch (tourId) {
    case 'dashboard':
      return { label: 'Dashboard', celebrate: true };
    case 'cv-clinic':
      return { label: 'CV Clinic', celebrate: false };
    case 'job-analyzer':
      return { label: 'Job Analyzer', celebrate: false };
    case 'job-hub':
      return { label: 'Job Hub', celebrate: false };
    case 'job-board':
      return { label: 'Job Board', celebrate: false };
    default:
      return { label: 'Tour', celebrate: false };
  }
}
