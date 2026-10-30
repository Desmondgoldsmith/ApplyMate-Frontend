'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, FileText, Loader2, Lock, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { CvParseSuccessPayload } from '@/components/dashboard/CVUploadZone';
import { useToast } from '@/components/ui/Toast';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import {
  canUseAiFromDailyAiUsage,
  DAILY_AI_LIMIT_REACHED_MESSAGE,
} from '@/lib/ai-daily-usage';
import { api } from '@/lib/api';
import { trackUpgradePrompted } from '@/lib/analytics';
import { cvParseMutationShouldRetry, getApiErrorMessage } from '@/lib/axios';
import { refreshCvStateAfterCvParseSuccess } from '@/lib/cvParseCacheReconcile';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt'] as const;

/** Stage labels with the elapsed second each one starts at (parse usually takes 15–30s). */
const STAGES: ReadonlyArray<{ at: number; label: string }> = [
  { at: 0, label: 'Uploading your file' },
  { at: 2, label: 'Reading your CV' },
  { at: 7, label: 'Finding your experience and education' },
  { at: 14, label: 'Organising your skills' },
  { at: 21, label: 'Building your profile' },
];

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function validateFile(file: File): string | null {
  if (
    !(ACCEPTED_EXTENSIONS as readonly string[]).includes(
      fileExtension(file.name),
    )
  ) {
    return 'Please upload a PDF, Word (.docx) or text file.';
  }
  if (file.size > MAX_BYTES) {
    return 'That file is over 5 MB. Try exporting a smaller PDF.';
  }
  if (file.size === 0) return 'That file looks empty. Try another one.';
  return null;
}

