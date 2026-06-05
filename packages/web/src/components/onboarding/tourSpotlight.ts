const SPOTLIGHT_TARGET = 'applymate-tour-spotlight-target';
const SPOTLIGHT_CHAIN = 'applymate-tour-spotlight-chain';
const SPOTLIGHT_SHELL = 'applymate-tour-spotlight-shell';
const Z_BOOST_ATTR = 'data-applymate-tour-z-boost';

const MOBILE_SHELL_SELECTORS = [
  'nav[data-tour="mobile-bottom-nav"]',
  '[data-tour="mobile-jobs-sheet"]',
  '[data-tour="mobile-more-sheet"]',
] as const;

/** Above driver.js overlay (inline z-index 10000). */
export const TOUR_OVERLAY_Z = 10000;
export const TOUR_SPOTLIGHT_Z = 100001;
export const TOUR_POPOVER_Z = 1000000020;

function boostZIndex(node: HTMLElement): void {
  if (node.hasAttribute(Z_BOOST_ATTR)) return;
  node.setAttribute(Z_BOOST_ATTR, node.style.zIndex || '');
  node.style.zIndex = String(TOUR_SPOTLIGHT_Z);
}

function findMobileShell(element: Element): HTMLElement | null {
  for (const sel of MOBILE_SHELL_SELECTORS) {
    const shell = element.closest(sel);
    if (shell instanceof HTMLElement) return shell;
  }
  return null;
}

/** Lift the active target + ancestors above the overlay and strip blur/filters. */
export function applyTourSpotlight(
  element: Element | undefined,
  selector: string,
): void {
  if (typeof document === 'undefined') return;
  clearTourSpotlight();

  const el = (resolveTourHighlightTarget(element, selector) ??
    document.querySelector(selector)) as HTMLElement | null;
  if (!el) return;

  el.classList.add(SPOTLIGHT_TARGET);
  boostZIndex(el);

  const shell = findMobileShell(el);
  if (shell) {
    shell.classList.add(SPOTLIGHT_SHELL);
    boostZIndex(shell);
  }

  let parent = el.parentElement;
  while (parent && parent !== document.documentElement) {
    parent.classList.add(SPOTLIGHT_CHAIN);
    if (parent instanceof HTMLElement) {
      const tag = parent.tagName;
      const pos = getComputedStyle(parent).position;
      if (
        pos === 'fixed' ||
        pos === 'sticky' ||
        tag === 'ASIDE' ||
        tag === 'HEADER' ||
        tag === 'NAV'
      ) {
        boostZIndex(parent);
      }
    }
    parent = parent.parentElement;
  }
}

export function clearTourSpotlight(): void {
  if (typeof document === 'undefined') return;

  document.querySelectorAll(`.${SPOTLIGHT_TARGET}`).forEach((node) => {
    node.classList.remove(SPOTLIGHT_TARGET);
    if (node instanceof HTMLElement && node.hasAttribute(Z_BOOST_ATTR)) {
      const prev = node.getAttribute(Z_BOOST_ATTR) ?? '';
      if (prev) node.style.zIndex = prev;
      else node.style.removeProperty('z-index');
      node.removeAttribute(Z_BOOST_ATTR);
    }
  });

  document.querySelectorAll(`.${SPOTLIGHT_SHELL}`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.classList.remove(SPOTLIGHT_SHELL);
    if (node.hasAttribute(Z_BOOST_ATTR)) {
      const prev = node.getAttribute(Z_BOOST_ATTR) ?? '';
      if (prev) node.style.zIndex = prev;
      else node.style.removeProperty('z-index');
      node.removeAttribute(Z_BOOST_ATTR);
    }
  });

  document.querySelectorAll(`.${SPOTLIGHT_CHAIN}`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.classList.remove(SPOTLIGHT_CHAIN);
    if (node.hasAttribute(Z_BOOST_ATTR)) {
      const prev = node.getAttribute(Z_BOOST_ATTR) ?? '';
      if (prev) node.style.zIndex = prev;
      else node.style.removeProperty('z-index');
      node.removeAttribute(Z_BOOST_ATTR);
    }
  });
}

export function isDriverDummyElement(el: Element | null | undefined): boolean {
  return el?.id === 'driver-dummy-element';
}

/** Prefer the real DOM node over driver.js placeholder elements. */
export function resolveTourHighlightTarget(
  element: Element | undefined,
  selector: string,
): HTMLElement | null {
  if (element && !isDriverDummyElement(element) && element instanceof HTMLElement) {
    return element;
  }
  const found = document.querySelector(selector);
  return found instanceof HTMLElement ? found : null;
}

export function waitForTourTarget(
  selector: string,
  timeoutMs: number,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const found = document.querySelector(selector);
      if (found) {
        resolve(found);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}
