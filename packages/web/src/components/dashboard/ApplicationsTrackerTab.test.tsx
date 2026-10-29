import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationsTrackerTab } from '@/components/dashboard/ApplicationsTrackerTab';
import {
  AI_QUOTA_UPGRADE_HINT,
  DAILY_AI_LIMIT_REACHED_MESSAGE,
  type DailyAiUsage,
} from '@/lib/ai-daily-usage';
import type { ApplicationItem } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

const { getFollowUpDraft, invalidateDailyAiUsageQuery, dailyAiUsage } =
  vi.hoisted(() => ({
    getFollowUpDraft: vi.fn(),
    invalidateDailyAiUsageQuery: vi.fn(),
    dailyAiUsage: vi.fn(),
  }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/components/ui/CompanyLogo', () => ({
  CompanyLogo: () => null,
}));

const APPLICATION: ApplicationItem = {
  id: 'app-1',
  title: 'Frontend Engineer',
  company: 'Acme',
  status: 'applied',
  createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
};

vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => ({ data: [APPLICATION], isLoading: false }),
}));

vi.mock('@/hooks/useApplicationMutations', () => ({
  useUpdateApplicationStatus: () => ({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
}));

vi.mock('@/hooks/useDailyAiUsage', () => ({
  useDailyAiUsage: dailyAiUsage,
}));

vi.mock('@/lib/ai-daily-usage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-daily-usage')>()),
  invalidateDailyAiUsageQuery,
}));

vi.mock('@/lib/api', () => ({
  api: { applications: { getFollowUpDraft } },
}));

function usage(overrides: Partial<DailyAiUsage>): DailyAiUsage {
  return {
    used: 3,
    limit: 10,
    remaining: 7,
    dayKey: 'UTC',
    isLimited: true,
    isPaidTier: false,
    isLoading: false,
    ...overrides,
  };
}

const requestConfig = {
  url: '/applications/app-1/follow-up-draft',
  headers: new AxiosHeaders(),
} as InternalAxiosRequestConfig;

function apiError(
  status: number,
  error: { code?: string; message: string },
): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    requestConfig,
    undefined,
    {
      data: { success: false, error: { statusCode: status, ...error } },
      status,
      statusText: '',
      headers: {},
      config: requestConfig,
    },
  );
}

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ApplicationsTrackerTab />
    </QueryClientProvider>,
  );
  return queryClient;
}

function followUpButton() {
  return screen.getByRole('button', { name: 'Get follow-up email' });
}

describe('ApplicationsTrackerTab follow-up draft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dailyAiUsage.mockReturnValue(usage({}));
    useAuthStore.setState({ accessToken: 'token-1' });
  });

  it('refreshes the daily AI usage badge after a successful draft', async () => {
    getFollowUpDraft.mockResolvedValueOnce({
      subject: 'Checking in',
      body: 'Hi team',
    });
    const user = userEvent.setup();
    const queryClient = renderTab();

    await user.click(followUpButton());

    expect(await screen.findByText('Checking in')).toBeInTheDocument();
    expect(getFollowUpDraft).toHaveBeenCalledWith('app-1');
    expect(invalidateDailyAiUsageQuery).toHaveBeenCalledTimes(1);
    expect(invalidateDailyAiUsageQuery).toHaveBeenCalledWith(
      queryClient,
      'token-1',
    );
  });

  it('shows the standard daily-limit message on 429 DAILY_AI_LIMIT_REACHED', async () => {
    getFollowUpDraft.mockRejectedValueOnce(
      apiError(429, {
        code: 'DAILY_AI_LIMIT_REACHED',
        message: 'Daily free AI limit reached. Try again tomorrow.',
      }),
    );
    const user = userEvent.setup();
    renderTab();

    await user.click(followUpButton());

    expect(
      await screen.findByText(
        `${DAILY_AI_LIMIT_REACHED_MESSAGE} ${AI_QUOTA_UPGRADE_HINT}`,
      ),
    ).toBeInTheDocument();
    expect(invalidateDailyAiUsageQuery).toHaveBeenCalledTimes(1);
  });

  it('keeps the API message for other errors', async () => {
    getFollowUpDraft.mockRejectedValueOnce(
      apiError(400, {
        code: 'BAD_REQUEST',
        message: 'Application is not in applied status.',
      }),
    );
    const user = userEvent.setup();
    renderTab();

    await user.click(followUpButton());

    expect(
      await screen.findByText('Application is not in applied status.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(AI_QUOTA_UPGRADE_HINT)),
    ).not.toBeInTheDocument();
    expect(invalidateDailyAiUsageQuery).not.toHaveBeenCalled();
  });

  it('disables the draft button when a free user has no AI uses left', () => {
    dailyAiUsage.mockReturnValue(usage({ used: 10, remaining: 0 }));
    renderTab();

    expect(followUpButton()).toBeDisabled();
    expect(followUpButton()).toHaveAttribute('title', 'Daily AI limit reached');
    expect(
      screen.getByText('Daily free AI limit reached.'),
    ).toBeInTheDocument();
  });

  it('keeps the draft button enabled for paid users', () => {
    dailyAiUsage.mockReturnValue(
      usage({
        used: 40,
        limit: null,
        remaining: null,
        isLimited: false,
        isPaidTier: true,
      }),
    );
    renderTab();

    expect(followUpButton()).toBeEnabled();
    expect(
      screen.queryByText('Daily free AI limit reached.'),
    ).not.toBeInTheDocument();
  });
});
