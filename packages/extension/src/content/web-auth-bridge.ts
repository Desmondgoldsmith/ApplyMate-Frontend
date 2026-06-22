import { isApplyMateAppUrl } from '@/shared/job-page-url';
import { isExtensionContextValid } from '@/shared/extension-runtime';

/** Must match `APPLYMATE_EXTENSION_PRESENT_EVENT` in packages/web. */
const EXTENSION_PRESENT_EVENT = 'applymate-extension-present';

function announceExtensionToPage(): void {
  if (!isApplyMateAppUrl(window.location.href)) return;
  try {
    const extensionId = chrome.runtime.id;
    if (!extensionId) return;
    window.dispatchEvent(
      new CustomEvent(EXTENSION_PRESENT_EVENT, {
        detail: { extensionId },
      }),
    );
  } catch {
    /* ignore */
  }
}

function bootWebAuthBridge(): void {
  announceExtensionToPage();

  let lastHref = window.location.href;
  window.setInterval(() => {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    announceExtensionToPage();
  }, 500);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      announceExtensionToPage();
    }
  });
}

if (isExtensionContextValid()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWebAuthBridge);
  } else {
    bootWebAuthBridge();
  }
}

export {};
