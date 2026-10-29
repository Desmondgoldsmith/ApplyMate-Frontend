import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TailorChangeHighlights } from '@/components/dashboard/TailorChangeHighlights';

const props = {
  sectionType: 'summary',
  beforeRaw: JSON.stringify({ text: 'Backend engineer.' }),
  afterRaw: JSON.stringify({
    text: 'Backend engineer working with Kubernetes.',
  }),
  summary: 'Reflected Kubernetes in your summary',
};

describe('TailorChangeHighlights fact check', () => {
  it('lists what the fact check corrected', () => {
    render(
      <TailorChangeHighlights
        {...props}
        safetyNotes={['Left out figures that are not in your CV (40).']}
      />,
    );
    expect(screen.getByText('Fact check')).toBeInTheDocument();
    expect(
      screen.getByText('Left out figures that are not in your CV (40).'),
    ).toBeInTheDocument();
  });

  it('shows no fact-check block when nothing was corrected', () => {
    render(<TailorChangeHighlights {...props} />);
    expect(screen.queryByText('Fact check')).not.toBeInTheDocument();
  });
});
