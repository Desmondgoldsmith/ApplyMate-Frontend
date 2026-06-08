import { collectAiFallbackPayload, extractJobFromPage } from '@/content/extractor';
import { shouldMonitorPageForJob } from '@/content/job-page-heuristics';
import { isApplyMateAppUrl } from '@/shared/job-page-url';

type ProbeJobPageMessage = { action: 'probeJobPage' };
type RunProbeMessage = { action: 'runProbe' };

type ProbeJobPageResponse = {
  job: Awaited<ReturnType<typeof extractJobFromPage>>;
  needsAi: boolean;
  aiPayload?: ReturnType<typeof collectAiFallbackPayload>;
};

const PROBE_DEBOUNCE_MS = 900;
const MIN_PROBE_INTERVAL_MS = 2500;
let lastNotifiedFingerprint = '';
let lastProbeAt = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let domObserver: MutationObserver | undefined;
let monitoringStopped = false;

function stopPageMonitoring(): void {
  if (monitoringStopped) return;
  monitoringStopped = true;
  clearTimeout(debounceTimer);
  domObserver?.disconnect();
  domObserver = undefined;
}

async function probeAndNotify(): Promise<void> {
  if (monitoringStopped) return;
  const href = window.location.href;
  if (!shouldMonitorPageForJob(href)) {
    return;
  }

  const job = await extractJobFromPage();
  if (job) {
    const fingerprint = `${job.sourceUrl}|${job.title}|${job.company}`;
    if (fingerprint === lastNotifiedFingerprint) return;
    lastNotifiedFingerprint = fingerprint;
    stopPageMonitoring();
    void chrome.runtime.sendMessage({ action: 'jobExtracted', job }).catch(() => {
      /* sidebar may be closed */
    });
    return;
  }

  const aiPayload = collectAiFallbackPayload();
  if (!aiPayload) return;

  const aiFingerprint = `${aiPayload.pageUrl}|${aiPayload.pageTitle}`;
  if (aiFingerprint === lastNotifiedFingerprint) return;
  lastNotifiedFingerprint = aiFingerprint;
  void chrome.runtime.sendMessage({ action: 'extractJobAI', payload: aiPayload }).catch(() => {
    /* ignore */
  });
}

function scheduleProbe(): void {
  if (monitoringStopped || !shouldMonitorPageForJob(window.location.href)) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const now = Date.now();
    if (now - lastProbeAt < MIN_PROBE_INTERVAL_MS) return;
    lastProbeAt = now;
    void probeAndNotify();
  }, PROBE_DEBOUNCE_MS);
}

function patchHistory(method: 'pushState' | 'replaceState'): void {
  const original = history[method].bind(history);
  history[method] = (...args: Parameters<History['pushState']>) => {
    const result = original(...args);
    lastNotifiedFingerprint = '';
    scheduleProbe();
    return result;
  };
}

patchHistory('pushState');
patchHistory('replaceState');
window.addEventListener('popstate', () => {
  lastNotifiedFingerprint = '';
  scheduleProbe();
});

function startDomObserver(): void {
  if (!document.body || monitoringStopped) return;
  domObserver = new MutationObserver(() => {
    scheduleProbe();
  });
  domObserver.observe(document.body, { childList: true, subtree: true });
}

function startHrefPoll(): void {
  let lastHref = window.location.href;
  window.setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      lastNotifiedFingerprint = '';
      scheduleProbe();
    }
  }, 500);
}

function startWarmPoll(): void {
  if (isApplyMateAppUrl(window.location.href)) return;
  let polls = 0;
  const interval = window.setInterval(() => {
    polls += 1;
    scheduleProbe();
    if (polls >= 8) {
      window.clearInterval(interval);
    }
  }, 600);
}

function bootJobBridge(): void {
  if (isApplyMateAppUrl(window.location.href)) return;
  startDomObserver();
  scheduleProbe();
  startHrefPoll();
  startWarmPoll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootJobBridge);
} else {
  bootJobBridge();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if ((message as RunProbeMessage | undefined)?.action === 'runProbe') {
    lastNotifiedFingerprint = '';
    void probeAndNotify().finally(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if ((message as ProbeJobPageMessage | undefined)?.action !== 'probeJobPage') {
    return false;
  }

  void (async () => {
    const job = await extractJobFromPage();
    if (job) {
      sendResponse({ job, needsAi: false } satisfies ProbeJobPageResponse);
      return;
    }

    if (!shouldMonitorPageForJob(window.location.href)) {
      sendResponse({ job: null, needsAi: false } satisfies ProbeJobPageResponse);
      return;
    }

    const aiPayload = collectAiFallbackPayload();
    sendResponse({
      job: null,
      needsAi: Boolean(aiPayload),
      aiPayload: aiPayload ?? undefined,
    } satisfies ProbeJobPageResponse);
  })();

  return true;
});

export {};
