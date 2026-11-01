import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CvAutopilotModal } from '@/components/cv/autopilot/CvAutopilotModal';
import type { CvAutopilotPlan, CvAutopilotRun } from '@/lib/api';

const {
  planAutopilot,
  startAutopilot,
  getAutopilotRun,
  undoAutopilotRun,
  createProfile,
  parse,
  deleteCvProfileById,
} = vi.hoisted(() => ({
  planAutopilot: vi.fn(),
  startAutopilot: vi.fn(),
  getAutopilotRun: vi.fn(),
  undoAutopilotRun: vi.fn(),
  createProfile: vi.fn(),
  parse: vi.fn(),
  deleteCvProfileById: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    cv: {
      planAutopilot,
      startAutopilot,
      getAutopilotRun,
      stopAutopilotRun: vi.fn(),
      undoAutopilotRun,
      createProfile,
      parse,
      deleteCvProfileById,
    },
  },
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const plan: CvAutopilotPlan = {
  mode: 'fix_all',
  scoreBefore: 72,
  issuesBefore: 3,
  skippedSections: [],
  onlySections: [],
  steps: [
    {
      id: 's1',
      section: 'summary',
      title: 'Summary is short',
      detail: 'Expand your summary.',
      status: 'planned',
    },
    {
      id: 's2',
      section: 'experience',
      title: 'Weak verb',
      detail: 'Start with a strong verb.',
      status: 'planned',
    },
    {
      id: 's3',
      section: 'experience',
      title: 'No numbers',
      detail: 'Add a result.',
      status: 'needs_input',
      question: 'What is the real number?',
    },
  ],
};

const finishedRun: CvAutopilotRun = {
  id: 'run-1',
  profileId: 'p1',
  sourceProfileId: 'p1',
  copy: null,
  mode: 'fix_all',
  status: 'completed',
  steps: [
    { ...plan.steps[0], status: 'applied' },
    { ...plan.steps[1], status: 'applied' },
    { ...plan.steps[2], status: 'needs_input' },
  ],
  revisionId: 'rev-1',
  scoreBefore: 72,
  scoreAfter: 86,
  issuesBefore: 3,
  issuesAfter: 1,
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  stopping: false,
  undone: false,
};

function renderModal(allowed = true) {
  const onCvChanged = vi.fn().mockResolvedValue(undefined);
  const onUndone = vi.fn().mockResolvedValue(undefined);
  const onOpenProfile = vi.fn();
  render(
    <CvAutopilotModal
      open
      onOpenChange={vi.fn()}
      profileId="p1"
      allowed={allowed}
      beforeStart={vi.fn().mockResolvedValue(undefined)}
      onCvChanged={onCvChanged}
      onUndone={onUndone}
      onOpenProfile={onOpenProfile}
    />,
  );
  return { onCvChanged, onUndone, onOpenProfile };
}

describe('CvAutopilotModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the Pro panel when Autopilot is not available', () => {
    renderModal(false);
    expect(screen.getByText('Autopilot is part of Pro')).toBeInTheDocument();
    expect(screen.queryByText('Fix all issues')).toBeNull();
  });

  it(
    'plans, runs only the ticked fixes, and offers Undo all at the end',
    { timeout: 30000 },
    async () => {
      const user = userEvent.setup();
      planAutopilot.mockResolvedValue(plan);
      startAutopilot.mockResolvedValue({ ...finishedRun, status: 'running' });
      getAutopilotRun.mockResolvedValue(finishedRun);
      undoAutopilotRun.mockResolvedValue({ ...finishedRun, undone: true });
      const { onCvChanged, onUndone } = renderModal();

      await user.click(screen.getByText('Fix all issues'));
      expect(await screen.findByText('Summary is short')).toBeInTheDocument();
      expect(screen.getByText('What is the real number?')).toBeInTheDocument();

      await user.click(screen.getAllByRole('checkbox')[1]);
      await user.click(screen.getByRole('button', { name: /Fix 1 issue/ }));

      expect(startAutopilot).toHaveBeenCalledWith('p1', {
        mode: 'fix_all',
        excludeStepIds: ['s2'],
        facts: {},
      });
      expect(
        await screen.findByText('Autopilot finished', {}, { timeout: 15000 }),
      ).toBeInTheDocument();
      expect(onCvChanged).toHaveBeenCalled();
      expect(screen.getByText('86')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Undo all' }));
      await waitFor(() => expect(onUndone).toHaveBeenCalled());
      expect(undoAutopilotRun).toHaveBeenCalledWith('p1', 'run-1');
    },
  );

  it(
    'tailors a copy to a job and opens the new CV',
    { timeout: 30000 },
    async () => {
      const user = userEvent.setup();
      const job =
        'We are hiring a frontend engineer to own our React design system, accessibility and performance.';
      const changePlan: CvAutopilotPlan = {
        mode: 'change',
        goal: 'tailor_job',
        scoreBefore: 80,
        issuesBefore: 0,
        skippedSections: [],
        onlySections: [],
        steps: [
          {
            id: 'tailor_job:summary',
            section: 'summary',
            title: 'Rewrite your summary for this job',
            detail: 'Leads with what matters most.',
            status: 'planned',
          },
        ],
      };
      planAutopilot.mockResolvedValue(changePlan);
      const copyRun: CvAutopilotRun = {
        ...finishedRun,
        mode: 'change',
        profileId: 'copy-1',
        copy: { name: 'My CV · Tailored' },
        steps: [{ ...changePlan.steps[0], status: 'applied' }],
      };
      startAutopilot.mockResolvedValue({ ...copyRun, status: 'running' });
      getAutopilotRun.mockResolvedValue(copyRun);
      const { onOpenProfile, onCvChanged } = renderModal();

      await user.click(screen.getByText('Change my CV'));
      const next = screen.getByRole('button', { name: 'See the plan' });
      expect(next).toBeDisabled();
      expect(
        screen.getByRole('checkbox', {
          name: 'Keep my original CV and save this as a new copy',
        }),
      ).toBeChecked();

      await user.click(screen.getByLabelText('Job description'));
      await user.paste(job);
      await user.click(next);
      expect(planAutopilot).toHaveBeenCalledWith('p1', {
        mode: 'change',
        goal: 'tailor_job',
        jobDescription: job,
      });

      await user.click(
        await screen.findByRole('button', { name: /Start \(1 step\)/ }),
      );
      expect(startAutopilot).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          mode: 'change',
          goal: 'tailor_job',
          keepOriginal: true,
        }),
      );
      expect(
        await screen.findByText('My CV · Tailored', {}, { timeout: 15000 }),
      ).toBeInTheDocument();
      expect(onCvChanged).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Open the new CV' }));
      expect(onOpenProfile).toHaveBeenCalledWith('copy-1');
    },
  );

  it('quick-creates a CV from a few answers', { timeout: 30000 }, async () => {
    const user = userEvent.setup();
    const createPlan: CvAutopilotPlan = {
      mode: 'create',
      scoreBefore: null,
      issuesBefore: 0,
      skippedSections: [],
      onlySections: [],
      steps: [
        {
          id: 'create:build',
          section: 'CV',
          title: 'Build the CV from your answers',
          detail: '',
          status: 'planned',
        },
      ],
    };
    planAutopilot.mockResolvedValue(createPlan);
    const createRun: CvAutopilotRun = {
      ...finishedRun,
      mode: 'create',
      profileId: 'new-1',
      copy: { name: 'Ama Owusu · Frontend Engineer' },
      steps: [{ ...createPlan.steps[0], status: 'applied' }],
      scoreBefore: 70,
      scoreAfter: 84,
    };
    startAutopilot.mockResolvedValue({ ...createRun, status: 'running' });
    getAutopilotRun.mockResolvedValue(createRun);
    const { onOpenProfile } = renderModal();

    await user.click(screen.getByText('Quick create a CV'));
    await user.type(
      screen.getByLabelText('Which role is this CV for?'),
      'Frontend Engineer',
    );
    await user.click(
      screen.getByRole('button', { name: 'Answer a few questions' }),
    );
    const next = screen.getByRole('button', { name: 'See the plan' });
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText('Full name'), 'Ama Owusu');
    await user.type(
      screen.getByLabelText('Current or latest job title'),
      'Frontend Developer',
    );
    await user.type(screen.getByLabelText('Company'), 'Hubtel');
    await user.type(
      screen.getByLabelText('Achievements'),
      '- Built the merchant dashboard{enter}Cut load time by 40%',
    );
    await user.type(screen.getByLabelText('Skills'), 'React, TypeScript, CSS');
    await user.click(next);

    expect(planAutopilot).toHaveBeenCalledWith('p1', {
      mode: 'create',
      createSource: 'answers',
      targetRole: 'Frontend Engineer',
    });
    await user.click(
      await screen.findByRole('button', { name: 'Create my CV' }),
    );
    expect(startAutopilot).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        mode: 'create',
        createSource: 'answers',
        answers: expect.objectContaining({
          fullName: 'Ama Owusu',
          company: 'Hubtel',
          achievements: [
            'Built the merchant dashboard',
            'Cut load time by 40%',
          ],
          skills: ['React', 'TypeScript', 'CSS'],
        }),
      }),
    );
    expect(
      await screen.findByText(
        'Ama Owusu · Frontend Engineer',
        {},
        { timeout: 15000 },
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open the new CV' }));
    expect(onOpenProfile).toHaveBeenCalledWith('new-1');
  });

  it(
    'removes the empty CV and keeps the error on screen when the file cannot be read',
    { timeout: 30000 },
    async () => {
      const user = userEvent.setup();
      planAutopilot.mockResolvedValue({
        mode: 'create',
        scoreBefore: null,
        issuesBefore: 0,
        skippedSections: [],
        onlySections: [],
        steps: [
          {
            id: 'create:build',
            section: 'CV',
            title: 'Read your file and build the CV',
            detail: '',
            status: 'planned',
          },
        ],
      } satisfies CvAutopilotPlan);
      createProfile.mockResolvedValue({
        id: 'new-9',
        name: 'Frontend Engineer CV',
      });
      parse.mockRejectedValue(new Error('Daily AI limit reached'));
      deleteCvProfileById.mockResolvedValue(undefined);
      renderModal();

      await user.click(screen.getByText('Quick create a CV'));
      await user.type(
        screen.getByLabelText('Which role is this CV for?'),
        'Frontend Engineer',
      );
      await user.upload(
        screen.getByLabelText('CV file'),
        new File(['Efua Mensah'], 'cv.txt', { type: 'text/plain' }),
      );
      await user.click(screen.getByRole('button', { name: 'See the plan' }));
      await user.click(
        await screen.findByRole('button', { name: 'Create my CV' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Daily AI limit reached',
      );
      expect(deleteCvProfileById).toHaveBeenCalledWith('new-9');
      expect(startAutopilot).not.toHaveBeenCalled();
    },
  );
});
