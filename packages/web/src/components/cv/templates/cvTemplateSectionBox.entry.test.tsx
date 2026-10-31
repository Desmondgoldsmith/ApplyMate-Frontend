import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { cvTemplateSectionBox } from '@/components/cv/templates/cvTemplateSectionBox';

function Section({ fieldPath }: { fieldPath: string }) {
  return cvTemplateSectionBox(
    'experience',
    null,
    '',
    <div data-entry-id="__section-title__:experience">
      <h2>Experience</h2>
      <div data-entry-id="job-a">Job A</div>
      <div data-entry-id="job-b">Job B</div>
    </div>,
    'experience',
    [
      {
        field: 'Bullet 1',
        fieldPath,
        before: 'Built sites',
        after: 'Delivered 15+ sites',
        type: 'changed',
      },
    ],
    vi.fn(),
    vi.fn(),
  );
}

describe('AI suggestion placement', () => {
  it('shows the suggestion right under the entry it changes', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Section fieldPath="experience[1].bullets[0]" />);

    const card = screen.getByText('Use this').closest('[data-entry-id]');
    expect(card?.getAttribute('data-entry-id')).toBe('job-b');
  });

  it('keeps section-wide suggestions under the section', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<Section fieldPath="experience" />);

    const owner = screen.getByText('Use this').closest('[data-entry-id]');
    expect(owner).toBeNull();
  });
});
