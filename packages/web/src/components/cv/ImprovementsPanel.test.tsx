import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { ImprovementsPanel } from '@/components/cv/ImprovementsPanel';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

const reconcileAfterMutationFn = vi.hoisted(() => vi.fn(() => 2));

vi.mock('@/hooks/useCvSuggestionMutations', () => ({
  useCvSuggestionMutations: () => ({
    reconcileAfterMutation: reconcileAfterMutationFn,
    suggestionsQueryKey: cvSuggestionsQueryKey,
  }),
}));

vi.mock('@/lib/cvSuggestionMutationReconcile', () => ({
  logCvSuggestionMutationClientPerf: vi.fn(),
}));

const toastSuccess = vi.fn();
const toastInfo = vi.fn();
const toastError = vi.fn();

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
  }),
}));

const { applyImprovement, rejectSuggestion, selfFixSuggestion } = vi.hoisted(() => ({
  applyImprovement: vi.fn().mockResolvedValue({
    success: true,
    pointer: 'imp-1',
    improvementId: 'imp-1',
    section: 'summary',
    before: {},
    after: {},
    changedFields: [],
    draftHash: null,
    message: '',
  }),
  rejectSuggestion: vi
    .fn()
    .mockResolvedValue({ pendingSuggestionsCount: 0, cvRevisionId: null }),
  selfFixSuggestion: vi
    .fn()
    .mockResolvedValue({ pendingSuggestionsCount: 1, cvRevisionId: null }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    cv: {
      applyImprovement,
      rejectSuggestion,
      selfFixSuggestion,
    },
  },
}));

