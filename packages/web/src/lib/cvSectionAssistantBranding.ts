import type { CVBuilderData } from '@/lib/cvBuilder';

const SECTION_LABELS: Readonly<Record<string, string>> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  achievements: 'Achievements',
  certifications: 'Certifications',
  languages: 'Languages',
  personal: 'Header',
  references: 'References',
  links: 'Links',
  publications: 'Publications',
  interests: 'Interests',
  volunteering: 'Volunteering',
  'custom-legacy': 'Custom section',
};

/** Default label when a parsed custom row has no user title yet. */
const PARSED_SECTION_TYPE_LABELS: Readonly<Record<string, string>> = {
  custom: 'Custom section',
  custom_publications: 'Publications',
  custom_interests: 'Interests',
  custom_volunteering: 'Volunteering',
};

const UUID_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function titleCaseWord(word: string): string {
  if (!word) return 'Section';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Short display name for a CV builder / preview section id (static fallback). */
export function cvSectionAssistantDisplayName(sectionId: string): string {
  const raw = sectionId.trim();
  if (!raw) return 'Section';

  const withoutParsed = raw.replace(/^parsed-/i, '');
  const lower = withoutParsed.toLowerCase();

  if (isUuidLike(withoutParsed)) return 'Custom section';

  if (SECTION_LABELS[lower]) return SECTION_LABELS[lower];

  if (lower.startsWith('custom_')) {
    const typeLabel = PARSED_SECTION_TYPE_LABELS[lower];
    if (typeLabel) return typeLabel;
    const rest = withoutParsed.slice(7).replace(/_/g, ' ').trim();
    if (!rest || /^section_\d+$/i.test(rest.replace(/\s/g, '_'))) return 'Custom section';
    return titleCaseWord(rest);
  }

  const word = withoutParsed.replace(/[-_]/g, ' ').trim();
  if (!word) return 'Section';
  return titleCaseWord(word);
}

/** Resolve human-readable section name using live builder data (parsed custom titles, etc.). */
export function resolveCvSectionAssistantDisplayName(
  sectionId: string,
  data?: CVBuilderData | null,
): string {
  const raw = sectionId.trim();
  if (!raw) return 'Section';

  if (raw.startsWith('parsed-') && data) {
    const sid = raw.slice('parsed-'.length);
    const block = data.parsedCustomSections.find((b) => b.sectionId === sid);
    const userTitle = block?.title?.trim();
    if (userTitle) return userTitle;
    const typeKey = block?.sectionType?.trim().toLowerCase() ?? '';
    if (typeKey && PARSED_SECTION_TYPE_LABELS[typeKey]) {
      return PARSED_SECTION_TYPE_LABELS[typeKey];
    }
  }

  return cvSectionAssistantDisplayName(raw);
}

/** Popover heading, e.g. "Summary assistant". */
export function cvSectionAssistantPopoverTitle(
  sectionId: string,
  data?: CVBuilderData | null,
): string {
  return `${resolveCvSectionAssistantDisplayName(sectionId, data)} assistant`;
}
