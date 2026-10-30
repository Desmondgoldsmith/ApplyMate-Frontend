import { render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { describe, expect, it } from 'vitest';

import {
  ForcedThemeScope,
  PortalThemeScope,
} from '@/components/theme/ThemeScope';

function PortalledProbe() {
  return createPortal(
    <PortalThemeScope>
      <span data-testid="probe">inside</span>
    </PortalThemeScope>,
    document.body,
  );
}

describe('ThemeScope', () => {
  it('pins its subtree to the forced theme', () => {
    render(
      <ForcedThemeScope theme="dark">
        <span data-testid="child">x</span>
      </ForcedThemeScope>,
    );
    expect(screen.getByTestId('child').closest('[data-theme]')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('carries the forced theme into portals', () => {
    render(
      <ForcedThemeScope theme="dark">
        <PortalledProbe />
      </ForcedThemeScope>,
    );
    expect(screen.getByTestId('probe').closest('[data-theme]')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('adds nothing to portals outside a forced scope', () => {
    render(<PortalledProbe />);
    expect(screen.getByTestId('probe').closest('[data-theme]')).toBeNull();
  });
});
