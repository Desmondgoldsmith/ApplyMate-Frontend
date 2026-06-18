export type HubJobPrefillPayload = {
  title?: string;
  company?: string;
  description: string;
};

export type AnalyzerPrefillPayload = HubJobPrefillPayload & {
  jobAnalysisId?: string | null;
};

/** Must match `FRESH_ANALYZE_PREFILL_SESSION` in `packages/web/src/lib/jobHubPrefill.ts`. */
const FRESH_ANALYZE_PREFILL_SESSION = 'applymate:fresh-analyze:prefill';
const PREFILL_JD = 'applymate_prefill_jd';
const PREFILL_TITLE = 'applymate_prefill_title';
const PREFILL_COMPANY = 'applymate_prefill_company';

/** Must match `HUB_JOB_PREFILL_SESSION_PREFIX` in `packages/web/src/lib/jobHubPrefill.ts`. */
const HUB_JOB_PREFILL_SESSION_PREFIX = 'applymate:hub-job-prefill:';

function hubJobPrefillSessionKey(jobAnalysisId: string): string {
  return `${HUB_JOB_PREFILL_SESSION_PREFIX}${jobAnalysisId.trim()}`;
}

/** Open a dashboard tab and inject sessionStorage so Job Hub can show raw JD before backend sync. */
export async function openWebAppTabWithHubPrefill(
  url: string,
  jobAnalysisId: string | null | undefined,
  prefill: HubJobPrefillPayload,
): Promise<void> {
  const tab = await chrome.tabs.create({ url });
  const id = jobAnalysisId?.trim();
  const desc = prefill.description?.trim();
  if (!tab.id || !id || !desc) return;

  const inject = (tabId: number) => {
    void chrome.scripting
      .executeScript({
        target: { tabId },
        func: (storageKey: string, payload: HubJobPrefillPayload) => {
          try {
            sessionStorage.setItem(storageKey, JSON.stringify(payload));
          } catch {
            /* ignore */
          }
        },
        args: [hubJobPrefillSessionKey(id), prefill],
      })
      .catch(() => {
        /* tab may not allow scripting yet */
      });
  };

  if (tab.status === 'complete') {
    inject(tab.id);
    return;
  }

  const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
    if (tabId === tab.id && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      inject(tabId);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

function injectAnalyzerPrefill(tabId: number, payload: AnalyzerPrefillPayload): void {
  const description = payload.description?.trim();
  if (!description) return;

  void chrome.scripting
    .executeScript({
      target: { tabId },
      func: (
        sessionKey: string,
        lsKeys: { jd: string; title: string; company: string },
        data: { title: string; company: string; description: string },
      ) => {
        try {
          sessionStorage.setItem(
            sessionKey,
            JSON.stringify({
              title: data.title,
              company: data.company,
              description: data.description,
            }),
          );
          localStorage.setItem(lsKeys.jd, data.description);
          if (data.title.trim()) localStorage.setItem(lsKeys.title, data.title);
          if (data.company.trim()) localStorage.setItem(lsKeys.company, data.company);
        } catch {
          /* ignore quota / private mode */
        }
      },
      args: [
        FRESH_ANALYZE_PREFILL_SESSION,
        { jd: PREFILL_JD, title: PREFILL_TITLE, company: PREFILL_COMPANY },
        {
          title: payload.title?.trim() ?? '',
          company: payload.company?.trim() ?? '',
          description,
        },
      ],
    })
    .catch(() => {
      /* tab may not allow scripting yet */
    });
}

/** Open analyzer with short URL — description goes in sessionStorage, not query string. */
export async function openWebAppTabWithAnalyzerPrefill(
  webAppBase: string,
  payload: AnalyzerPrefillPayload,
): Promise<void> {
  const params = new URLSearchParams({ source: 'extension' });
  const jobId = payload.jobAnalysisId?.trim();
  if (jobId) params.set('jobId', jobId);
  if (payload.title?.trim()) params.set('jobTitle', payload.title.trim());
  if (payload.company?.trim()) params.set('company', payload.company.trim());

  const url = `${webAppBase.replace(/\/$/, '')}/dashboard/jobs/analyze?${params.toString()}`;
  const tab = await chrome.tabs.create({ url });
  if (!tab.id || !payload.description?.trim()) return;

  const inject = (tabId: number) => {
    injectAnalyzerPrefill(tabId, payload);
  };

  if (tab.status === 'complete') {
    inject(tab.id);
    return;
  }

  const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
    if (tabId === tab.id && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      inject(tabId);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}
