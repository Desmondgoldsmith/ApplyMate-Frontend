import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckJobPage } from '@/components/jobs/check/CheckJobPage';
import type { CvTailorDraft, JobAnalysis } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  analyze: vi.fn(),
  importLink: vi.fn(),
  getJob: vi.fn(),
  createTailorDraft: vi.fn(),
  revertPatch: vi.fn(),
  acceptTailorSection: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => '/dashboard/jobs/analyze',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/hooks/useAnalyzeJob', () => ({
  useAnalyzeJob: () => ({ mutateAsync: mocks.analyze }),
}));
vi.mock('@/hooks/useCvProfileRowsDisplay', () => ({
  useCvProfileRowsDisplay: () => ({
    displayRows: [
      {
        id: 'cv-1',
        name: 'Jordan Mensah CV',
        isDefault: true,
        template: 'modern',
      },
    ],
    isBootstrapping: false,
  }),
}));
vi.mock('@/hooks/useJobHistory', () => ({
  useJobHistory: () => ({ data: [] }),
}));
vi.mock('@/hooks/useExportCV', () => ({
  useExportCV: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('@/lib/api', () => ({
  api: {
    jobs: {
      importLink: mocks.importLink,
      getJob: mocks.getJob,
      generate: vi.fn(),
    },
    cv: {
      createTailorDraft: mocks.createTailorDraft,
      revertPatch: mocks.revertPatch,
      acceptTailorSection: mocks.acceptTailorSection,
    },
    jobDiscovery: { getDetail: vi.fn() },
  },
}));

const analysis: JobAnalysis = {
  id: 'job-1',
  matchScore: 66,
  cvProfileId: 'cv-1',
  applyUrl: 'https://boards.greenhouse.io/monzo/jobs/1',
  strengths: ['Your React matches the core stack.'],
  skillCoverage: [
    {
      skill: 'React',
      status: 'found',
      importance: 'CRITICAL',
      tier: 'required',
      requirementKind: 'tool',
    },
    {
      skill: 'GraphQL',
      status: 'missing',
      importance: 'HIGH',
      tier: 'required',
      requirementKind: 'tool',
    },
  ],
};

const draft: CvTailorDraft = {
  id: 'draft-1',
  cvProfileId: 'cv-tailored',
  jobAnalysisId: 'job-1',
  selectedSkills: ['GraphQL'],
  status: 'completed',
  drafts: [
    {
      sectionId: 'sec-skills',
      sectionType: 'skills',
      before: JSON.stringify(['React']),
      after: JSON.stringify(['React', 'GraphQL']),
      status: 'accepted',
      changedFields: [],
      patchId: 'patch-1',
    },
  ],
};

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckJobPage />
    </QueryClientProvider>,
  );
}

describe('CheckJobPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    'goes from a pasted link to a tailored CV in three steps, with Undo',
    { timeout: 30000 },
    async () => {
      const user = userEvent.setup();
      mocks.importLink.mockResolvedValue({
        title: 'Senior Frontend Engineer',
        company: 'Monzo',
        location: 'London',
        description: 'We need React and GraphQL. '.repeat(20),
        applyUrl: 'https://boards.greenhouse.io/monzo/jobs/1',
      });
      mocks.analyze.mockResolvedValue(analysis);
      mocks.getJob.mockResolvedValue({
        title: 'Senior Frontend Engineer',
        company: 'Monzo',
        description: 'We need React and GraphQL.',
        analysis,
      });
      mocks.createTailorDraft.mockResolvedValue({
        draft,
        jobAnalysis: {
          ...analysis,
          matchScore: 80,
          tailoredCvName: 'Jordan · Monzo (Tailored)',
        },
      });
      mocks.revertPatch.mockResolvedValue({
        draft: {
          ...draft,
          drafts: [{ ...draft.drafts[0], status: 'pending' }],
        },
        jobAnalysis: { ...analysis, matchScore: 66 },
      });
      renderPage();

      await user.type(
        screen.getByLabelText('Paste the job'),
        'https://boards.greenhouse.io/monzo/jobs/1',
      );
      expect(
        screen.getByText(/read the job from this link/),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Check my match/ }));

      expect(await screen.findByText('Good match')).toBeInTheDocument();
      expect(mocks.analyze).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Senior Frontend Engineer',
          company: 'Monzo',
          cvProfileId: 'cv-1',
        }),
      );
      expect(
        screen.getByText('Your CV shows 1 of the 2 things they ask for.'),
      ).toBeInTheDocument();
      expect(mocks.replace).toHaveBeenCalledWith(
        '/dashboard/jobs/analyze?jobId=job-1',
        { scroll: false },
      );

      await user.click(screen.getByRole('button', { name: 'I have this' }));
      await user.click(screen.getByRole('button', { name: /Tailor my CV/ }));

      expect(
        await screen.findByText(/Your CV for Monzo is ready/),
      ).toBeInTheDocument();
      expect(mocks.createTailorDraft).toHaveBeenCalledWith({
        cvProfileId: 'cv-1',
        jobAnalysisId: 'job-1',
        selectedSkills: ['GraphQL'],
        autoApply: true,
      });
      expect(screen.getByText('+14')).toBeInTheDocument();
      expect(screen.getByText('Jordan · Monzo (Tailored)')).toBeInTheDocument();
      expect(screen.getByText('Added GraphQL')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Apply on their site/ }),
      ).toHaveAttribute('href', 'https://boards.greenhouse.io/monzo/jobs/1');

      await user.click(screen.getByRole('button', { name: /Undo/ }));
      await waitFor(() =>
        expect(mocks.revertPatch).toHaveBeenCalledWith('patch-1'),
      );
      expect(
        await screen.findByRole('button', { name: /Put back/ }),
      ).toBeInTheDocument();
    },
  );

  it('shows a plain message and keeps the text when a link cannot be read', async () => {
    const user = userEvent.setup();
    mocks.importLink.mockRejectedValue(
      new Error("LinkedIn doesn't let other apps read its job pages."),
    );
    renderPage();

    await user.type(
      screen.getByLabelText('Paste the job'),
      'https://www.linkedin.com/jobs/view/1',
    );
    await user.click(screen.getByRole('button', { name: /Check my match/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Paste the job')).toHaveValue(
      'https://www.linkedin.com/jobs/view/1',
    );
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
});
