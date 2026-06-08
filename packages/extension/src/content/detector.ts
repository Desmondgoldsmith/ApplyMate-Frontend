import { collectAiFallbackPayload, extractJobFromPage } from '@/content/extractor';
import { shouldMonitorPageForJob, shouldShowFloatingJobIcon } from '@/content/job-page-heuristics';
import { isApplyMateAppUrl } from '@/shared/job-page-url';
import { getIconPosition, setIconPosition } from '@/shared/storage';

const ICON_SIZE = 48;
const DRAG_THRESHOLD_PX = 12;
const REDETECT_DEBOUNCE_MS = 900;
let redetectTimer: ReturnType<typeof setTimeout> | undefined;

function injectStyles(): void {
  if (document.getElementById('applymate-floating-icon-styles')) return;
  const style = document.createElement('style');
  style.id = 'applymate-floating-icon-styles';
  style.textContent = `
    #applymate-floating-icon {
      position: fixed;
      width: ${ICON_SIZE}px;
      height: ${ICON_SIZE}px;
      border-radius: 50%;
      background: #00C9B1;
      color: #ffffff;
      font-weight: 700;
      font-size: 18px;
      font-family: Inter, system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0, 201, 177, 0.4);
      z-index: 2147483647;
      cursor: pointer;
      user-select: none;
      transition: transform 0.15s ease;
      border: none;
      padding: 0;
    }
    #applymate-floating-icon:hover {
      transform: scale(1.08);
    }
  `;
  document.documentElement.appendChild(style);
}

function defaultPosition(): { x: number; y: number } {
  const x = Math.max(8, window.innerWidth - ICON_SIZE - 16);
  const y = Math.max(8, Math.round(window.innerHeight * 0.5 - ICON_SIZE / 2));
  return { x, y };
}

function applyPosition(el: HTMLElement, pos: { x: number; y: number }): void {
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
}

function hideFloatingIcon(): void {
  document.getElementById('applymate-floating-icon')?.remove();
}

async function createFloatingIcon(): Promise<void> {
  if (document.getElementById('applymate-floating-icon')) return;

  injectStyles();

  const button = document.createElement('button');
  button.id = 'applymate-floating-icon';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open ApplyMate');
  button.textContent = 'A';

  const saved = await getIconPosition();
  applyPosition(button, saved ?? defaultPosition());

  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    originX = button.offsetLeft;
    originY = button.offsetTop;
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) >= DRAG_THRESHOLD_PX) moved = true;
    if (!moved) return;
    const x = Math.min(Math.max(0, originX + dx), window.innerWidth - ICON_SIZE);
    const y = Math.min(Math.max(0, originY + dy), window.innerHeight - ICON_SIZE);
    applyPosition(button, { x, y });
  });

  button.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    if (button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
    const x = button.offsetLeft;
    const y = button.offsetTop;
    if (moved) {
      void setIconPosition(x, y);
      return;
    }
    // Open synchronously from the user gesture — avoid click/mousedown handlers that break the chain.
    chrome.runtime.sendMessage({ action: 'openSidebar' });
  });

  button.addEventListener('pointercancel', () => {
    dragging = false;
    moved = false;
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
  });

  window.addEventListener('resize', () => {
    const x = Math.min(button.offsetLeft, window.innerWidth - ICON_SIZE);
    const y = Math.min(button.offsetTop, window.innerHeight - ICON_SIZE);
    applyPosition(button, { x: Math.max(0, x), y: Math.max(0, y) });
  });

  document.body.appendChild(button);
}

async function runPageDetection(): Promise<void> {
  if (isApplyMateAppUrl(window.location.href)) {
    hideFloatingIcon();
    return;
  }
  const job = await extractJobFromPage();
  const showIcon = shouldShowFloatingJobIcon(window.location.href, Boolean(job));

  if (!showIcon) {
    hideFloatingIcon();
    return;
  }

  await createFloatingIcon();

  if (job) {
    void chrome.runtime.sendMessage({ action: 'jobExtracted', job }).catch(() => {
      /* ignore */
    });
    return;
  }

  if (shouldMonitorPageForJob(window.location.href)) {
    const payload = collectAiFallbackPayload();
    if (payload) {
      void chrome.runtime
        .sendMessage({ action: 'extractJobAI', payload })
        .catch(() => {
          /* ignore */
        });
    }
  }
}

function schedulePageDetection(): void {
  clearTimeout(redetectTimer);
  redetectTimer = setTimeout(() => {
    void runPageDetection();
  }, REDETECT_DEBOUNCE_MS);
}

function startDetectionObserver(): void {
  if (!document.body) return;
  new MutationObserver(() => {
    schedulePageDetection();
  }).observe(document.body, { childList: true, subtree: true });
}

function bootDetection(): void {
  if (isApplyMateAppUrl(window.location.href)) {
    hideFloatingIcon();
    return;
  }
  void runPageDetection();
  startDetectionObserver();
  window.addEventListener('popstate', schedulePageDetection);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootDetection);
} else {
  bootDetection();
}

export {};
