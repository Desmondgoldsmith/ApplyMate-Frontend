import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CvBulletHelper,
  bulletRoleContext,
} from '@/components/cv/CvBulletHelper';
import type { CVEditContextValue } from '@/components/cv/CVEditContext';
import { CVEditProvider } from '@/components/cv/CVEditContext';
import type { CVBuilderData } from '@/lib/cvBuilder';

const { suggestBulletWordings } = vi.hoisted(() => ({
  suggestBulletWordings: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: { cv: { suggestBulletWordings } } }));

const data = {
  experience: {
    items: [
      {
        id: 'e1',
        title: 'Frontend Developer',
        company: 'Hubtel',
        location: '',
        startDate: '',
        endDate: '',
        current: true,
        bullets: ['fixed checkout bugs'],
      },
    ],
  },
} as unknown as CVBuilderData;

function renderEditor() {
  const value = { isEditing: true, data } as unknown as CVEditContextValue;
  render(
    <CVEditProvider value={value}>
      <div data-cv-document-root="">
        <span
          contentEditable="true"
          suppressContentEditableWarning
          role="textbox"
          aria-label="Bullet"
          data-bullet-entry="e1"
          data-bullet-idx="0"
        >
          fixed checkout bugs
        </span>
      </div>
      <CvBulletHelper />
    </CVEditProvider>,
  );
  const bullet = screen.getByRole('textbox', { name: 'Bullet' });
  act(() => bullet.focus());
  return bullet;
}

describe('CvBulletHelper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('names the role a bullet belongs to', () => {
    expect(bulletRoleContext(data, 'e1')).toBe('Frontend Developer at Hubtel');
    expect(bulletRoleContext(data, 'missing')).toBeUndefined();
  });

  it('offers better wordings and types the chosen one into the bullet', async () => {
    const user = userEvent.setup();
    suggestBulletWordings.mockResolvedValue({
      suggestions: ['Resolved checkout bugs blocking payments'],
      question: null,
    });
    const bullet = renderEditor();
    const onInput = vi.fn();
    bullet.addEventListener('input', onInput);

    await user.click(
      await screen.findByRole('button', { name: 'Improve this bullet' }),
    );
    expect(suggestBulletWordings).toHaveBeenCalledWith({
      bullet: 'fixed checkout bugs',
      context: 'Frontend Developer at Hubtel',
    });
    await user.click(
      await screen.findByRole('button', {
        name: /Resolved checkout bugs blocking payments/,
      }),
    );

    expect(bullet.textContent).toBe('Resolved checkout bugs blocking payments');
    expect(onInput).toHaveBeenCalled();
    expect(document.activeElement).not.toBe(bullet);
  });

  it('asks for a real number and rewrites with the answer', async () => {
    const user = userEvent.setup();
    suggestBulletWordings
      .mockResolvedValueOnce({ suggestions: [], question: 'How many orders?' })
      .mockResolvedValueOnce({
        suggestions: ['Resolved checkout bugs on 2,000 daily orders'],
        question: null,
      });
    renderEditor();

    await user.click(
      await screen.findByRole('button', { name: 'Improve this bullet' }),
    );
    const answer = await screen.findByLabelText('How many orders?');
    await user.type(answer, '2,000 a day');
    fireEvent.submit(answer.closest('form')!);

    await waitFor(() =>
      expect(suggestBulletWordings).toHaveBeenLastCalledWith(
        expect.objectContaining({ fact: '2,000 a day' }),
      ),
    );
    expect(
      await screen.findByRole('button', { name: /2,000 daily orders/ }),
    ).toBeInTheDocument();
  });
});
