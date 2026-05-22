import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CvImprovementDiffTruthPanel } from '@/components/cv/CvImprovementDiffTruthPanel';
import { CvDiffActionsBusyContext, CvDiffActionPair } from '@/components/cv/cvDiffImprovementActions';

describe('CvImprovementDiffTruthPanel', () => {
  it('renders transparency lines with no metadata', () => {
    render(<CvImprovementDiffTruthPanel meta={{}} />);
    expect(
      screen.getByText(/Generated using only information already present in your CV/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/No facts or achievements were invented/i)).toBeInTheDocument();
  });

  it('shows Fact-checked badge when factualityValidated is true', () => {
    render(<CvImprovementDiffTruthPanel meta={{ factualityValidated: true }} />);
    expect(screen.getByText('Fact-checked')).toBeInTheDocument();
  });

  it('shows optimized note when token telemetry is present', () => {
    render(<CvImprovementDiffTruthPanel meta={{}} performance={{ totalTokenCount: 1200 }} />);
    expect(screen.getByTestId('cv-ai-telemetry-note')).toHaveTextContent(/Optimized for speed and accuracy/i);
  });

  it('shows cache-hit note when performance.cacheHit is true', () => {
    render(<CvImprovementDiffTruthPanel meta={{}} performance={{ cacheHit: true }} />);
    expect(screen.getByTestId('cv-apply-cache-hit-note')).toHaveTextContent(/previously generated preview/i);
  });

  it('shows adjustment notice and warnings when truthfulnessWarnings are present', () => {
    render(
      <CvImprovementDiffTruthPanel
        meta={{
          factualityValidated: false,
          truthfulnessWarnings: ['An unsupported technology was discarded.', 'A new metric was removed.'],
        }}
      />,
    );
    expect(
      screen.getByText(/Some suggested changes were removed or adjusted/i),
    ).toBeInTheDocument();
    expect(screen.getByText('An unsupported technology was discarded.')).toBeInTheDocument();
    expect(screen.getByText('A new metric was removed.')).toBeInTheDocument();
  });

  it('shows unsupported count when provided', () => {
    render(<CvImprovementDiffTruthPanel meta={{ unsupportedChangesDetected: 3 }} />);
    expect(screen.getByText(/Unsupported or reverted edits detected: 3/i)).toBeInTheDocument();
  });
});

describe('CV diff actions unchanged when truth panel present', () => {
  it(
    'accept/reject handlers still fire (smoke)',
    async () => {
      const user = userEvent.setup();
      const onAccept = vi.fn();
      const onReject = vi.fn();

      render(
        <CvDiffActionsBusyContext.Provider value={false}>
          <div>
            <CvImprovementDiffTruthPanel meta={{ truthfulnessWarnings: ['x'] }} />
            <CvDiffActionPair
              acceptLabel="Accept"
              rejectLabel="Reject"
              onAccept={onAccept}
              onReject={onReject}
            />
          </div>
        </CvDiffActionsBusyContext.Provider>,
      );

      await user.click(screen.getByRole('button', { name: /accept/i }));
      await user.click(screen.getByRole('button', { name: /reject/i }));
      expect(onAccept).toHaveBeenCalledTimes(1);
      expect(onReject).toHaveBeenCalledTimes(1);
    },
    15_000,
  );
});
