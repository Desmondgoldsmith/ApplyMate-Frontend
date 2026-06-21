import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

import {
  api,
  type CVSectionRecord,
  type CvAssistantCommitResult,
  type CvProfileDetail,
} from '@/lib/api';
import { refreshCvState } from '@/lib/refreshCvState';

const FIXED_SECTION_ACCORDION_KEYS = new Set([
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'achievements',
  'certifications',
  'languages',
  'links',
  'references',
  'personal',
]);

/**
 * Maps API `targetSection` to CVBuilder accordion id (`cv-section-${id}`).
 * Custom slugs and `custom_*` rows resolve via section rows; `project` hints → `projects`.
 */
export function assistantTargetSectionToEditorId(
  targetSection: string | undefined,
  sections: CVSectionRecord[],
): string {
  const raw = (targetSection ?? '').trim().toLowerCase();
  if (!raw) return 'summary';

  if (FIXED_SECTION_ACCORDION_KEYS.has(raw)) {
    if (raw === 'links') return 'personal';
    return raw;
  }

  const row =
    sections.find((s) => s.type.trim().toLowerCase() === raw) ??
    sections.find((s) => s.id.trim().toLowerCase() === raw);
  if (row?.type) {
    const t = row.type.trim().toLowerCase();
    if (FIXED_SECTION_ACCORDION_KEYS.has(t)) {
      return t === 'links' ? 'personal' : t;
    }
    if (t.startsWith('custom')) return t;
  }

  if (raw.includes('project')) {
    const hasProjects = sections.some(
      (s) => s.type.trim().toLowerCase() === 'projects',
    );
    if (hasProjects) return 'projects';
  }

  if (raw.startsWith('custom')) return raw;
  return raw;
}

export type CommitAssistantAcceptedPatchOptions = {
  queryClient: QueryClient;
  profileId: string;
  patch: Record<string, unknown>;
  commandId?: string;
  operation?: string;
  onRehydrated?: () => void;
};

/**
 * Persist assistant patch, seed React Query from `profile` + `sections`, then refetch canonical keys.
 */
export async function commitAssistantAcceptedPatch(
  options: CommitAssistantAcceptedPatchOptions,
): Promise<CvAssistantCommitResult> {
  const { queryClient, profileId, patch, commandId, operation, onRehydrated } = options;
  const id = profileId.trim();
  if (!id) throw new Error('commitAssistantAcceptedPatch: missing profileId');

  const result = await api.cv.assistantCommit(id, {
    patch,
    ...(commandId?.trim() ? { commandId: commandId.trim() } : {}),
    ...(operation?.trim() ? { operation: operation.trim() } : {}),
  });

  const detail: CvProfileDetail = {
    profile: result.profile,
    sections: result.sections,
  };
  queryClient.setQueryData(queryKeys.cv.profile(id), detail);
  if (result.sections.length > 0) {
    queryClient.setQueryData(queryKeys.cv.sections(id), result.sections);
  }

  await refreshCvState(queryClient, id, {
    refreshProfile: true,
    refreshSections: true,
    refreshSuggestions: true,
    invalidateScore: true,
    invalidateCvProfilesList: false,
  });

  onRehydrated?.();
  return result;
}
