/** Module context for CV document preview diff UI (set once per preview render). */

export let gCvDocPreviewStructuralBefore: unknown;
export let gCvDocPreviewStructuralAfter: unknown;
export let gCvDocPreviewDiffMultiSection = false;

export function setCvDocumentPreviewDiffContext(ctx: {
  structuralBefore?: unknown;
  structuralAfter?: unknown;
  multiSection?: boolean;
}): void {
  gCvDocPreviewStructuralBefore = ctx.structuralBefore;
  gCvDocPreviewStructuralAfter = ctx.structuralAfter;
  gCvDocPreviewDiffMultiSection = Boolean(ctx.multiSection);
}

export type CvPreviewChangedField = {
  field?: string;
  fieldPath?: string;
  fieldLabel?: string;
  before: string;
  after: string;
  type: 'added' | 'removed' | 'changed';
  /** Index into global assistant `sectionDiffs` for per-section accept/reject. */
  sectionDiffIndex?: number;
};

function sectionKey(value: string): string {
  return value.trim().toLowerCase();
}

function diffSectionMatchesPreviewSection(
  previewSectionId: string,
  diffSection: string | null | undefined,
): boolean {
  const id = sectionKey(previewSectionId);
  const diff = sectionKey(diffSection ?? '');
  if (!diff) return false;
  if (diff === id) return true;
  // Headline/contact improvements render in the `personal` header block.
  if (
    id === 'personal' &&
    (diff === 'contact' || diff === 'headline' || diff === 'personal')
  ) {
    return true;
  }
  return false;
}

function fieldPathTargetsPreviewSection(
  previewSectionId: string,
  fieldPath: string,
): boolean {
  const id = sectionKey(previewSectionId);
  const path = fieldPath.trim().toLowerCase();
  if (!path) return false;
  const root = /^([a-z0-9_-]+)/.exec(path)?.[1] ?? '';
  if (!root) return false;
  if (root === id) return true;
  if (id === 'personal' && (root === 'contact' || root === 'headline')) {
    return true;
  }
  return false;
}

/** API improvement sections that must map to a preview diff renderer. */
export const CV_IMPROVEMENT_DIFF_API_SECTIONS = new Set([
  'experience',
  'summary',
  'contact',
  'personal',
  'headline',
  'skills',
  'education',
  'projects',
  'certifications',
]);

export function logMissingCvDiffRenderer(apiSection: string): void {
  console.error(
    `[CVDocumentPreview] No diff renderer registered for section "${apiSection}" — ` +
      'the Apply with AI result will not be visible to the user. Add a renderer.',
  );
}

export function resolveCvPreviewSectionDiff(
  sectionId: string,
  diffSection: string | null | undefined,
  changedFields: CvPreviewChangedField[] | null | undefined,
): {
  isDiff: boolean;
  fields: CvPreviewChangedField[] | null;
  sectionDiffIndex: number | undefined;
} {
  const id = sectionKey(sectionId);
  if (gCvDocPreviewDiffMultiSection) {
    const fields = (changedFields ?? []).filter(
      (cf) => sectionKey(cf.fieldPath ?? cf.field ?? '') === id,
    );
    return {
      isDiff: fields.length > 0,
      fields: fields.length > 0 ? fields : null,
      sectionDiffIndex: fields[0]?.sectionDiffIndex,
    };
  }
  const isDiff = diffSectionMatchesPreviewSection(sectionId, diffSection);
  if (isDiff) {
    return {
      isDiff: true,
      fields: changedFields ?? null,
      sectionDiffIndex: changedFields?.[0]?.sectionDiffIndex,
    };
  }

  const matchedFields = (changedFields ?? []).filter((cf) =>
    fieldPathTargetsPreviewSection(
      sectionId,
      (cf.fieldPath ?? cf.field ?? '').trim(),
    ),
  );
  if (matchedFields.length > 0) {
    return {
      isDiff: true,
      fields: matchedFields,
      sectionDiffIndex: matchedFields[0]?.sectionDiffIndex,
    };
  }

  return {
    isDiff: false,
    fields: null,
    sectionDiffIndex: undefined,
  };
}
