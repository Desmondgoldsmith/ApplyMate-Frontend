'use client';

import { FileText, Loader2, MessageSquare, Sparkles, UploadCloud, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
  CV_READY_TOAST,
  cvEditorPath,
  prefetchCvProfileForEditor,
} from '@/lib/cvProfileNavigation';
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
    <div className="flex justify-center gap-1.5 pb-2">
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
      : step === 'aiChat'
        ? 'max-w-2xl'
        : step === 'buildMethod'
          ? 'max-w-2xl'
          : 'max-w-lg';

  const showDots = step !== 'upload' && step !== 'aiChat';
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
        await openProfileInBuilder(profileId, { successToast: CV_READY_TOAST });
      } catch (e) {
        toast.error(getApiErrorMessage(e) || 'Failed to create CV from chat data');
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
            successToast: "CV profile created — let's build it out manually",
          });
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }, [createProfile, name, template, toast, openProfileInBuilder]);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o && !blockOverlayClose) close();
      }}
      className={cn(
        'border-0 bg-transparent p-0 shadow-none transition-[max-width] duration-200',
        modalWidth,
      )}
      closeOnOverlayClick={!blockOverlayClose}
      showCloseButton={!blockOverlayClose}
    >
      <GlowCard
        className="border border-[rgba(0,201,177,0.15)] shadow-[0_0_40px_rgba(0,201,177,0.12)]"
        contentClassName="flex min-h-0 min-w-0 flex-col p-6"
      >
        {showDots ? <StepDots current={step} /> : null}

        {/* ── STEP 1: Name ── */}
        {step === 'name' ? (
          <>
            <h2 className="text-lg font-bold text-white">Name your CV</h2>
            <p className="mt-2 text-[13px] text-white/55">
              Give it a name so you can find it easily
            </p>
            <div className="mt-5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) setStep('template');
                }}
                placeholder="e.g. Frontend Engineer CV"
                className="w-full rounded-xl border border-[rgba(0,201,177,0.15)] bg-[#111616] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00C9B1] focus:ring-2 focus:ring-[rgba(0,201,177,0.2)]"
                autoFocus
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="ghost" className="border border-white/10" onClick={close}>
                Cancel
              </Button>
              <Button type="button" disabled={!name.trim()} onClick={() => setStep('template')}>
                Next →
              </Button>
            </div>
          </>
        ) : step === 'template' ? (
          /* ── STEP 2: Template ── */
          <>
            <h2 className="text-lg font-bold text-white">Choose a template</h2>
            <p className="mt-2 text-[13px] text-white/55">You can change this later</p>
            <div className="mt-5 min-h-0 min-w-0 flex-1">
              <TemplatePicker selectedTemplate={template} onSelect={setTemplate} showHeader={false} />
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                className="text-sm text-white/45 transition hover:text-white"
                onClick={() => setStep('name')}
              >
                ← Back
              </button>
              <Button type="button" onClick={() => setStep('method')}>
                Next →
              </Button>
            </div>
          </>
        ) : step === 'method' ? (
          /* ── STEP 3: Method ── */
          <>
            <h2 className="text-lg font-bold text-white">How do you want to build it?</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                data-testid="cv-create-method-upload"
                onClick={() => setStep('upload')}
                className="flex flex-col items-start gap-3 rounded-xl border border-[rgba(0,201,177,0.2)] bg-[#111616]/80 p-4 text-left transition hover:border-[#00C9B1]/45 hover:bg-[#00C9B1]/5"
              >
                <UploadCloud className="h-8 w-8 text-[#00C9B1]" />
                <div>
                  <p className="text-sm font-semibold text-white">Upload my CV</p>
                  <p className="mt-1 text-xs text-white/45">Parse your existing CV instantly with AI</p>
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
                  <p className="mt-1 text-xs text-white/45">Build with AI chat or fill in the form manually</p>
                </div>
              </button>
            </div>
            <div className="mt-6 flex justify-start">
              <button
                type="button"
                className="text-sm text-white/45 transition hover:text-white"
                onClick={() => setStep('template')}
              >
                ← Back
              </button>
            </div>
          </>
        ) : step === 'buildMethod' ? (
          /* ── STEP 3b: AI Chat vs Manual ── */
          <>
            {createProfile.isPending ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#00C9B1]" />
                <p className="mt-4 text-sm font-semibold text-white/70">Creating your CV…</p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-white">How would you like to build your CV?</h2>
                <p className="mt-2 text-[13px] text-white/55">
                  Choose the approach that works best for you
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
                        Answer a few questions and our AI will build your CV for you — fast and guided.
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
                              successToast: CV_READY_TOAST,
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
                        Prefer to type it yourself? Use our structured form at your own pace.
                      </p>
                    </div>
                  </button>
                </div>
                <div className="mt-6 flex justify-start">
                  <button
                    type="button"
                    className="text-sm text-white/45 transition hover:text-white"
                    onClick={() => setStep('method')}
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}
          </>
        ) : step === 'aiChat' ? (
          /* ── AI Chat Flow ── */
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Build your CV with AI</h2>
              <button
                type="button"
                onClick={close}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/40 transition hover:border-white/25 hover:text-white/70"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-white/55">
              Answer a few questions or paste your full CV — we&apos;ll only ask about
              what&apos;s missing.
            </p>
            <div className="mt-4">
              {aiChatBuilding ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#00C9B1]" />
                  <p className="mt-4 text-sm font-semibold text-white/70">Building your CV…</p>
                </div>
              ) : (
                <CVChatInterface
                  selectedTemplate={template}
                  onComplete={(data) => void handleAiChatComplete(data)}
                  onSkip={handleAiChatSkip}
                />
              )}
            </div>
          </>
        ) : (
          /* ── Upload sub-step ── */
          <>
            <button
              type="button"
              className="mb-4 text-sm text-white/45 transition hover:text-white"
              onClick={() => setStep('method')}
            >
              ← Back
            </button>
            <h2 className="text-lg font-bold text-white">Upload your CV</h2>
            <p className="mt-2 text-[13px] text-white/55">We&apos;ll create a profile from your file.</p>
            <div className="mt-5">
              {uploadImportSummary && uploadProfileId ? (
                <CvParseImportSummaryPanel
                  importSummary={uploadImportSummary}
                  profileId={uploadProfileId}
                  onReviewInBuilder={() => {
                    void openProfileInBuilder(uploadProfileId, {
                      successToast: CV_READY_TOAST,
                    });
                  }}
                  onContinue={() => {
                    void openProfileInBuilder(uploadProfileId, {
                      successToast: null,
                    });
                  }}
                  continueLabel="Open CV editor"
                />
              ) : (
                <CVUploadZone
                  ensureNewProfileBeforeParse
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
                    await openProfileInBuilder(id, { successToast: CV_READY_TOAST });
                  }}
                />
              )}
            </div>
          </>
        )}
      </GlowCard>
    </Modal>
  );
}
