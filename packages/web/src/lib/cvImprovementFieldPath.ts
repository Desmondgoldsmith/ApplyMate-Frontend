import type { CVBuilderData } from '@/lib/cvBuilder';

export type CvImprovementJumpTarget = {
  sectionKey: string;
  entryId?: string;
};

/** Parse backend structured path e.g. `experience[0].bullets[1]` or `summary.text`. */
export function parseCvImprovementTargetFieldPath(
  fieldPath: string,
): { sectionRoot: string; itemIndex?: number } | null {
  const trimmed = fieldPath.trim();
  if (!trimmed) return null;
  const rootMatch = /^([a-zA-Z_][\w-]*)/.exec(trimmed);
  if (!rootMatch) return null;
  const sectionRoot = rootMatch[1]!;
  const indexMatch = /\[(\d+)\]/.exec(trimmed);
  const rawIndex = indexMatch ? Number(indexMatch[1]) : undefined;
  const itemIndex =
    rawIndex !== undefined && Number.isFinite(rawIndex) ? rawIndex : undefined;
  return { sectionRoot, itemIndex };
}

function sectionAccordionKey(sectionRoot: string): string {
  if (sectionRoot === 'headline' || sectionRoot === 'contact') return 'personal';
  return sectionRoot;
}

function entryIdAtIndex(
  data: CVBuilderData | null | undefined,
  sectionRoot: string,
  itemIndex: number,
): string | undefined {
  if (!data || itemIndex < 0) return undefined;
  switch (sectionRoot) {
    case 'experience':
      return data.experience.items[itemIndex]?.id;
    case 'education':
      return data.education.items[itemIndex]?.id;
    case 'projects':
      return data.projects[itemIndex]?.id;
    case 'certifications':
      return data.certifications[itemIndex]?.id;
    case 'languages':
      return data.languages[itemIndex]?.id;
    case 'achievements':
      return data.achievements[itemIndex]?.id;
    case 'references':
      return data.references[itemIndex]?.id;
    default:
      return undefined;
  }
}

/**
 * Resolve a suggestion `targetFieldPath` into CVBuilder jump coordinates.
 */
export function resolveImprovementJumpTarget(
  data: CVBuilderData | null | undefined,
  targetFieldPath: string | undefined,
  sectionFallback?: string,
): CvImprovementJumpTarget | null {
  const path = targetFieldPath?.trim();
  if (!path) {
    const sec = sectionFallback?.trim();
    if (!sec) return null;
    return { sectionKey: sectionAccordionKey(sec) };
  }
  const parsed = parseCvImprovementTargetFieldPath(path);
  if (!parsed) return null;
  const sectionKey = sectionAccordionKey(parsed.sectionRoot);
  const entryId =
    parsed.itemIndex !== undefined
      ? entryIdAtIndex(data, parsed.sectionRoot, parsed.itemIndex)
      : undefined;
  return { sectionKey, entryId };
}

export type CvImprovementResolutionType =
  | 'ai_fixable'
  | 'user_action_required'
  | 'ai_template_with_placeholder';

export function isCvImprovementAiFixable(item: {
  resolutionType?: CvImprovementResolutionType;
}): boolean {
  return item.resolutionType !== 'user_action_required';
}

export function isCvImprovementTemplateWithPlaceholder(item: {
  resolutionType?: CvImprovementResolutionType;
}): boolean {
  return item.resolutionType === 'ai_template_with_placeholder';
}

/**
 * Whether the "Fix with AI" affordance should render for this suggestion row.
 * Hides during an open preview (pendingFieldPaths / preview metadata / active diff overlay)
 * and for manual-only `user_action_required` rows.
 */
export function canShowCvImprovementFixWithAI(
  item: {
    id?: string;
    resolutionType?: CvImprovementResolutionType;
    pendingFieldPaths?: string[];
    lastPreviewDraftHash?: string;
  },
  activePreviewSuggestionId?: string | null,
): boolean {
  if (item.resolutionType === 'user_action_required') return false;
  const hasOpenPreview =
    (item.pendingFieldPaths?.length ?? 0) > 0 ||
    Boolean(item.lastPreviewDraftHash?.trim());
  if (hasOpenPreview) return false;
  const itemId = item.id?.trim();
  const activeId = activePreviewSuggestionId?.trim();
  if (activeId && itemId && itemId === activeId) return false;
  return (
    item.resolutionType === 'ai_fixable' ||
    item.resolutionType === 'ai_template_with_placeholder' ||
    item.resolutionType === undefined
  );
}
