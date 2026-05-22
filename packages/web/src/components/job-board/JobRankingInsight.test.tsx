import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JobRankingInsight } from '@/components/job-board/JobRankingInsight';
import type { JobListingDto } from '@/lib/api';

function renderInsight(job: JobListingDto) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <JobRankingInsight job={job} />
    </QueryClientProvider>,
  );
}

const recordDecision = vi.fn().mockResolvedValue({ id: 'd1', decision: 'APPLY' });

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      jobDiscovery: {
        ...actual.api.jobDiscovery,
        recordDecision: (...args: unknown[]) => recordDecision(...args),
      },
    },
  };
});

const sampleJob: JobListingDto = {
  id: 'job-1',
  title: 'Senior React Developer',
  company: 'Acme',
  location: 'Remote',
  description: 'Build products with React.',
  ranking: {
    score: 81,
    tier: 'APPLY_NOW',
    recommendation: 'Strong fit — prioritize this application.',
  },
  explanation: {
    matchedSkills: ['React', 'TypeScript'],
    missingSkills: ['Kotlin'],
    riskFactors: ['Requires some Kotlin exposure'],
    seniorityMismatch: 'none',
    whyThisJob: 'Your CV aligns well with React requirements.',
    recommendation: 'Tailor your summary to emphasize lead-level delivery.',
  },
};

describe('JobRankingInsight', () => {
  it('renders explainability sections and records Apply decision', async () => {
    recordDecision.mockClear();
    renderInsight(sampleJob);

    expect(screen.getByText('Why this job')).toBeInTheDocument();
    expect(screen.getByText(/Your CV aligns well/)).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Kotlin')).toBeInTheDocument();
    expect(screen.getByText(/Requires some Kotlin exposure/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(recordDecision).toHaveBeenCalledWith('job-1', 'APPLY');
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Saved/);
  });

  it('returns null when ranking and explanation are absent', () => {
    const { container } = renderInsight({
      ...sampleJob,
      ranking: undefined,
      explanation: undefined,
    });
    expect(container).toBeEmptyDOMElement();
  });
});
