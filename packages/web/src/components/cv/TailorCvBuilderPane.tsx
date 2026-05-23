'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { CVBuilder } from '@/components/cv/CVBuilder';
import { useCVProfileById } from '@/hooks/useCVProfileById';
import { pickCvSectionRowsForEditor } from '@/lib/api';
import {
  isCvTemplateId,
  transformSectionsToCVBuilderData,
  type CvTemplateId,
  type SaveCVBuilderDataResult,
} from '@/lib/cvBuilder';
import { useAuthStore } from '@/store/useAuthStore';

export function TailorCvBuilderPane({
  profileId,
  rehydrateNonce = 0,
  highlightSectionId = null,
  highlightNonce = 0,
  highlightAction = 'accepted',
  onAutosaved,
  onStructuredPersisted,
}: {
  profileId: string;
  rehydrateNonce?: number;
  highlightSectionId?: string | null;
  highlightNonce?: number;
  highlightAction?: 'accepted' | 'reverted';
  /** Debounced autosave only — must not bump server hydrate (same as CV Clinic). */
  onAutosaved?: () => void;
  /** After accept/revert or AI structured persist — parent may await refetch then bump hydrate. */
  onStructuredPersisted?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const profileQ = useCVProfileById(profileId);
  const [serverHydrateNonce, setServerHydrateNonce] = useState(0);
  const jumpToSectionRef = useRef<
    | ((sid: string, itemId?: string, opts?: { scrollForm?: boolean }) => void)
    | null
  >(null);

  const profile = profileQ.data?.profile;
  const sections = useMemo(
    () => pickCvSectionRowsForEditor(profileQ.data?.sections, undefined),
    [profileQ.data?.sections],
  );

  const initialData = useMemo(
    () =>
      transformSectionsToCVBuilderData(profile ?? null, sections, {
        email: user?.email,
        name: user?.name,
      }),
    [profile, sections, user?.email, user?.name],
  );

  const template: CvTemplateId = useMemo(() => {
    const t = profile?.template;
    return t && isCvTemplateId(t) ? t : 'modern';
  }, [profile?.template]);

  /** Match CV Clinic: soft cache update, no hydrate nonce on autosave. */
  const onTailorAutosaved = useCallback(
    async (result?: SaveCVBuilderDataResult) => {
      if (result?.sections && result.sections.length > 0) {
        queryClient.setQueryData(['cv-profile', profileId], (prev: unknown) => {
          if (!prev || typeof prev !== 'object') return prev;
          const row = prev as { profile?: unknown; sections?: unknown };
          return { ...row, sections: result.sections };
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ['cv-profile', profileId],
        refetchType: 'none',
      });
      onAutosaved?.();
    },
    [onAutosaved, profileId, queryClient],
  );

  const onTailorSectionPersisted = useCallback(async () => {
    setServerHydrateNonce((n) => n + 1);
    await onStructuredPersisted?.();
  }, [onStructuredPersisted]);

  if (profileQ.isLoading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#080a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C9B1]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-white/50">
        Could not load your CV. Close and try again.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080a0a]">
      <CVBuilder
        key={profileId}
        mode="dashboard"
        cvMode="tailor"
        profileId={profileId}
        initialData={initialData}
        selectedTemplate={template}
        existingSections={sections}
        serverHydrateNonce={serverHydrateNonce + rehydrateNonce}
        onAiStructuredPersisted={onTailorSectionPersisted}
        onDashboardSaved={onTailorAutosaved}
        onJumpToSectionReady={(fn) => {
          jumpToSectionRef.current = fn;
        }}
        tailorHighlightSectionId={highlightSectionId}
        tailorHighlightNonce={highlightNonce}
        tailorHighlightAction={highlightAction}
      />
    </div>
  );
}
