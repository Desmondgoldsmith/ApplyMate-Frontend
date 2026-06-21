/**
 * Maps API improvement/assistant section ids to CV builder preview section ids.
 * Contact rubric fields (headline, email, etc.) render under the `personal` header block.
 */
export function cvDiffPreviewBuilderSection(
  apiSection: string | null | undefined,
): string | null {
  const raw = (apiSection ?? '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === 'contact' || key === 'headline' || key === 'personal') {
    return 'personal';
  }
  return raw;
}
