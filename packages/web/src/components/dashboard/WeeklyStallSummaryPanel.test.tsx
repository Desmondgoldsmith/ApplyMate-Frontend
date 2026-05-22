import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WeeklyStallSummaryPanel } from '@/components/dashboard/WeeklyStallSummaryPanel';

describe('WeeklyStallSummaryPanel', () => {
  it('renders state-aware revisit CTAs', () => {
    render(
      <WeeklyStallSummaryPanel
        data={{
          generatedAt: new Date().toISOString(),
          digestVersion: '1',
          eligible: true,
          reasonIfEmpty: null,
          totalCount: 3,
          showMoreHref: '/dashboard/next-moves',
          items: [
            {
              id: '1',
              kind: 'application',
              title: 'Frontend Engineer',
              company: 'Acme',
              stage: 'interviewing',
              ctaHint: 'OPEN_JOB_HUB',
              stallReasonCodes: [],
            },
            {
              id: '2',
              kind: 'analysis',
              title: 'Product Engineer',
              company: 'Zen',
              stage: 'needs tailoring',
              ctaHint: 'OPEN_JOB_ANALYZE',
              stallReasonCodes: [],
            },
          ],
        }}
        isLoading={false}
        isFetching={false}
        error={undefined}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText(/Prep interview/i)).toBeInTheDocument();
    expect(screen.getByText(/Tailor CV/i)).toBeInTheDocument();
  });
});

