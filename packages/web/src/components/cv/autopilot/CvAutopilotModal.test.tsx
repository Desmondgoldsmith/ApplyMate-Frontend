import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CvAutopilotModal } from '@/components/cv/autopilot/CvAutopilotModal';
import type { CvAutopilotPlan, CvAutopilotRun } from '@/lib/api';

const { planAutopilot, startAutopilot, getAutopilotRun, undoAutopilotRun } =
  vi.hoisted(() => ({
    planAutopilot: vi.fn(),
    startAutopilot: vi.fn(),
    getAutopilotRun: vi.fn(),
    undoAutopilotRun: vi.fn(),
  }));

vi.mock('@/lib/api', () => ({
  api: {
    cv: {
      planAutopilot,
      startAutopilot,
      getAutopilotRun,
      stopAutopilotRun: vi.fn(),
      undoAutopilotRun,
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
  render(
    <CvAutopilotModal
      open
      onOpenChange={vi.fn()}
      profileId="p1"
      allowed={allowed}
      beforeStart={vi.fn().mockResolvedValue(undefined)}
      onCvChanged={onCvChanged}
      onUndone={onUndone}
    />,
  );
  return { onCvChanged, onUndone };
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
});
