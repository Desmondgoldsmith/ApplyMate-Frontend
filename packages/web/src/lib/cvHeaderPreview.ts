import {
  DEFAULT_HEADER_PREVIEW,
  type HeaderPreviewSettings,
} from '@/components/cv/CVEditContext';

function storageKey(profileId: string): string {
  return `applymate:cv:headerPreview:${profileId.trim()}`;
}

/** Header toggles the editor shows for this CV (per tab, defaults when unset). */
export function readHeaderPreviewStorage(
  profileId: string | null | undefined,
): HeaderPreviewSettings {
  if (!profileId?.trim() || typeof window === 'undefined')
    return DEFAULT_HEADER_PREVIEW;
  try {
    const raw = window.sessionStorage.getItem(storageKey(profileId));
    if (!raw) return DEFAULT_HEADER_PREVIEW;
    const o = JSON.parse(raw) as Partial<HeaderPreviewSettings> & {
      showLink?: boolean;
      showExtraLink?: boolean;
    };
    const legacyLink = o.showLink;
    return {
      ...DEFAULT_HEADER_PREVIEW,
      ...o,
      photoStyle: o.photoStyle ?? DEFAULT_HEADER_PREVIEW.photoStyle,
      showHeadline: o.showHeadline ?? DEFAULT_HEADER_PREVIEW.showHeadline,
      showLinkedIn:
        o.showLinkedIn ?? legacyLink ?? DEFAULT_HEADER_PREVIEW.showLinkedIn,
      showGithub:
        o.showGithub ?? legacyLink ?? DEFAULT_HEADER_PREVIEW.showGithub,
      showWebsiteToggle:
        o.showWebsiteToggle ?? DEFAULT_HEADER_PREVIEW.showWebsiteToggle,
      showPortfolioToggle:
        o.showPortfolioToggle ??
        o.showExtraLink ??
        DEFAULT_HEADER_PREVIEW.showPortfolioToggle,
    };
  } catch {
    return DEFAULT_HEADER_PREVIEW;
  }
}

export function writeHeaderPreviewStorage(
  profileId: string | null | undefined,
  next: HeaderPreviewSettings,
) {
  if (!profileId?.trim() || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey(profileId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Toggle → token accepted by the export `hide` query parameter. */
const HIDE_TOKEN_BY_TOGGLE = [
  ['showHeadline', 'headline'],
  ['showTitle', 'title'],
  ['showPhone', 'phone'],
  ['showEmail', 'email'],
  ['showLocation', 'location'],
  ['showLinkedIn', 'linkedin'],
  ['showGithub', 'github'],
  ['showWebsiteToggle', 'website'],
  ['showPortfolioToggle', 'portfolio'],
  ['showPhoto', 'photo'],
  ['nationality', 'nationality'],
  ['dateOfBirth', 'dateOfBirth'],
] as const satisfies ReadonlyArray<
  readonly [keyof HeaderPreviewSettings, string]
>;

/** Header fields the user switched off, so PDF/DOCX leave out exactly what the preview hides. */
export function headerPreviewToHideList(hp: HeaderPreviewSettings): string[] {
  return HIDE_TOKEN_BY_TOGGLE.filter(([toggle]) => hp[toggle] === false).map(
    ([, token]) => token,
  );
}