export function OnboardingCvUpload({
  onSuccess,
}: {
  onSuccess: (result: CvParseSuccessPayload) => void;
}) {
  const reducedMotion = useReducedMotion();
  const toast = useToast();
  const queryClient = useQueryClient();
  const aiUsage = useDailyAiUsage();
  /** Same parse as `useUploadCV`, but cache refresh runs in the background so the review opens at once. */
  const upload = useMutation({
    mutationFn: (formData: FormData) =>
      api.cv.parse(formData, { rebuildSections: true }),
    retry: cvParseMutationShouldRetry,
    onSuccess: (result) => {
      void refreshCvStateAfterCvParseSuccess(queryClient, result.profile);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.analytics.root(),
      });
    },
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const busy = upload.isPending || finishing;
  const outOfCredits =
    !aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0;

  useEffect(() => {
    if (!upload.isPending) return;
    const started = Date.now();
    setElapsed(0);
    const id = window.setInterval(
      () => setElapsed((Date.now() - started) / 1000),
      250,
    );
    return () => window.clearInterval(id);
  }, [upload.isPending]);

  const start = (file: File) => {
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (!canUseAiFromDailyAiUsage(aiUsage)) {
      trackUpgradePrompted('cv_upload');
      setError(DAILY_AI_LIMIT_REACHED_MESSAGE);
      return;
    }
    setError(null);
    setFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);
    upload.mutate(formData, {
      onSuccess: (data) => {
        setFinishing(true);
        window.setTimeout(
          () =>
            onSuccess({
              profile: data.profile,
              skillsFound: data.skillsFound,
              isPartialExtraction: data.isPartialExtraction,
              importSummary: data.importSummary,
            }),
          reducedMotion ? 0 : 300,
        );
      },
      onError: (err) => {
        setFileName(null);
        const message =
          getApiErrorMessage(err) ||
          "We couldn't read that CV. Please try again in a moment, or paste the text instead.";
        setError(message);
        toast.error(message);
      },
    });
  };

  const progress = finishing
    ? 100
    : upload.isPending
      ? Math.min(94, 94 * (1 - Math.exp(-elapsed / 11)))
      : 0;
  const stageIndex = finishing
    ? STAGES.length
    : STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        {busy ? (
          <motion.div
            key="progress"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            className="w-full rounded-3xl border border-border-subtle bg-bg-surface p-6 text-left shadow-overlay sm:p-7"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-subtle ring-1 ring-accent-border">
                <FileText className="h-5 w-5 text-accent-text" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-text-primary">
                  {fileName ?? 'Your CV'}
                </p>
                <p className="text-[12px] text-text-tertiary">
                  {finishing
                    ? 'Done! Opening your results…'
                    : 'Usually takes 15–30 seconds'}
                </p>
              </div>
              <span className="ml-auto text-[13px] font-semibold tabular-nums text-accent-text">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-bg-hover">
              <motion.div
                className="relative h-full rounded-full bg-brand-gradient"
                animate={{ width: `${Math.max(3, progress)}%` }}
                transition={{
                  duration: reducedMotion ? 0 : 0.4,
                  ease: 'easeOut',
                }}
              >
                {!reducedMotion ? (
                  <motion.span
                    className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                ) : null}
              </motion.div>
            </div>
            <ol className="mt-5 space-y-2.5">
              {STAGES.map((s, i) => {
                const done = i < stageIndex;
                const current = i === stageIndex && !finishing;
                return (
                  <li
                    key={s.label}
                    className={cn(
                      'flex items-center gap-2.5 text-[13px] transition-colors duration-300',
                      done
                        ? 'text-text-secondary'
                        : current
                          ? 'text-text-primary'
                          : 'text-text-tertiary',
                    )}
                  >
                    {done ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-solid">
                        <Check
                          className="h-3 w-3 text-text-on-accent"
                          strokeWidth={3.5}
                        />
                      </span>
                    ) : current ? (
                      <Loader2 className="h-5 w-5 animate-spin text-accent-text" />
                    ) : (
                      <span className="h-5 w-5 rounded-full border border-border-default" />
                    )}
                    {s.label}
                  </li>
                );
              })}
            </ol>
          </motion.div>
        ) : (
          <motion.div
            key="zone"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload your CV. PDF, Word or text, up to 5 MB."
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragging) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) start(file);
              }}
              className={cn(
                'group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-12 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-border-focus',
                dragging
                  ? 'scale-[1.01] border-accent-solid bg-accent-subtle'
                  : 'border-border-strong bg-bg-surface shadow-raised hover:border-accent-solid hover:bg-accent-subtle',
                outOfCredits && 'pointer-events-none opacity-60',
              )}
            >
              <motion.span
                className="bg-brand-gradient flex h-16 w-16 items-center justify-center rounded-2xl text-text-on-accent shadow-raised"
                animate={
                  reducedMotion
                    ? undefined
                    : dragging
                      ? { y: -6, scale: 1.06 }
                      : { y: 0, scale: 1 }
                }
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <UploadCloud className="h-8 w-8" />
              </motion.span>
              <p className="mt-5 font-display text-[20px] font-bold tracking-[-0.02em] text-text-primary">
                {dragging ? 'Drop it here' : 'Drag your CV here'}
              </p>
              <p className="mt-1.5 text-[14px] text-text-secondary">
                or{' '}
                <span className="font-semibold text-accent-text underline-offset-4 group-hover:underline">
                  browse your files
                </span>
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {['PDF', 'Word (.docx)', 'Text'].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border-subtle bg-bg-sunken px-2.5 py-1 text-[12px] font-medium text-text-secondary"
                  >
                    {t}
                  </span>
                ))}
                <span className="rounded-full border border-border-subtle bg-bg-sunken px-2.5 py-1 text-[12px] font-medium text-text-secondary">
                  Up to 5 MB
                </span>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) start(file);
                e.target.value = '';
              }}
            />
            {error || outOfCredits ? (
              <p
                className="mt-3 rounded-xl border border-danger-border bg-danger-subtle px-3 py-2 text-left text-[13px] text-danger-text"
                role="alert"
              >
                {error ?? DAILY_AI_LIMIT_REACHED_MESSAGE}
              </p>
            ) : null}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-text-tertiary">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Your CV stays private. Only you can see it.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
