import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AISectionAssistantPanel } from '@/components/cv/AISectionAssistantPanel';

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

describe('AISectionAssistantPanel seed command', () => {
  it('fills the textarea when opened with seedCommand and calls onSeedCommandConsumed', () => {
    const onConsumed = vi.fn();
    const seed = 'Using only facts already in my CV, suggest concise edits for Docker and Kubernetes.';
    const { rerender } = render(
      <AISectionAssistantPanel
        open={false}
        onOpenChange={() => {}}
        busy={false}
        onSubmit={async () => {}}
        seedCommand={seed}
        onSeedCommandConsumed={onConsumed}
      />,
    );

    rerender(
      <AISectionAssistantPanel
        open
        onOpenChange={() => {}}
        busy={false}
        onSubmit={async () => {}}
        seedCommand={seed}
        onSeedCommandConsumed={onConsumed}
      />,
    );

    expect(screen.getByPlaceholderText(/Complete my summary/i)).toHaveValue(seed);
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });
});
