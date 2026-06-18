'use client';

import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { CvClinicWorkspace } from '@/components/cv/CvClinicWorkspace';
import { useCVProfileById } from '@/hooks/useCVProfileById';
import { pickCvSectionRowsForEditor } from '@/lib/api';
import { isCvTemplateId, type CvTemplateId } from '@/lib/cvBuilder';

/**
 * Tailor surface CV editor — now the FULL Resume Clinic builder (toolbar with
 * Template / Sections / Reorder / Spelling / Scan, triple-column preview, and a
 * right panel that defaults to "Tailoring changes" with toggles to Analysis and
 * Improvements). The job-tailoring change stream is injected via `tailorRightSlot`.
 */
export function TailorCvBuilderPane({
  profileId,
  rehydrateNonce = 0,
  forceRehydrateNonce = 0,
  highlightSectionId = null,
  highlightNonce = 0,
  highlightAction = 'accepted',
  onAutosaved,
  onStructuredPersisted,
  tailorRightSlot,
  tailorChangesBadgeCount = 0,
  onExportPdf,
  onExportDocx,
  isExportPending = false,
}: {
  profileId: string;
  rehydrateNonce?: number;
  /** Bump after tailor accept/revert so builder rehydrates even when dirty. */
  forceRehydrateNonce?: number;
  highlightSectionId?: string | null;
  highlightNonce?: number;
  highlightAction?: 'accepted' | 'reverted';
  /** Debounced autosave only — must not bump server hydrate (same as CV Clinic). */
  onAutosaved?: () => void;
  /** After accept/revert or AI structured persist — parent may await refetch then bump hydrate. */
  onStructuredPersisted?: () => void | Promise<void>;
  /** The job-tailoring change stream (Suggested / Accepted / Rejected + export). */
  tailorRightSlot?: ReactNode;
  /** Pending change count shown as a badge on the "Tailoring changes" tab. */
  tailorChangesBadgeCount?: number;
  onExportPdf?: () => void;
  onExportDocx?: () => void;
  isExportPending?: boolean;
}) {
  const profileQ = useCVProfileById(profileId);

  const profile = profileQ.data?.profile;
  const sections = useMemo(
    () => pickCvSectionRowsForEditor(profileQ.data?.sections, undefined),
    [profileQ.data?.sections],
  );

  const [template, setTemplate] = useState<CvTemplateId>('modern');
  useEffect(() => {
    const t = profile?.template;
    if (t && isCvTemplateId(t)) setTemplate(t);
  }, [profile?.template]);

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
    <CvClinicWorkspace
      key={profileId}
      builderContext="tailoring"
      profileId={profileId}
      sections={sections}
      selectedTemplate={template}
      onTemplateIdChange={setTemplate}
      onDashboardSaved={onAutosaved}
      tailorRightSlot={tailorRightSlot}
      tailorChangesBadgeCount={tailorChangesBadgeCount}
      tailorHighlightSectionId={highlightSectionId}
      tailorHighlightNonce={highlightNonce}
      tailorHighlightAction={highlightAction}
      externalServerHydrateNonce={rehydrateNonce}
      forceServerHydrateNonce={forceRehydrateNonce}
      onStructuredPersisted={onStructuredPersisted}
      modalLayerZIndex={100070}
      onExportPdf={onExportPdf}
      onExportDocx={onExportDocx}
      isExportPending={isExportPending}
      className="h-full"
    />
  );
}
