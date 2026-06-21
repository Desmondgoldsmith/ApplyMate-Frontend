'use client';

import { FileText, Loader2, MessageSquare, Sparkles, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { CvCreationModalHeader } from '@/components/cv/CvCreationModalHeader';
import { CvParseImportSummaryPanel } from '@/components/cv/CvParseImportSummaryPanel';
import { CVUploadZone } from '@/components/dashboard/CVUploadZone';
import { CVChatInterface } from '@/components/onboarding/CVChatInterface';
import { TemplatePicker } from '@/components/onboarding/TemplatePicker';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCreateCVProfile } from '@/hooks/useCreateCVProfile';
import { api, type ChatCreateCVPayload, type CvParseImportSummary } from '@/lib/api';
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

type FlowStep = 'name' | 'template' | 'method' | 'buildMethod' | 'upload' | 'aiChat';

const MAIN_STEPS: FlowStep[] = ['name', 'template', 'method'];

function StepDots({ current }: { current: FlowStep }) {
  const idx = MAIN_STEPS.indexOf(current);
  const activeIdx = idx >= 0 ? idx : MAIN_STEPS.length - 1;
  return (
    <div className="flex justify-center gap-1.5 pb-3">
      {MAIN_STEPS.map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            i <= activeIdx ? 'bg-[#00C9B1]' : 'bg-white/10',
          )}
        />
      ))}
    </div>
  );
}

