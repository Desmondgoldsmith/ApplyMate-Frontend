/** Lock dashboard scroll while the product tour is active. */

let lockedMain: HTMLElement | null = null;
let savedMainOverflow = '';
let savedBodyOverflow = '';

export function lockTourScroll(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add('applymate-tour-scroll-lock');
  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const main = document.querySelector(
    'main.dashboard-app-canvas-bg',
  ) as HTMLElement | null;
  if (main) {
    lockedMain = main;
    savedMainOverflow = main.style.overflow;
    main.style.overflow = 'hidden';
  }
}

export function unlockTourScroll(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('applymate-tour-scroll-lock');
  document.body.style.overflow = savedBodyOverflow;
  if (lockedMain) {
    lockedMain.style.overflow = savedMainOverflow;
    lockedMain = null;
  }
}

export function bindTourScrollPrevent(
  isActive: () => boolean,
): () => void {
  const block = (e: Event) => {
    if (!isActive()) return;
    e.preventDefault();
  };
  document.addEventListener('wheel', block, { passive: false, capture: true });
  document.addEventListener('touchmove', block, { passive: false, capture: true });
  return () => {
    document.removeEventListener('wheel', block, { capture: true });
    document.removeEventListener('touchmove', block, { capture: true });
  };
}
