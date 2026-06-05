import { render, screen, fireEvent } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AIGlobalAssistantPanel } from '@/components/cv/AIGlobalAssistantPanel';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock('@/components/dashboard/MobileShellContext', () => ({
  useMobileShell: () => ({ navBottomOffset: '0px' }),
}));

describe('AIGlobalAssistantPanel seed command', () => {
  it('fills the textarea when opened with seedCommand and calls onSeedCommandConsumed', () => {
    const onConsumed = vi.fn();
    const seed =
      'Using only facts already in my CV, suggest concise edits for Docker and Kubernetes.';
    const { rerender } = render(
      <AIGlobalAssistantPanel
        open={false}
        onOpenChange={() => {}}
        busy={false}
        operations={[]}
        onSubmit={async () => {}}
        seedCommand={seed}
        onSeedCommandConsumed={onConsumed}
      />,
    );

    rerender(
      <AIGlobalAssistantPanel
        open
        onOpenChange={() => {}}
        busy={false}
        operations={[]}
        onSubmit={async () => {}}
        seedCommand={seed}
        onSeedCommandConsumed={onConsumed}
      />,
    );

    expect(
      screen.getByPlaceholderText(/Standardise all date formats/i),
    ).toHaveValue(seed);
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  it('fills the textarea when a preset is clicked without submitting', async () => {
    const onSubmit = vi.fn();
    render(
      <AIGlobalAssistantPanel
        open
        onOpenChange={() => {}}
        busy={false}
        operations={[]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Recruiter scan/i }));

    expect(screen.getByTestId('cv-global-assistant-command')).toHaveValue(
      'Apply a recruiter scan and return findings.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
