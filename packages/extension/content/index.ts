/**
 * Content script entry — runs in the context of job listing pages.
 * Kept **vanilla DOM** (no React, no Tailwind import) so `content.js` stays a single file in `manifest.json`.
 * Use Tailwind in `ui/*` entries; for injected UI prefer Shadow DOM + `style` or a small CSS file listed in the manifest.
 */
const MOUNT_ID = 'applymate-content-root';

function mount(): void {
  if (document.getElementById(MOUNT_ID)) return;
  const host = document.createElement('div');
  host.id = MOUNT_ID;
  host.setAttribute('data-applymate', 'injected');
  host.textContent = 'ApplyMate (scaffold)';
  host.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:2147483646;padding:8px 12px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);background:#fff;font:12px/1.4 system-ui;pointer-events:none;';
  document.documentElement.appendChild(host);
}

mount();
