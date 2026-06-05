export type MobilePopoverPlacement = 'below' | 'above' | 'fallback';

const GAP_PX = 12;
const EDGE_PX = 12;
const DEFAULT_POP_H = 240;

function targetRect(element: Element | null | undefined): DOMRect | null {
  if (!element || typeof window === 'undefined') return null;
  return element.getBoundingClientRect();
}

export function clearTourPopoverInlinePosition(wrap: HTMLElement): void {
  wrap.style.removeProperty('bottom');
  wrap.style.removeProperty('left');
  wrap.style.removeProperty('right');
  wrap.style.removeProperty('top');
  wrap.style.removeProperty('transform');
  wrap.style.removeProperty('max-height');
  wrap.style.removeProperty('overflow-y');
}

/** Pin the tour card next to the spotlight target — never on top of it. */
export function applyMobileTourPopoverPosition(
  wrap: HTMLElement,
  element: Element | null | undefined,
): MobilePopoverPlacement {
  clearTourPopoverInlinePosition(wrap);

  const rect = targetRect(element);
  if (!rect || typeof window === 'undefined') return 'fallback';

  wrap.style.setProperty('position', 'fixed', 'important');
  wrap.style.setProperty('left', '16px', 'important');
  wrap.style.setProperty('right', '16px', 'important');
  wrap.style.setProperty('margin', '0 auto', 'important');
  wrap.style.setProperty('max-width', 'calc(100vw - 32px)', 'important');
  wrap.style.setProperty('transform', 'none', 'important');

  const vh = window.innerHeight;
  const popH = wrap.offsetHeight > 48 ? wrap.offsetHeight : DEFAULT_POP_H;

  const spaceBelow = vh - rect.bottom - EDGE_PX;
  const spaceAbove = rect.top - EDGE_PX;

  // Prefer below for header/top targets; above for bottom nav / sheets.
  const placeBelow =
    rect.top < vh * 0.45 &&
    (spaceBelow >= 120 || spaceBelow >= spaceAbove);

  if (placeBelow) {
    const top = Math.min(rect.bottom + GAP_PX, vh - popH - EDGE_PX);
    wrap.style.setProperty('top', `${Math.max(EDGE_PX, top)}px`, 'important');
    wrap.style.setProperty('bottom', 'auto', 'important');
    wrap.style.setProperty(
      'max-height',
      `${Math.max(120, spaceBelow - GAP_PX)}px`,
      'important',
    );
    wrap.style.setProperty('overflow-y', 'auto');
    return 'below';
  }

  const bottom = Math.max(EDGE_PX, vh - rect.top + GAP_PX);
  wrap.style.setProperty('top', 'auto', 'important');
  wrap.style.setProperty('bottom', `${bottom}px`, 'important');
  wrap.style.setProperty(
    'max-height',
    `${Math.max(120, Math.min(vh * 0.42, spaceAbove - GAP_PX))}px`,
    'important',
  );
  wrap.style.setProperty('overflow-y', 'auto');
  return 'above';
}

export function refineMobileTourPopoverPosition(
  wrap: HTMLElement,
  element: Element | null | undefined,
): MobilePopoverPlacement {
  return applyMobileTourPopoverPosition(wrap, element);
}
