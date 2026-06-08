const CAREER_PATH_PATTERN =
  /\/(jobs?|careers?|openings?|opportunities|positions?|postings?|vacancies|roles?|apply)(\/|$|[?#])/i;

const WEB_APP_ORIGIN = (
  import.meta.env.VITE_WEB_APP_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

/** Our dashboard / analyzer — never treat as an external job posting page. */
export function isApplyMateAppUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    if (WEB_APP_ORIGIN && parsed.href.startsWith(WEB_APP_ORIGIN)) return true;
    if (parsed.pathname.startsWith('/dashboard')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Known job board host patterns (high confidence). */
export function isKnownJobBoardUrl(url: string): boolean {
  try {
    const { hostname, href } = new URL(url);
    if (hostname.includes('linkedin.com')) {
      return href.includes('/jobs/');
    }
    if (hostname.includes('indeed.com')) {
      return /viewjob/i.test(href);
    }
    if (hostname.includes('greenhouse.io')) {
      return true;
    }
    if (hostname.includes('lever.co')) {
      return true;
    }
    if (hostname.includes('myworkdayjobs.com') || hostname.includes('wd3.myworkday.com')) {
      return true;
    }
    if (hostname.includes('jobberman.com')) {
      return true;
    }
    if (hostname.includes('ashbyhq.com')) {
      return true;
    }
    if (hostname.includes('smartrecruiters.com')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** URL path/query hints at a job or careers listing (includes company career sites). */
export function urlLooksLikeJobListing(url: string): boolean {
  if (isKnownJobBoardUrl(url)) return true;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    if (CAREER_PATH_PATTERN.test(parsed.pathname)) return true;
    if (/[?&](jobId|job_id|gh_jid|job|posting|req)=/i.test(parsed.href)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Back-compat alias used across extension background + sidebar. */
export function isLikelyJobUrl(url: string): boolean {
  return urlLooksLikeJobListing(url);
}

export function isProbeableWebUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeJobPageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}
