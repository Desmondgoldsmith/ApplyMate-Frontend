'use client';

import { FileText, Loader2, MessageSquare, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { CvCreationModalHeader } from '@/components/cv/CvCreationModalHeader';
import { CvParseImportSummaryPanel } from '@/components/cv/CvParseImportSummaryPanel';
import { CVUploadZone } from '@/components/dashboard/CVUploadZone';
import { CVChatInterface } from '@/components/onboarding/CVChatInterface';
import { GlowCard } from '@/components/ui/GlowCard';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCreateCVProfile } from '@/hooks/useCreateCVProfile';
import {
  api,
  type ChatCreateCVPayload,
  type CvParseImportSummary,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import {
  cvEditorPath,
  prefetchCvProfileForEditor,
} from '@/lib/cvProfileNavigation';
import { RESUME_READY_TOAST } from '@/lib/resumeDisplayCopy';
import { cn } from '@/lib/utils';

type CreateCVProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** One choice screen, then the chosen path. The design can be changed later in the editor. */
type FlowStep = 'start' | 'upload' | 'aiChat';

const DEFAULT_TEMPLATE = 'modern';

const startCardClass =
  'relative flex h-full flex-col items-start gap-3 rounded-xl border border-border-default bg-bg-sunken p-4 text-left transition hover:border-accent-border hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-60';

export function CreateCVProfileModal({
  open,
  onOpenChange,
}: CreateCVProfileModalProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const createProfile = useCreateCVProfile();
  const [step, setStep] = useState<FlowStep>('start');
  const [name, setName] = useState('');
  const template = DEFAULT_TEMPLATE;
  const [aiChatBuilding, setAiChatBuilding] = useState(false);
  const [uploadImportSummary, setUploadImportSummary] =
    useState<CvParseImportSummary | null>(null);
  const [uploadProfileId, setUploadProfileId] = useState<string | null>(null);

  const close = useCallback(() => {
    setStep('start');
    setName('');
    setAiChatBuilding(false);
    setUploadImportSummary(null);
    setUploadProfileId(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const openProfileInBuilder = useCallback(
    async (id: string, opts?: { successToast?: string | null }) => {
      const trimmed = id.trim();
      if (!trimmed) return;
      await prefetchCvProfileForEditor(queryClient, trimmed);
      close();
      const message = opts?.successToast;
      if (message) toast.success(message);
      router.push(cvEditorPath(trimmed));
    },
    [close, queryClient, router, toast],
  );

  const modalWidth = step === 'upload' ? 'max-w-lg' : 'max-w-2xl';

  const blockOverlayClose =
    createProfile.isPending || step === 'aiChat' || aiChatBuilding;

  const handleStartAiChat = useCallback(() => {
    setStep('aiChat');
  }, []);

  const handleAiChatComplete = useCallback(
    async (extractedData: ChatCreateCVPayload) => {
      setAiChatBuilding(true);
      try {
        const { profileId } = await api.cv.chatCreateCV({
          ...extractedData,
          template,
          ...(name.trim() ? { name: name.trim() } : {}),
        });
        await openProfileInBuilder(profileId, {
          successToast: RESUME_READY_TOAST,
        });
      } catch (e) {
        toast.error(
          getApiErrorMessage(e) || 'Failed to create resume from chat data',
        );
      } finally {
        setAiChatBuilding(false);
      }
    },
    [template, name, toast, openProfileInBuilder],
  );

  const createBlank = useCallback(() => {
    createProfile.mutate(
      { name: name.trim() || undefined, template },
      {
        onSuccess: (row) => {
          void openProfileInBuilder(row.id, {
            successToast: RESUME_READY_TOAST,
          });
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }, [createProfile, name, template, toast, openProfileInBuilder]);

  const goBack = () => setStep('start');

  const showBack =
    step !== 'start' &&
    !(step === 'upload' && uploadImportSummary) &&
    !createProfile.isPending &&
    !aiChatBuilding;

  const headerTitle =
    step === 'start'
      ? 'New CV'
      : step === 'aiChat'
        ? 'Build with AI'
        : uploadImportSummary
          ? 'Import complete'
          : 'Upload your CV';

  const headerSubtitle =
    step === 'start'
      ? 'Pick how to start. You can change the design anytime in the editor.'
      : step === 'upload' && !uploadImportSummary
        ? 'PDF or Word. We read it and fill in your CV for you.'
        : step === 'upload' && uploadImportSummary
          ? 'Review what we extracted, then open the editor.'
          : undefined;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o && !blockOverlayClose) close();
      }}
      className={cn(
        'flex max-h-[min(85dvh,880px)] flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none transition-[max-width] duration-200',
        modalWidth,
      )}
      closeOnOverlayClick={!blockOverlayClose}
      showCloseButton={false}
      scrollBody={false}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0 pt-0"
    >
      <GlowCard
        className="flex min-h-0 flex-1 flex-col border border-accent-border shadow-[0_0_40px_rgba(0,201,177,0.12)]"
        contentClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 sm:p-6"
      >
        <CvCreationModalHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          onBack={showBack ? goBack : undefined}
          onClose={blockOverlayClose ? undefined : close}
          showClose={!blockOverlayClose}
        />

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {step === 'start' ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="new-cv-name"
                  className="mb-1.5 block text-[13px] font-medium text-text-secondary"
                >
                  Name{' '}
                  <span className="font-normal text-text-tertiary">
                    (optional)
                  </span>
                </label>
                <input
                  id="new-cv-name"
                  type="text"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Frontend Engineer CV"
                  className="w-full rounded-xl border border-border-default bg-bg-sunken px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-solid focus:ring-2 focus:ring-accent-border"
                />
              </div>
              {createProfile.isPending ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
                  <p className="mt-4 text-sm font-semibold text-text-secondary">
                    Creating your CV…
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    data-testid="cv-create-method-upload"
                    onClick={() => setStep('upload')}
                    className={cn(startCardClass, 'border-accent-border')}
                  >
                    <span className="absolute right-3 top-3 rounded-full bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold text-accent-text">
                      Fastest
                    </span>
                    <UploadCloud className="h-7 w-7 text-accent-text" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        Upload my CV
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        We read your file and fill everything in.
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    data-testid="cv-create-ai-chat"
                    onClick={handleStartAiChat}
                    className={startCardClass}
                  >
                    <MessageSquare className="h-7 w-7 text-accent-text" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        Chat with AI
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        Answer a few questions and AI writes it for you.
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    data-testid="cv-create-manual"
                    onClick={createBlank}
                    className={startCardClass}
                  >
                    <FileText className="h-7 w-7 text-accent-text" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        Start blank
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        Type it in yourself, straight on the page.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {step === 'aiChat' ? (
            aiChatBuilding ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
                <p className="mt-4 text-sm font-semibold text-text-secondary">
                  Building your resume…
                </p>
              </div>
            ) : (
              <CVChatInterface
                selectedTemplate={template}
                onComplete={(data) => void handleAiChatComplete(data)}
                onSkip={createBlank}
              />
            )
          ) : null}

          {step === 'upload' ? (
            uploadImportSummary && uploadProfileId ? (
              <CvParseImportSummaryPanel
                embedded
                importSummary={uploadImportSummary}
                onContinue={() => {
                  void openProfileInBuilder(uploadProfileId, {
                    successToast: RESUME_READY_TOAST,
                  });
                }}
                continueLabel="Open resume editor"
              />
            ) : (
              <CVUploadZone
                ensureNewProfileBeforeParse
                profileName={name.trim() || undefined}
                profileTemplate={template}
                onSuccess={async ({ profile, importSummary }) => {
                  const id = profile.id?.trim();
                  if (!id) {
                    toast.error(
                      'Upload succeeded but no profile id was returned.',
                    );
                    return;
                  }
                  if (importSummary) {
                    setUploadProfileId(id);
                    setUploadImportSummary(importSummary);
                    return;
                  }
                  await openProfileInBuilder(id, {
                    successToast: RESUME_READY_TOAST,
                  });
                }}
              />
            )
          ) : null}
        </div>
      </GlowCard>
    </Modal>
  );
}
