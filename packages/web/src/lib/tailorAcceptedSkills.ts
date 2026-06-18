import type { CvTailorDraft } from '@/lib/api';
import { buildTailorSectionChanges } from '@/lib/cvTailorDiff';

/** Skills actually added on accept — from accepted skills draft diff, not `selectedSkills` alone. */
export function acceptedTailorSkillNames(
  draft: CvTailorDraft | null | undefined,
): string[] {
  if (!draft) return [];

  const skillsEntry = draft.drafts.find(
    (d) => d.sectionType?.trim().toLowerCase() === 'skills' && d.status === 'accepted',
  );
  if (!skillsEntry) return [];

  const hunks = buildTailorSectionChanges(
    skillsEntry.sectionType,
    skillsEntry.before,
    skillsEntry.after,
    skillsEntry.changedFields,
  );

  const added: string[] = [];
  for (const hunk of hunks) {
    if (hunk.kind === 'skills') {
      added.push(...hunk.added);
    }
  }

  const deduped = [...new Set(added.map((s) => s.trim()).filter(Boolean))];
  if (deduped.length > 0) return deduped;

  if (draft.status === 'completed') {
    return (draft.selectedSkills ?? []).map((s) => s.trim()).filter(Boolean);
  }

  return [];
}
