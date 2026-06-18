import { collectAiFallbackPayload, extractJobFromPage } from '@/content/extractor';
import { shouldMonitorPageForJob, shouldShowFloatingJobIcon } from '@/content/job-page-heuristics';
import { isApplyMateAppUrl, urlLooksLikeJobListing } from '@/shared/job-page-url';

const ICON_SIZE = 48;
const ICON_MARGIN_RIGHT = 16;
/** Sit above typical extension FABs stacked at the bottom-right corner. */
const ICON_MARGIN_BOTTOM = 88;
const REDETECT_DEBOUNCE_MS = 900;
let redetectTimer: ReturnType<typeof setTimeout> | undefined;
let iconMounted = false;

function injectStyles(): void {
  if (document.getElementById('applymate-floating-icon-styles')) return;
  const style = document.createElement('style');
  style.id = 'applymate-floating-icon-styles';
  style.textContent = `
    #applymate-floating-icon {
      position: fixed;
      right: ${ICON_MARGIN_RIGHT}px;
      bottom: ${ICON_MARGIN_BOTTOM}px;
      left: auto;
      top: auto;
      height: ${ICON_SIZE}px;
      min-width: ${ICON_SIZE}px;
      width: ${ICON_SIZE}px;
      border-radius: 999px;
      background: #00C9B1;
      color: #ffffff;
      font-weight: 700;
      font-size: 18px;
      font-family: Inter, system-ui, sans-serif;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 6px 24px rgba(0, 201, 177, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.08);
      z-index: 2147483647 !important;
      isolation: isolate;
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      transition: width 0.18s ease, padding 0.18s ease, transform 0.15s ease;
      border: none;
      padding: 0;
      overflow: hidden;
      white-space: nowrap;
    }
    #applymate-floating-icon .applymate-icon-mark {
      flex: 0 0 ${ICON_SIZE}px;
      width: ${ICON_SIZE}px;
      height: ${ICON_SIZE}px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    #applymate-floating-icon .applymate-icon-label {
      max-width: 0;
      opacity: 0;
      overflow: hidden;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.01em;
      transition: max-width 0.18s ease, opacity 0.18s ease, margin 0.18s ease;
      margin-right: 0;
    }
    #applymate-floating-icon:hover,
    #applymate-floating-icon:focus-visible {
      width: auto;
      padding-right: 14px;
      transform: scale(1.03);
    }
    #applymate-floating-icon:hover .applymate-icon-label,
    #applymate-floating-icon:focus-visible .applymate-icon-label {
      max-width: 120px;
      opacity: 1;
      margin-right: 2px;
    }
  `;
  document.documentElement.appendChild(style);
}

function anchorIconBottomRight(button: HTMLElement): void {
  button.style.setProperty('position', 'fixed', 'important');
  button.style.setProperty('z-index', '2147483647', 'important');
  button.style.left = 'auto';
  button.style.top = 'auto';
  button.style.right = `${ICON_MARGIN_RIGHT}px`;
  button.style.bottom = `${ICON_MARGIN_BOTTOM}px`;
}

/** Keep our FAB last in the document and above other extension widgets. */
function ensureIconDominant(button: HTMLElement): void {
  anchorIconBottomRight(button);
  const root = document.documentElement;
  if (button.parentElement !== root) {
    root.appendChild(button);
  } else {
    root.appendChild(button);
  }
}

function hideFloatingIcon(): void {
  document.getElementById('applymate-floating-icon')?.remove();
  iconMounted = false;
}

function pageMayHaveJob(): boolean {
  const href = window.location.href;
  if (isApplyMateAppUrl(href)) return false;
  if (urlLooksLikeJobListing(href)) return true;
  return shouldMonitorPageForJob(href);
}

function createFloatingIcon(): void {
  if (iconMounted || document.getElementById('applymate-floating-icon')) return;

  injectStyles();

  const button = document.createElement('button');
  button.id = 'applymate-floating-icon';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open ApplyMate');
  button.innerHTML =
    '<span class="applymate-icon-mark" aria-hidden="true">A</span><span class="applymate-icon-label">Apply Mate</span>';
  ensureIconDominant(button);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      chrome.runtime.sendMessage({ action: 'openSidebar' }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      /* extension context may be stale — user can use toolbar icon */
    }
    void chrome.runtime.sendMessage({ action: 'probeActiveJob' } satisfies { action: 'probeActiveJob' }).catch(() => {
      /* ignore */
    });
    void runPageDetection();
  });

  window.addEventListener('resize', () => {
    ensureIconDominant(button);
  });

  ensureIconDominant(button);
  iconMounted = true;
}

function refreshIconStackOrder(): void {
  const button = document.getElementById('applymate-floating-icon');
  if (button instanceof HTMLElement) {
    ensureIconDominant(button);
  }
}

async function runPageDetection(): Promise<void> {
  if (isApplyMateAppUrl(window.location.href)) {
    hideFloatingIcon();
    return;
  }

  const mayHaveJob = pageMayHaveJob();
  const job = mayHaveJob ? await extractJobFromPage() : null;
  const showIcon = shouldShowFloatingJobIcon(window.location.href, Boolean(job));

  if (!showIcon) {
    hideFloatingIcon();
    return;
  }

  createFloatingIcon();
  refreshIconStackOrder();

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

function patchHistory(method: 'pushState' | 'replaceState'): void {
  const original = history[method].bind(history);
  history[method] = (...args: Parameters<History['pushState']>) => {
    const result = original(...args);
    schedulePageDetection();
    return result;
  };
}

function startHrefPoll(): void {
  let lastHref = window.location.href;
  window.setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      schedulePageDetection();
    }
  }, 500);
}

function startDetectionObserver(): void {
  if (!document.body) return;
  new MutationObserver(() => {
    schedulePageDetection();
  }).observe(document.body, { childList: true, subtree: true });
}

function warmExtensionServiceWorker(): void {
  try {
    chrome.runtime.sendMessage({ action: 'ping' }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    /* extension context may be unavailable */
  }
}

function bootDetection(): void {
  warmExtensionServiceWorker();

  if (isApplyMateAppUrl(window.location.href)) {
    hideFloatingIcon();
    return;
  }

  if (pageMayHaveJob()) {
    createFloatingIcon();
  }

  void runPageDetection();
  startDetectionObserver();
  patchHistory('pushState');
  patchHistory('replaceState');
  startHrefPoll();
  window.addEventListener('popstate', schedulePageDetection);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootDetection);
} else {
  bootDetection();
}

export {};
