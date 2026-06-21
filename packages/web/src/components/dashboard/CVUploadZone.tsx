'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { useUploadCV } from '@/hooks/useUploadCV';
import { api, type CVProfile, type CvParseImportSummary } from '@/lib/api';
import { refreshCvStateAfterCvParseSuccess } from '@/lib/cvParseCacheReconcile';
import {
  canUseAiFromDailyAiUsage,
  DAILY_AI_LIMIT_REACHED_MESSAGE,
} from '@/lib/ai-daily-usage';
import {
  trackConversionFunnelEvent,
  trackUpgradePrompted,
} from '@/lib/analytics';
import { cvParseMutationShouldRetry, getApiErrorMessage, isTransientAiStructuredOutputError } from '@/lib/axios';
import { useToast } from '@/components/ui/Toast';
import { CvUploadProgressSteps } from '@/components/cv/CvUploadProgressSteps';
import { Button } from '@/components/ui/Button';

export type CvParseSuccessPayload = {
  profile: CVProfile;
  skillsFound?: number;
  isPartialExtraction?: boolean;
  importSummary?: CvParseImportSummary | null;
};

type CVUploadZoneProps = {
  onSuccess?: (result: CvParseSuccessPayload) => void;
  /** When set, POST /cv/profiles/:id/parse; otherwise POST /cv/parse. */
  cvProfileId?: string | null;
  /**
   * When true and `cvProfileId` is not set: create a new resume profile row first, then parse into it.
   */
  ensureNewProfileBeforeParse?: boolean;
  /** Used with `ensureNewProfileBeforeParse` — saved on profile before parse (template preservation). */
  profileName?: string;
  profileTemplate?: string;
};

function profileNameFromUploadFile(file: File): string {
  const base = file.name.replace(/\.(pdf|doc|docx|txt)$/i, '').trim();
  return (base.length > 0 ? base : 'Uploaded resume').slice(0, 100);
}

export function CVUploadZone({
  onSuccess,
  cvProfileId = null,
  ensureNewProfileBeforeParse = false,
  profileName,
  profileTemplate,
}: CVUploadZoneProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [skillsFound, setSkillsFound] = useState<number | null>(null);
  const [partialDismissed, setPartialDismissed] = useState(false);
  const [lastPartial, setLastPartial] = useState(false);
  const scopedId = cvProfileId?.trim() || null;
  const useNewProfileFlow = Boolean(ensureNewProfileBeforeParse) && !scopedId;
  const uploadMutation = useUploadCV(useNewProfileFlow ? null : cvProfileId);

  const createProfileThenParse = useMutation({
    mutationFn: async (file: File) => {
      const row = await api.cv.createProfile({
        name: profileName?.trim() || profileNameFromUploadFile(file),
        ...(profileTemplate?.trim() ? { template: profileTemplate.trim() } : {}),
      });
      const profileId = row.id.trim();
      if (!profileId) throw new Error('Could not create CV profile');
      trackConversionFunnelEvent('cv_created', {
        cvProfileId: profileId,
        via: 'upload_parse',
      });
      /**
       * Never use TanStack `retry` on the whole mutation: each retry would call `createProfile` again and
       * leave orphan empty profiles (duplicate rows in the list). Retry only `parse` below.
       */
      let lastError: unknown;
      for (let attempt = 0; attempt < 6; attempt++) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          return await api.cv.parse(formData, { rebuildSections: true, cvProfileId: profileId });
        } catch (e) {
          lastError = e;
          const nextAttempt = attempt + 1;
          if (nextAttempt >= 6) break;
          if (!cvParseMutationShouldRetry(nextAttempt, e)) break;
          const backoff = isTransientAiStructuredOutputError(e) ? 600 * nextAttempt : 400 * nextAttempt;
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
      throw lastError ?? new Error('CV parse failed');
    },
    retry: false,
    onSuccess: async (data) => {
      await refreshCvStateAfterCvParseSuccess(queryClient, data.profile);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
    },
  });

  const aiUsage = useDailyAiUsage();
  const toast = useToast();

  const applyUploadSuccess = (data: CvParseSuccessPayload) => {
    const s = data.profile?.structured;
    const skillCount =
      data.skillsFound ?? s?.skills?.length ?? s?.primarySkills?.length ?? null;
    setSkillsFound(skillCount);
    setLastPartial(Boolean(data.isPartialExtraction));
    setPartialDismissed(false);
    toast.success('Resume parsed successfully');
    onSuccess?.(data);
  };

  const upload = (file: File) => {
    if (!canUseAiFromDailyAiUsage(aiUsage)) {
      trackUpgradePrompted('cv_upload');
      toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    if (useNewProfileFlow) {
      createProfileThenParse.mutate(file, {
        onSuccess: (data) =>
          applyUploadSuccess({
            profile: data.profile,
            skillsFound: data.skillsFound,
            isPartialExtraction: data.isPartialExtraction,
            importSummary: data.importSummary,
          }),
        onError: (err) => {
          toast.error(
            getApiErrorMessage(err) ||
              'We could not parse your resume. Our free AI module may be busy. Please try again in a moment.',
          );
        },
      });
      return;
    }

    uploadMutation.mutate(formData, {
      onSuccess: (data) =>
        applyUploadSuccess({
          profile: data.profile,
          skillsFound: data.skillsFound,
          isPartialExtraction: data.isPartialExtraction,
          importSummary: data.importSummary,
        }),
      onError: (err) => {
        toast.error(
          getApiErrorMessage(err) ||
            'We could not parse your resume. Our free AI module may be busy. Please try again in a moment.',
        );
      },
    });
  };

  const isPending = useNewProfileFlow ? createProfileThenParse.isPending : uploadMutation.isPending;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && !isPending && (aiUsage.isPaidTier || aiUsage.isLoading || (aiUsage.remaining ?? 0) > 0))
          upload(file);
      }}
      className={`flex h-[200px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#00C9B1]/25 bg-[#111616] p-6 text-center ${
        !aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0 ? 'opacity-60' : ''
      } ${isPending ? 'pointer-events-none opacity-90' : ''}`}
    >
      {isPending ? (
        <CvUploadProgressSteps active className="py-2" />
      ) : skillsFound !== null ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="mx-auto h-10 w-10 rounded-full bg-[#00C9B1]/20 text-[#00C9B1]">✓</div>
            <p className="font-semibold text-white">Resume parsed successfully</p>
            <p className="text-sm text-[#9be8e8]">{skillsFound} skills found</p>
          </div>
          {lastPartial && !partialDismissed ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-relaxed text-amber-100/90">
                  Your resume was not fully extracted. Experience or education may be missing. Try
                  another file or re-upload.
                </p>
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-amber-200/80 underline"
                  onClick={() => setPartialDismissed(true)}
                >
                  Dismiss
                </button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 h-8 text-xs"
                onClick={() => {
                  setSkillsFound(null);
                  setPartialDismissed(false);
                  setLastPartial(false);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              >
                Re-upload
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <UploadCloud className="mb-2 h-8 w-8 text-[#00C9B1]" />
          <p className="font-medium text-white">Drop your resume here</p>
          <p className="mb-3 text-sm text-white/50">PDF, DOCX, or TXT. Max 5MB.</p>
          {!aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0 ? (
            <p className="mb-2 text-xs text-amber-200/90">{DAILY_AI_LIMIT_REACHED_MESSAGE}</p>
          ) : null}
          <Button
            variant="ghost"
            disabled={isPending || (!aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0)}
            onClick={() => inputRef.current?.click()}
          >
            Select file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            disabled={isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}
