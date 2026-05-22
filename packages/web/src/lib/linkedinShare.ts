const LINKEDIN_HOST = 'linkedin.com';

function isLinkedInUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === LINKEDIN_HOST || host.endsWith(`.${LINKEDIN_HOST}`);
  } catch {
    return url.toLowerCase().includes(LINKEDIN_HOST);
  }
}

function isApplyMateUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('applymate');
  } catch {
    return /applymate/i.test(url);
  }
}

/**
 * Resolves the URL for "Open link" on career badges — prefers LinkedIn over internal ApplyMate links.
 */
export function resolveLinkedInOpenUrl(shareText: string, shareLink: string | null | undefined): string | null {
  const link = shareLink?.trim() ?? '';
  const text = shareText.trim();

  if (link && isLinkedInUrl(link)) return link;

  if (link && !isApplyMateUrl(link)) return link;

  if (text) {
    return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
  }

  if (link && isApplyMateUrl(link)) {
    return 'https://www.linkedin.com/feed/';
  }

  return link || null;
}
