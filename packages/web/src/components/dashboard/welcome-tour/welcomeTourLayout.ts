export type Rect = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

export type TourLayout = {
  spotlight: Rect;
  popover:
    | { mode: 'sheet'; edge: 'top' | 'bottom' }
    | {
        mode: 'floating';
        placement: 'below' | 'above' | 'right' | 'left';
        top: number;
        left: number;
      };
};

export const SHEET_BREAKPOINT = 640;
const PAD = 8;
const GAP = 14;
const MARGIN = 12;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), Math.max(min, max));
}

/** Where to draw the highlight and the explanation card for one tour step. */
export function computeTourLayout(
  target: Rect,
  viewport: Size,
  popover: Size,
): TourLayout {
  const spotlight: Rect = {
    top: clamp(target.top - PAD, MARGIN / 2, viewport.height),
    left: clamp(target.left - PAD, MARGIN / 2, viewport.width),
    width: 0,
    height: 0,
  };
  const right = Math.min(
    target.left + target.width + PAD,
    viewport.width - MARGIN / 2,
  );
  const bottom = Math.min(
    target.top + target.height + PAD,
    viewport.height - MARGIN / 2,
  );
  spotlight.width = Math.max(0, right - spotlight.left);
  spotlight.height = Math.max(0, bottom - spotlight.top);

  if (viewport.width < SHEET_BREAKPOINT) {
    const targetMid = spotlight.top + spotlight.height / 2;
    return {
      spotlight,
      popover: {
        mode: 'sheet',
        edge: targetMid > viewport.height / 2 ? 'top' : 'bottom',
      },
    };
  }

  const centeredLeft = clamp(
    spotlight.left + spotlight.width / 2 - popover.width / 2,
    MARGIN,
    viewport.width - popover.width - MARGIN,
  );
  const centeredTop = clamp(
    spotlight.top + spotlight.height / 2 - popover.height / 2,
    MARGIN,
    viewport.height - popover.height - MARGIN,
  );

  const spotBottom = spotlight.top + spotlight.height;
  const spotRight = spotlight.left + spotlight.width;

  // Sidebar items: open to the right so the card doesn't cover the rest of the menu.
  const onLeftEdge = spotRight < viewport.width * 0.3;
  if (
    onLeftEdge &&
    spotRight + GAP + popover.width <= viewport.width - MARGIN
  ) {
    return {
      spotlight,
      popover: {
        mode: 'floating',
        placement: 'right',
        top: centeredTop,
        left: spotRight + GAP,
      },
    };
  }

  if (spotBottom + GAP + popover.height <= viewport.height - MARGIN) {
    return {
      spotlight,
      popover: {
        mode: 'floating',
        placement: 'below',
        top: spotBottom + GAP,
        left: centeredLeft,
      },
    };
  }
  if (spotlight.top - GAP - popover.height >= MARGIN) {
    return {
      spotlight,
      popover: {
        mode: 'floating',
        placement: 'above',
        top: spotlight.top - GAP - popover.height,
        left: centeredLeft,
      },
    };
  }
  if (spotRight + GAP + popover.width <= viewport.width - MARGIN) {
    return {
      spotlight,
      popover: {
        mode: 'floating',
        placement: 'right',
        top: centeredTop,
        left: spotRight + GAP,
      },
    };
  }
  if (spotlight.left - GAP - popover.width >= MARGIN) {
    return {
      spotlight,
      popover: {
        mode: 'floating',
        placement: 'left',
        top: centeredTop,
        left: spotlight.left - GAP - popover.width,
      },
    };
  }
  // Target fills the screen: overlay the card near the bottom, still inside the viewport.
  return {
    spotlight,
    popover: {
      mode: 'floating',
      placement: 'below',
      top: viewport.height - popover.height - MARGIN,
      left: centeredLeft,
    },
  };
}

/** First element with this `data-tour` value that is actually rendered and has a size. */
export function findVisibleTourTarget(target: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(
    `[data-tour="${CSS.escape(target)}"]`,
  );
  for (const el of nodes) {
    if (el.getClientRects().length === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}