export function CreateCVProfileModal({ open, onOpenChange }: CreateCVProfileModalProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const createProfile = useCreateCVProfile();
  const [step, setStep] = useState<FlowStep>('name');
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('modern');
  const [aiChatBuilding, setAiChatBuilding] = useState(false);
  const [uploadImportSummary, setUploadImportSummary] =
    useState<CvParseImportSummary | null>(null);
  const [uploadProfileId, setUploadProfileId] = useState<string | null>(null);

  const close = useCallback(() => {
    setStep('name');
    setName('');
    setTemplate('modern');
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

  const modalWidth =
    step === 'template'
      ? 'max-w-4xl'
      : step === 'aiChat' || step === 'buildMethod'
        ? 'max-w-2xl'
        : 'max-w-lg';

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
        await openProfileInBuilder(profileId, { successToast: RESUME_READY_TOAST });
      } catch (e) {
        toast.error(getApiErrorMessage(e) || 'Failed to create resume from chat data');
      } finally {
        setAiChatBuilding(false);
      }
    },
    [template, name, toast, openProfileInBuilder],
  );

  const handleAiChatSkip = useCallback(() => {
    createProfile.mutate(
      { name: name.trim() || undefined, template },
      {
        onSuccess: (row) => {
          void openProfileInBuilder(row.id, {
            successToast: "Resume profile created — let's build it out manually",
          });
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }, [createProfile, name, template, toast, openProfileInBuilder]);

  const goBack = () => {
    if (step === 'template') setStep('name');
    else if (step === 'method') setStep('template');
    else if (step === 'buildMethod' || step === 'upload') setStep('method');
    else if (step === 'aiChat') setStep('buildMethod');
  };

  const showBack =
    step !== 'name' &&
    !(step === 'upload' && uploadImportSummary) &&
    !createProfile.isPending;

  const headerTitle =
    step === 'name'
      ? 'Name your resume'
      : step === 'template'
        ? 'Choose a template'
        : step === 'method'
          ? 'How do you want to build it?'
          : step === 'buildMethod'
            ? 'Start from scratch'
            : step === 'aiChat'
              ? 'Build with AI'
              : uploadImportSummary
                ? 'Import complete'
                : 'Upload your resume';

  const headerSubtitle =
    step === 'name'
      ? 'Give it a name so you can find it easily.'
      : step === 'template'
        ? 'You can change this later in the editor.'
        : step === 'upload' && !uploadImportSummary
          ? "We'll create a profile from your file and keep your template choice."
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
        className="flex min-h-0 flex-1 flex-col border border-[rgba(0,201,177,0.15)] shadow-[0_0_40px_rgba(0,201,177,0.12)]"
        contentClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 sm:p-6"
      >
        <CvCreationModalHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          onBack={showBack ? goBack : undefined}
          onClose={blockOverlayClose ? undefined : close}
          showClose={!blockOverlayClose}
        />

        {step !== 'upload' && step !== 'aiChat' && !uploadImportSummary ? (
          <StepDots current={step} />
        ) : null}

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {step === 'name' ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) setStep('template');
              }}
              placeholder="e.g. Frontend Engineer resume"
              className="w-full rounded-xl border border-[rgba(0,201,177,0.15)] bg-[#111616] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00C9B1] focus:ring-2 focus:ring-[rgba(0,201,177,0.2)]"
              autoFocus
            />
          ) : null}

          {step === 'template' ? (
            <TemplatePicker
              selectedTemplate={template}
              onSelect={setTemplate}
              showHeader={false}
              layout="onboardingGrid"
            />
          ) : null}

          {step === 'method' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                data-testid="cv-create-method-upload"
                onClick={() => setStep('upload')}
                className="flex flex-col items-start gap-3 rounded-xl border border-[rgba(0,201,177,0.2)] bg-[#111616]/80 p-4 text-left transition hover:border-[#00C9B1]/45 hover:bg-[#00C9B1]/5"
              >
                <UploadCloud className="h-8 w-8 text-[#00C9B1]" />
                <div>
                  <p className="text-sm font-semibold text-white">Upload my resume</p>
                  <p className="mt-1 text-xs text-white/45">
                    Parse your existing resume instantly with AI
                  </p>
                </div>
              </button>
              <button
                type="button"
                data-testid="cv-create-method-scratch"
                onClick={() => setStep('buildMethod')}
                className="flex flex-col items-start gap-3 rounded-xl border border-[rgba(0,201,177,0.2)] bg-[#111616]/80 p-4 text-left transition hover:border-[#00C9B1]/45 hover:bg-[#00C9B1]/5"
              >
                <Sparkles className="h-8 w-8 text-[#00C9B1]" />
                <div>
                  <p className="text-sm font-semibold text-white">Start from scratch</p>
                  <p className="mt-1 text-xs text-white/45">
                    Build with AI chat or fill in the form manually
                  </p>
                </div>
              </button>
            </div>
          ) : null}

          {step === 'buildMethod' ? (
            createProfile.isPending ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#00C9B1]" />
                <p className="mt-4 text-sm font-semibold text-white/70">Creating your resume…</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  data-testid="cv-create-ai-chat"
                  onClick={handleStartAiChat}
                  className="relative flex flex-col items-start gap-3 rounded-xl border border-[rgba(0,201,177,0.2)] bg-[#111616]/80 p-4 text-left transition hover:border-[#00C9B1]/45 hover:bg-[#00C9B1]/5"
                >
                  <span className="absolute right-3 top-3 rounded-full bg-[#00C9B1]/15 px-2 py-0.5 text-[10px] font-semibold text-[#00C9B1]">
                    Recommended
                  </span>
                  <MessageSquare className="h-8 w-8 text-[#00C9B1]" />
                  <div>
                    <p className="text-sm font-semibold text-white">Chat with AI</p>
                    <p className="mt-1 text-xs text-white/45">
                      Answer a few questions and our AI will build your resume for you.
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="cv-create-manual"
                  onClick={() => {
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
                  }}
                  className="flex flex-col items-start gap-3 rounded-xl border border-[rgba(0,201,177,0.2)] bg-[#111616]/80 p-4 text-left transition hover:border-[#00C9B1]/45 hover:bg-[#00C9B1]/5"
                >
                  <FileText className="h-8 w-8 text-[#00C9B1]" />
                  <div>
                    <p className="text-sm font-semibold text-white">Fill in manually</p>
                    <p className="mt-1 text-xs text-white/45">
                      Use our structured form at your own pace.
                    </p>
                  </div>
                </button>
              </div>
            )
          ) : null}

          {step === 'aiChat' ? (
            aiChatBuilding ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#00C9B1]" />
                <p className="mt-4 text-sm font-semibold text-white/70">Building your resume…</p>
              </div>
            ) : (
              <CVChatInterface
                selectedTemplate={template}
                onComplete={(data) => void handleAiChatComplete(data)}
                onSkip={handleAiChatSkip}
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
                    toast.error('Upload succeeded but no profile id was returned.');
                    return;
                  }
                  if (importSummary) {
                    setUploadProfileId(id);
                    setUploadImportSummary(importSummary);
                    return;
                  }
                  await openProfileInBuilder(id, { successToast: RESUME_READY_TOAST });
                }}
              />
            )
          ) : null}
        </div>

        {step === 'name' ? (
          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/[0.06] pt-4">
            <Button type="button" variant="ghost" className="border border-white/10" onClick={close}>
              Cancel
            </Button>
            <Button type="button" disabled={!name.trim()} onClick={() => setStep('template')}>
              Next →
            </Button>
          </div>
        ) : null}

        {step === 'template' ? (
          <div className="mt-6 flex shrink-0 justify-end border-t border-white/[0.06] pt-4">
            <Button type="button" onClick={() => setStep('method')}>
              Next →
            </Button>
          </div>
        ) : null}
      </GlowCard>
    </Modal>
  );
}
