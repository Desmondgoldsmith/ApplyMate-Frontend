import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  cvTemplateSectionBox,
  type CvTemplateSectionChangedField,
} from '@/components/cv/templates/cvTemplateSectionBox';

const change = (
  fieldPath: string,
  over: Partial<CvTemplateSectionChangedField> = {},
): CvTemplateSectionChangedField => ({
  field: fieldPath,
  fieldPath,
  before: `old ${fieldPath}`,
  after: `new ${fieldPath}`,
  type: 'changed',
  ...over,
});

function Section({
  changes,
  onAccept = vi.fn(),
  version = 0,
  diffSection = 'experience',
}: {
  changes: CvTemplateSectionChangedField[];
  onAccept?: (i?: number) => void;
  version?: number;
  diffSection?: string;
}) {
  return cvTemplateSectionBox(
    'experience',
    null,
    '',
    <div data-entry-id="__section-title__:experience">
      <h2>Experience</h2>
      <div key={`a-${version}`} data-entry-id="job-a">
        Job A
      </div>
      <div key={`b-${version}`} data-entry-id="job-b">
        Job B
      </div>
    </div>,
    diffSection,
    changes,
    onAccept,
    vi.fn(),
  );
}

describe('AI suggestion placement', () => {
  it('shows the suggestion right under the entry it changes', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Section changes={[change('experience[1].bullets[0]')]} />);

    const card = screen.getByText('Use this').closest('[data-entry-id]');
    expect(card?.getAttribute('data-entry-id')).toBe('job-b');
  });

  it('keeps section-wide suggestions under the section', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Section changes={[change('experience')]} />);

    expect(screen.getByText('Use this').closest('[data-entry-id]')).toBeNull();
  });

  it('stays under its entry when the entry re-renders as a new element', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const changes = [change('experience[1].bullets[0]')];
    const { rerender } = render(<Section changes={changes} version={0} />);

    act(() => {
      rerender(<Section changes={changes} version={1} />);
    });

    const card = screen.getByText('Use this').closest('[data-entry-id]');
    expect(card?.getAttribute('data-entry-id')).toBe('job-b');
  });

  it('accepts one change by its index in the whole preview', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onAccept = vi.fn();
    render(
      <Section
        changes={[change('summary'), change('experience[1].bullets[0]')]}
        onAccept={onAccept}
        diffSection="summary"
      />,
    );

    fireEvent.click(screen.getByText('Use this'));
    expect(onAccept).toHaveBeenCalledWith(1);
  });

  it('offers one pair of buttons for Ask AI changes that apply per section', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onAccept = vi.fn();
    render(
      <Section
        changes={[
          change('experience[0].bullets[0]', { sectionDiffIndex: 2 }),
          change('experience[1].bullets[0]', { sectionDiffIndex: 2 }),
        ]}
        onAccept={onAccept}
      />,
    );

    expect(screen.queryByText('Use this')).toBeNull();
    fireEvent.click(screen.getByText('Use these 2 changes'));
    expect(onAccept).toHaveBeenCalledWith(2);
  });
});
