import { describe, expect, it } from 'vitest';

import { computeTourLayout } from './welcomeTourLayout';

const desktop = { width: 1280, height: 800 };
const card = { width: 360, height: 200 };

describe('computeTourLayout', () => {
  it('places the card below a target near the top', () => {
    const layout = computeTourLayout(
      { top: 100, left: 300, width: 400, height: 150 },
      desktop,
      card,
    );
    expect(layout.popover).toMatchObject({
      mode: 'floating',
      placement: 'below',
    });
  });

  it('flips above when there is no room below', () => {
    const layout = computeTourLayout(
      { top: 560, left: 300, width: 400, height: 150 },
      desktop,
      card,
    );
    expect(layout.popover).toMatchObject({
      mode: 'floating',
      placement: 'above',
    });
  });

  it('uses the side for a tall sidebar item with no room above or below', () => {
    const layout = computeTourLayout(
      { top: 0, left: 0, width: 216, height: 800 },
      desktop,
      card,
    );
    expect(layout.popover).toMatchObject({
      mode: 'floating',
      placement: 'right',
    });
  });

  it('opens to the right of a sidebar item so the menu stays visible', () => {
    const layout = computeTourLayout(
      { top: 120, left: 8, width: 200, height: 42 },
      desktop,
      card,
    );
    expect(layout.popover).toMatchObject({
      mode: 'floating',
      placement: 'right',
    });
  });

  it('keeps the card inside the viewport horizontally', () => {
    const layout = computeTourLayout(
      { top: 20, left: 1240, width: 30, height: 30 },
      desktop,
      card,
    );
    if (layout.popover.mode !== 'floating')
      throw new Error('expected floating');
    expect(layout.popover.left + card.width).toBeLessThanOrEqual(desktop.width);
    expect(layout.popover.left).toBeGreaterThanOrEqual(0);
  });

  it('uses a bottom sheet on phones, moving to the top for low targets', () => {
    const phone = { width: 390, height: 844 };
    expect(
      computeTourLayout(
        { top: 120, left: 16, width: 358, height: 200 },
        phone,
        card,
      ).popover,
    ).toEqual({ mode: 'sheet', edge: 'bottom' });
    expect(
      computeTourLayout(
        { top: 780, left: 100, width: 60, height: 60 },
        phone,
        card,
      ).popover,
    ).toEqual({ mode: 'sheet', edge: 'top' });
  });

  it('pads the spotlight around the target', () => {
    const { spotlight } = computeTourLayout(
      { top: 100, left: 300, width: 400, height: 150 },
      desktop,
      card,
    );
    expect(spotlight).toEqual({ top: 92, left: 292, width: 416, height: 166 });
  });
});