describe('ImprovementsPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reconcileAfterMutationFn).mockReturnValue(2);
    applyImprovement.mockResolvedValue({
      success: true,
      pointer: 'imp-1',
      improvementId: 'imp-1',
      section: 'summary',
      before: {},
      after: {},
      changedFields: [],
      draftHash: null,
      message: '',
    });
  });

  it('Apply with AI calls applyImprovement and opens diff preview', async () => {
    const user = userEvent.setup();
    const onDiffPreview = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
          ]}
          onDiffPreview={onDiffPreview}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /fix with ai/i }));

    expect(applyImprovement).toHaveBeenCalledWith('imp-1', undefined);
    expect(onDiffPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        pointer: 'imp-1',
        changedFields: [],
      }),
    );
  });

  it('does not fire a second applyImprovement while the first request is still pending', async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let resolveApply: (value: unknown) => void;
    const applyPromise = new Promise((resolve) => {
      resolveApply = resolve;
    });
    applyImprovement.mockImplementation(() => applyPromise);

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
          ]}
          onDiffPreview={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const btn = screen.getByRole('button', { name: /fix with ai/i });
    await user.click(btn);
    await user.click(btn);

    expect(applyImprovement).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveApply!({
        success: true,
        pointer: 'imp-1',
        improvementId: 'imp-1',
        section: 'summary',
        before: {},
        after: {},
        changedFields: [],
        draftHash: null,
        message: '',
      });
    });
  });

  it('duplicateSuppressed without terminal flags keeps the row pending and opens cached preview', async () => {
    const user = userEvent.setup();
    const onDiffPreview = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(cvSuggestionsQueryKey('p1'), {
      improvements: [
        { id: 'imp-1', issue: 'A', resolved: false },
        { id: 'imp-2', issue: 'B', resolved: false },
      ],
      pendingSuggestionsCount: 2,
    });
    applyImprovement.mockResolvedValue({
      success: true,
      pointer: 'imp-1',
      improvementId: 'imp-1',
      suggestionId: 'imp-1',
      section: 'summary',
      before: {},
      after: {},
      changedFields: [],
      draftHash: 'h1',
      message: '',
      duplicateSuppressed: true,
      pendingSuggestionsCount: 2,
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          profileId="p1"
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
            { id: 'imp-2', issue: 'Other', resolved: false },
          ]}
          onDiffPreview={onDiffPreview}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /fix with ai/i }));

    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining('saved preview'),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onDiffPreview).toHaveBeenCalled();
    const data = qc.getQueryData<{
      improvements: { id?: string }[];
      pendingSuggestionsCount?: number;
    }>(cvSuggestionsQueryKey('p1'));
    expect(data?.improvements?.map((i) => i.id)).toEqual(['imp-1', 'imp-2']);
    expect(data?.pendingSuggestionsCount).toBe(2);
  });

  it('cacheHit without queue-clear flags still opens diff preview', async () => {
    const user = userEvent.setup();
    const onDiffPreview = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    applyImprovement.mockResolvedValue({
      success: true,
      pointer: 'imp-1',
      improvementId: 'imp-1',
      section: 'summary',
      before: {},
      after: {},
      changedFields: [],
      draftHash: 'h1',
      message: '',
      cacheHit: true,
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
          ]}
          onDiffPreview={onDiffPreview}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /fix with ai/i }));

    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringMatching(/previously generated preview/i),
    );
    expect(onDiffPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        performance: expect.objectContaining({ cacheHit: true }),
      }),
    );
  });

  it('shows reassuring loading copy while apply is pending', async () => {
    let resolveApply: (value: unknown) => void;
    applyImprovement.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApply = resolve;
        }),
    );
    const user = userEvent.setup();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
          ]}
          onDiffPreview={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /fix with ai/i }));
    expect(
      screen.getByRole('button', { name: /Applying suggestion/i }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveApply!({
        success: true,
        pointer: 'imp-1',
        improvementId: 'imp-1',
        section: 'summary',
        before: {},
        after: {},
        changedFields: [],
        draftHash: null,
        message: '',
      });
    });
    expect(
      screen.getByRole('button', { name: /^fix with ai$/i }),
    ).toBeInTheDocument();
  });

  it("'I'll fix it myself' removes exactly the clicked suggestion (not a neighbour)", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          improvements={[
            { id: 'imp-1', issue: 'First issue headline', resolved: false },
            { id: 'imp-2', issue: 'Second issue headline', resolved: false },
            { id: 'imp-3', issue: 'Third issue headline', resolved: false },
          ]}
          onDiffPreview={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // First card is visible; the others are reachable via the navigator.
    expect(screen.getByText('First issue headline')).toBeInTheDocument();
    expect(screen.getByText(/of 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /fix it myself/i }));

    expect(selfFixSuggestion).toHaveBeenCalledTimes(1);
    expect(selfFixSuggestion).toHaveBeenCalledWith('imp-1', undefined);

    // Exactly one removed: the clicked one is gone, the other two remain.
    expect(screen.queryByText('First issue headline')).not.toBeInTheDocument();
    expect(screen.getByText('Second issue headline')).toBeInTheDocument();
    expect(screen.getByText(/of 2/i)).toBeInTheDocument();
  });

  it('autoResolved removes the suggestion from cache and skips diff preview', async () => {
    const user = userEvent.setup();
    const onDiffPreview = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(cvSuggestionsQueryKey('p1'), {
      improvements: [{ id: 'imp-1', issue: 'T', resolved: false }],
      pendingSuggestionsCount: 1,
    });
    applyImprovement.mockResolvedValue({
      success: true,
      pointer: 'imp-1',
      improvementId: 'imp-1',
      section: 'summary',
      before: {},
      after: {},
      changedFields: [],
      draftHash: null,
      message: '',
      autoResolved: true,
      pendingSuggestionsCount: 0,
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          profileId="p1"
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
          ]}
          onDiffPreview={onDiffPreview}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /fix with ai/i }));

    expect(toastSuccess).toHaveBeenCalledWith(
      'This improvement is already reflected in your CV.',
    );
    expect(onDiffPreview).not.toHaveBeenCalled();
    const data = qc.getQueryData<{
      improvements: { id?: string }[];
      pendingSuggestionsCount?: number;
    }>(cvSuggestionsQueryKey('p1'));
    expect(data?.improvements ?? []).toHaveLength(0);
    expect(data?.pendingSuggestionsCount).toBe(0);
  });

  it('alreadyApplied and autoResolved uses handoff success copy and removes the row', async () => {
    const user = userEvent.setup();
    const onDiffPreview = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(cvSuggestionsQueryKey('p1'), {
      improvements: [{ id: 'imp-1', issue: 'T', resolved: false }],
      pendingSuggestionsCount: 1,
    });
    applyImprovement.mockResolvedValue({
      success: true,
      pointer: 'imp-1',
      improvementId: 'imp-1',
      section: 'summary',
      before: {},
      after: {},
      changedFields: [],
      draftHash: '',
      message: 'Marked applied',
      alreadyApplied: true,
      autoResolved: true,
      pendingSuggestionsCount: 0,
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          profileId="p1"
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
          ]}
          onDiffPreview={onDiffPreview}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /fix with ai/i }));

    expect(toastSuccess).toHaveBeenCalledWith(
      'Applied — your CV already matched this suggestion.',
    );
    expect(onDiffPreview).not.toHaveBeenCalled();
  });

  it('alreadyApplied removes item from cache, updates pending count, shows success toast, skips preview', async () => {
    const user = userEvent.setup();
    const onDiffPreview = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(cvSuggestionsQueryKey('p1'), {
      improvements: [
        { id: 'imp-1', issue: 'T', resolved: false },
        { id: 'imp-2', issue: 'U', resolved: false },
      ],
      pendingSuggestionsCount: 2,
    });
    applyImprovement.mockResolvedValue({
      success: true,
      pointer: 'imp-1',
      improvementId: 'imp-1',
      section: 'summary',
      before: {},
      after: {},
      changedFields: [],
      draftHash: null,
      message: '',
      alreadyApplied: true,
      pendingSuggestionsCount: 1,
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          profileId="p1"
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
            { id: 'imp-2', issue: 'Other', resolved: false },
          ]}
          onDiffPreview={onDiffPreview}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /fix with ai/i }));

    expect(toastSuccess).toHaveBeenCalledWith(
      'This improvement is already reflected in your CV.',
    );
    expect(onDiffPreview).not.toHaveBeenCalled();
    const data = qc.getQueryData<{
      improvements: { id?: string }[];
      pendingSuggestionsCount?: number;
    }>(cvSuggestionsQueryKey('p1'));
    expect(data?.improvements?.map((i) => i.id)).toEqual(['imp-2']);
    expect(data?.pendingSuggestionsCount).toBe(1);
  });

  it('reject idempotent shows neutral success copy', async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const refetchSpy = vi.spyOn(qc, 'refetchQueries');
    qc.setQueryData(cvSuggestionsQueryKey('p1'), {
      improvements: [{ id: 'imp-1', issue: 'T', resolved: false }],
      needsScoring: false,
    });
    rejectSuggestion.mockResolvedValue({
      pendingSuggestionsCount: 0,
      cvRevisionId: null,
      idempotent: true,
    });

    render(
      <QueryClientProvider client={qc}>
        <ImprovementsPanel
          profileId="p1"
          improvements={[
            { id: 'imp-1', issue: 'Improve headline', resolved: false },
          ]}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(toastSuccess).toHaveBeenCalledWith('Already dismissed.');
    const reconcileCalls = vi.mocked(reconcileAfterMutationFn).mock
      .calls as unknown as [string, string][];
    expect(reconcileCalls[0]?.[0]).toBe('p1');
    expect(reconcileCalls[0]?.[1]).toBe('queueOnly');
    expect(refetchSpy).not.toHaveBeenCalled();
    const data = qc.getQueryData<{ improvements: { id?: string }[] }>([
      'cv',
      'suggestions',
      'p1',
    ]);
    expect(data?.improvements ?? []).toHaveLength(0);
  });
});

