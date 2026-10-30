/**
 * The product walkthrough video shown to new users. Set
 * `NEXT_PUBLIC_WALKTHROUGH_VIDEO_URL` to any YouTube link (watch, share,
 * shorts or embed URL); leave it empty to hide the video everywhere.
 */
const RAW_URL = process.env.NEXT_PUBLIC_WALKTHROUGH_VIDEO_URL?.trim() ?? '';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeVideoId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (YOUTUBE_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const [, kind, rest] = url.pathname.split('/');
      if (kind === 'embed' || kind === 'shorts' || kind === 'live') {
        id = rest ?? null;
      }
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export const WALKTHROUGH_VIDEO_ID = parseYouTubeVideoId(RAW_URL);

/** Privacy-enhanced embed (no tracking cookies until the user presses play). */
export function walkthroughEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
