export type WelcomeTourStep = {
  id: string;
  /** Value of the `data-tour` attribute to highlight. The first visible match is used. */
  target: string;
  title: string;
  body: string;
};

/** Plain-language tour of Home. Steps whose target isn't on screen (e.g. a hidden feature) are skipped. */
export const WELCOME_TOUR_STEPS: WelcomeTourStep[] = [
  {
    id: 'next-step',
    target: 'home-next-step',
    title: 'Start here',
    body: 'This card always shows the one thing that will move your job search forward most. Do it, and the next one appears.',
  },
  {
    id: 'setup',
    target: 'home-setup',
    title: 'Finish setting up',
    body: 'A few quick steps get you fully set up. Tick them off at your own pace.',
  },
  {
    id: 'today',
    target: 'home-today',
    title: 'Your to-dos for today',
    body: 'Follow-ups and reminders for the jobs you save or apply to show up here, so nothing slips.',
  },
  {
    id: 'jobs',
    target: 'nav-jobs',
    title: 'Jobs',
    body: 'Find roles, check how well you fit a job before applying, and track every application in one place.',
  },
  {
    id: 'cv',
    target: 'nav-cv',
    title: 'My CV',
    body: 'Edit your CV, apply the suggested fixes and download it as a PDF.',
  },
  {
    id: 'practice',
    target: 'nav-interviews',
    title: 'Interview practice',
    body: 'Rehearse with an AI interviewer that knows your CV and the role you want.',
  },
  {
    id: 'help',
    target: 'help-menu',
    title: 'Help is always here',
    body: 'Replay this tour or watch the walkthrough video any time from this button.',
  },
];
