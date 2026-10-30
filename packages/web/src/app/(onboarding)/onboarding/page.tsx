'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardPaste,
  Loader2,
  MessageSquareText,
  PenLine,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CareerKiteMark } from '@/components/brand/CareerKiteMark';
import type { CvParseSuccessPayload } from '@/components/dashboard/CVUploadZone';
import { OnboardingComplete } from '@/components/onboarding/OnboardingComplete';
import { OnboardingCvReview } from '@/components/onboarding/OnboardingCvReview';
import { OnboardingCvUpload } from '@/components/onboarding/OnboardingCvUpload';
import {
  normalizeDiscoveryStep,
  OnboardingDiscovery,
  type DiscoveryStep,
} from '@/components/onboarding/OnboardingDiscovery';
import { OnboardingBackLink } from '@/components/onboarding/OnboardingBackLink';
import { OnboardingTemplateChooser } from '@/components/onboarding/OnboardingTemplateChooser';
import {
  ONBOARDING_SUBTITLE_CLASS,
  ONBOARDING_TITLE_CLASS,
} from '@/components/onboarding/onboardingLayout';
import { getOnboardingTemplateLabel } from '@/components/onboarding/TemplatePicker';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import {
  useOnboardingStatus,
  useSaveOnboardingProgress,
} from '@/hooks/useOnboarding';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  api,
  type ChatCreateCVPayload,
  type CVProfile,
  type CVScorePayload,
  type CVSectionRecord,
} from '@/lib/api';
import { trackConversionFunnelEvent } from '@/lib/analytics';
import { refreshCvStateAfterCvParseSuccess } from '@/lib/cvParseCacheReconcile';
import {
  cvEditorPath,
  prefetchCvProfileForEditor,
} from '@/lib/cvProfileNavigation';
import { CV_CHAT_INPUT_MAX_CHARS } from '@/lib/cv-chat-input.constants';
import {
  cvChatInputLimitErrorMessage,
  formatCvChatCharCount,
  isCvChatInputOverLimit,
} from '@/lib/cvChatInputDisplay';
import {
  saveCVBuilderData,
  transformSectionsToCVBuilderData,
  type CVBuilderData,
  type CvBuilderSaveStatus,
  type CvTemplateId,
  isCvTemplateId,
} from '@/lib/cvBuilder';
import {
  CV_SUGGESTIONS_QUERY_ROOT,
  cvSuggestionsQueryKey,
} from '@/lib/cvSuggestionsQuery';
import {
  inferCvProfileNameFromProfile,
  isGenericCvProfileName,
  normalizeProfessionalHeadlineTitle,
} from '@/lib/infer-cv-profile-name';
import {
  getApiErrorMessage,
  isTransientAiStructuredOutputError,
} from '@/lib/axios';
import { buildOnboardingDiscoveryApiFields } from '@/lib/onboardingDiscoveryApi';
import {
  clearStoredWizard,
  readStoredWizard,
  writeStoredWizard,
  type CvEntryPhase,
  type CvPath,
  type JobSearchUrgency,
} from '@/lib/onboardingWizardStorage';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

/** The editor and the AI chat are heavy and only needed on two of the CV paths. */
const OnboardingResumeClinic = dynamic(
  () =>
    import('@/components/onboarding/OnboardingResumeClinic').then(
      (m) => m.OnboardingResumeClinic,
    ),
  {
    ssr: false,
    loading: () => <OnboardingPanelLoading label="Opening the editor…" />,
  },
);
const CVChatInterface = dynamic(
  () =>
    import('@/components/onboarding/CVChatInterface').then(
      (m) => m.CVChatInterface,
    ),
  {
    ssr: false,
    loading: () => (
      <OnboardingPanelLoading label="Starting your CV assistant…" />
    ),
  },
);

function OnboardingPanelLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
      <p className="text-sm text-text-tertiary">{label}</p>
    </div>
  );
}

type FeatureId = 'jobs' | 'cv' | 'interviews' | 'student';
type OnboardingStep = 1 | 2 | 3;
type UploadStage = 'zone' | 'summary' | 'design';
type PasteStage = 'input' | 'review' | 'design';

const PASTE_STATUS_MESSAGES = [
  'Finding your experience…',
  'Organising your skills…',
  'Structuring your CV…',
  'Almost done…',
];

const PROCESSING_STEPS = [
  'Structuring your experience',
  'Writing clear bullet points',
  'Organising your skills',
  'Scoring your CV',
];

async function syncSuggestedCvProfileMetadata(
  profileId: string,
  profile: CVProfile,
  roleHint: string,
) {
  const hintPart = roleHint.split(',')[0]?.trim() ?? '';
  let headline = profile.headline?.trim() ?? '';
  const shortHeadline = headline
    ? normalizeProfessionalHeadlineTitle(headline)
    : '';
  if (shortHeadline && shortHeadline !== headline) {
    await api.cv.patchProfilesEntry(profileId, { headline: shortHeadline });
    headline = shortHeadline;
  }
  const merged: CVProfile = {
    ...profile,
    headline: headline || profile.headline,
  };
  const suggested = inferCvProfileNameFromProfile(merged, {
    roleHint: hintPart,
  });
  if (!isGenericCvProfileName(suggested)) {
    await api.cv.updateProfileName(profileId, suggested);
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const { data: me, isSuccess: meOk } = useCurrentUser();
  const saveProgress = useSaveOnboardingProgress();
  const onboardingStatus = useOnboardingStatus();
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authUser = useAuthStore((s) => s.user);

  const serverHydratedRef = useRef(false);
  const sessionBootRef = useRef(false);

  const [step, setStep] = useState<OnboardingStep>(1);
  const [discoveryStep, setDiscoveryStep] = useState<DiscoveryStep>(0);
  const [focusHired, setFocusHired] = useState(true);
  const [focusStudent, setFocusStudent] = useState(false);
  const [jobSearchUrgency, setJobSearchUrgency] =
    useState<JobSearchUrgency | null>(null);
  const [targetRolesText, setTargetRolesText] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralOther, setReferralOther] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSaveStatus, setManualSaveStatus] =
    useState<CvBuilderSaveStatus>('idle');
  const [cvPath, setCvPath] = useState<CvPath>(null);
  const [cvEntryPhase, setCvEntryPhase] = useState<CvEntryPhase>('paths');
  const [selectedTemplate, setSelectedTemplate] =
    useState<CvTemplateId>('modern');
  const [templateSaving, setTemplateSaving] = useState(false);
  /** AI chat and scratch paths pick a design before building (upload/paste pick after review). */
  const [entryDesignChosen, setEntryDesignChosen] = useState(false);
  const [onboardingSaved, setOnboardingSaved] = useState(false);
  const [pasteStage, setPasteStage] = useState<PasteStage>('input');
  const [uploadedScore, setUploadedScore] = useState<CVScorePayload | null>(
    null,
  );
  const [uploadParsedProfile, setUploadParsedProfile] =
    useState<CVProfile | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadStage>('zone');

  const [pasteText, setPasteText] = useState('');
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteStatusIdx, setPasteStatusIdx] = useState(0);
  const [pasteParsedProfile, setPasteParsedProfile] =
    useState<CVProfile | null>(null);
  const [pasteParsedProfileId, setPasteParsedProfileId] = useState<
    string | null
  >(null);

  const [processing, setProcessing] = useState(false);
  const [processingStepIdx, setProcessingStepIdx] = useState(0);
  const [finalScore, setFinalScore] = useState<CVScorePayload | null>(null);
  const [completionProfile, setCompletionProfile] = useState<CVProfile | null>(
    null,
  );
  const [completionSource, setCompletionSource] = useState<
    'skip' | 'upload' | 'chat' | 'paste' | 'manual'
  >('skip');

  const selectedArr = useMemo((): FeatureId[] => {
    const out: FeatureId[] = ['cv'];
    if (focusHired) {
      out.push('jobs', 'interviews');
    }
    return out;
  }, [focusHired]);
  const primaryGoal = useMemo(() => {
    if (focusHired) return 'jobs';
    return 'cv';
  }, [focusHired]);

  const firstName = useMemo(() => {
    const raw = (me?.name ?? authUser?.name ?? '').trim();
    if (!raw) return '';
    return raw.split(/\s+/)[0] ?? raw;
  }, [me?.name, authUser?.name]);

  const selectedTemplateRef = useRef(selectedTemplate);
  selectedTemplateRef.current = selectedTemplate;

  /** Chat + manual need a resume profile row; sections + builder expect it (same as dashboard create flow). */
  const onboardingCvProfileQuery = useQuery({
    queryKey: queryKeys.onboarding.cvDefaultProfile(accessToken ?? ''),
    queryFn: async () => {
      const profiles = await api.cv.listProfiles();
      const pick = profiles.find((p) => p.isDefault) ?? profiles[0];
      if (pick) return pick.id;
      const tpl = isCvTemplateId(selectedTemplateRef.current)
        ? selectedTemplateRef.current
        : 'modern';
      const row = await api.cv.createProfile({
        name: 'My resume',
        template: tpl,
      });
      trackConversionFunnelEvent('cv_created', {
        cvProfileId: row.id,
        template: tpl,
        via: 'onboarding',
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      return row.id;
    },
    enabled:
      Boolean(accessToken) &&
      step === 2 &&
      entryDesignChosen &&
      (cvPath === 'manual' || cvPath === 'chat'),
    staleTime: 60_000,
  });

  const cvSectionsQuery = useQuery({
    queryKey: queryKeys.cv.sectionsWithHidden(
      onboardingCvProfileQuery.data ?? '',
      true,
    ),
    queryFn: () => api.cv.getSections(true, onboardingCvProfileQuery.data),
    enabled:
      Boolean(accessToken) &&
      cvPath === 'manual' &&
      onboardingCvProfileQuery.isSuccess &&
      Boolean(onboardingCvProfileQuery.data),
  });
  const manualBuilderSections: CVSectionRecord[] = Array.isArray(
    cvSectionsQuery.data,
  )
    ? cvSectionsQuery.data
    : [];

  useLayoutEffect(() => {
    if (sessionBootRef.current) return;
    sessionBootRef.current = true;
    const s = readStoredWizard();
    if (!s) return;
    if (s.step === 2 || s.step === 3) setStep(s.step);
    if (
      s.cvPath === 'upload' ||
      s.cvPath === 'chat' ||
      s.cvPath === 'paste' ||
      s.cvPath === 'manual'
    ) {
      setCvPath(s.cvPath);
      setCvEntryPhase('paths');
    } else if (s.cvPath === 'build') {
      setCvPath(null);
    }
    if (s.uploadPhase === 'zone') setUploadPhase('zone');
    else if (
      s.uploadPhase === 'summary' ||
      s.uploadPhase === 'score' ||
      s.uploadPhase === 'design'
    )
      setUploadPhase('summary');
    if (
      typeof s.selectedTemplate === 'string' &&
      isCvTemplateId(s.selectedTemplate)
    ) {
      setSelectedTemplate(s.selectedTemplate);
    }
    if (
      typeof s.discoveryStep === 'number' &&
      s.discoveryStep >= 0 &&
      s.discoveryStep <= 4
    ) {
      setDiscoveryStep(normalizeDiscoveryStep(s.discoveryStep));
    }
    if (
      s.jobSearchUrgency === 'asap' ||
      s.jobSearchUrgency === 'few_months' ||
      s.jobSearchUrgency === 'exploring'
    ) {
      setJobSearchUrgency(s.jobSearchUrgency);
    }
    if (typeof s.targetRolesText === 'string')
      setTargetRolesText(s.targetRolesText);
    if (typeof s.referralSource === 'string')
      setReferralSource(s.referralSource);
    if (typeof s.referralOther === 'string') setReferralOther(s.referralOther);
    const hasFocusFlags =
      typeof s.focusHired === 'boolean' || typeof s.focusStudent === 'boolean';
    if (typeof s.focusHired === 'boolean') setFocusHired(s.focusHired);
    if (typeof s.focusStudent === 'boolean') setFocusStudent(false);
    if (!hasFocusFlags && s.selectedFeatures?.length) {
      let hired = false;
      let stud = false;
      for (const x of s.selectedFeatures) {
        if (x === 'jobs' || x === 'interviews') hired = true;
        if (x === 'student') stud = true;
      }
      setFocusHired(hired);
      setFocusStudent(stud);
    }
  }, []);

  useEffect(() => {
    // Do not persist step 3 — otherwise we overwrite `clearStoredWizard()` after onboarding completes.
    if (step === 3) return;
    writeStoredWizard({
      step,
      cvPath,
      cvEntryPhase,
      buildPhase: 'pick',
      uploadPhase,
      selectedTemplate,
      selectedFeatures: selectedArr,
      discoveryStep,
      focusHired,
      focusStudent,
      jobSearchUrgency,
      targetRolesText,
      referralSource,
      referralOther,
    });
  }, [
    step,
    cvPath,
    cvEntryPhase,
    uploadPhase,
    selectedTemplate,
    selectedArr,
    discoveryStep,
    focusHired,
    focusStudent,
    jobSearchUrgency,
    targetRolesText,
    referralSource,
    referralOther,
  ]);

  useEffect(() => {
    if (!accessToken) return;
    if (serverHydratedRef.current) return;
    if (onboardingStatus.isPending) return;
    if (onboardingStatus.isError) {
      serverHydratedRef.current = true;
      return;
    }
    if (!onboardingStatus.isSuccess) return;
    const d = onboardingStatus.data;
    if (!d) {
      serverHydratedRef.current = true;
      return;
    }
    serverHydratedRef.current = true;
    if (d.completed === true) {
      router.replace('/dashboard');
      return;
    }
    const serverStep =
      typeof d.step === 'number' && d.step >= 1 && d.step <= 3
        ? (d.step as OnboardingStep)
        : undefined;
    const stored = readStoredWizard();
    const storedStep = stored?.step;
    const mergedStep =
      serverStep !== undefined
        ? typeof storedStep === 'number' &&
          storedStep >= 1 &&
          storedStep <= 3 &&
          storedStep > serverStep
          ? storedStep
          : serverStep
        : undefined;
    startTransition(() => {
      if (mergedStep !== undefined) {
        setStep(mergedStep);
      }
      if (
        typeof d.focusGetHired === 'boolean' ||
        typeof d.focusStudentLaunchpad === 'boolean'
      ) {
        if (typeof d.focusGetHired === 'boolean')
          setFocusHired(d.focusGetHired);
        if (typeof d.focusStudentLaunchpad === 'boolean')
          setFocusStudent(false);
      } else if (d.selectedFeatures?.length) {
        let hired = false;
        let stud = false;
        for (const x of d.selectedFeatures) {
          if (x === 'jobs' || x === 'interviews') hired = true;
          if (x === 'student') stud = true;
        }
        setFocusHired(hired);
        setFocusStudent(stud);
      }
      const ju = d.jobSearchUrgency;
      if (ju === 'asap' || ju === 'few_months' || ju === 'exploring')
        setJobSearchUrgency(ju);
      else if (ju === null) setJobSearchUrgency(null);
      if (Array.isArray(d.targetRoles) && d.targetRoles.length > 0) {
        setTargetRolesText(d.targetRoles.join(', '));
      }
      const rs = d.referralSource;
      if (typeof rs === 'string' && rs.length > 0) {
        setReferralSource(rs);
        const ro = d.referralOther;
        if (typeof ro === 'string') setReferralOther(ro);
      }
    });
    if (d.step === 2 && d.hasCV === true) {
      const st = readStoredWizard();
      const path = st?.cvPath;
      if (path === 'upload') {
        setCvPath('upload');
        setCvEntryPhase('paths');
        void (async () => {
          try {
            const scoreData = await api.cv.getScore();
            setUploadedScore(scoreData);
            try {
              setUploadParsedProfile(await api.cv.getProfile());
            } catch {
              setUploadParsedProfile(null);
            }
            setUploadPhase(st?.uploadPhase === 'zone' ? 'zone' : 'summary');
          } catch {
            setUploadPhase('zone');
          }
        })();
      }
    }
  }, [accessToken, onboardingStatus, router]);

  useEffect(() => {
    if (step !== 1) return;
    if (meOk && me?.onboardingCompleted === true) {
      router.replace('/dashboard');
    }
  }, [meOk, me?.onboardingCompleted, router, step]);

  const triggerPostCvScore = useCallback(async () => {
    try {
      const detailed = await api.cv.getScoreDetailed();
      queryClient.setQueryData(cvSuggestionsQueryKey(null), {
        improvements: detailed.improvements ?? [],
        needsScoring: false,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.cv.scoreRoot(),
      });
      await queryClient.invalidateQueries({
        queryKey: CV_SUGGESTIONS_QUERY_ROOT,
      });
    } catch {
      /* optional */
    }
  }, [queryClient]);

  /** Shows the review right away; score, naming and progress save run in the background. */
  const onUploadParsed = useCallback(
    async (parse?: CvParseSuccessPayload) => {
      let profile = parse?.profile ?? null;
      if (profile) setUploadParsedProfile(profile);
      setUploadPhase('summary');
      if (!profile) {
        try {
          profile = await api.cv.getProfile();
          setUploadParsedProfile(profile);
        } catch {
          /* review shows its loading state until sections arrive */
        }
      }
      for (const queryKey of [
        queryKeys.cv.profileDefault(),
        queryKeys.cv.scoreRoot(),
        queryKeys.analytics.root(),
        queryKeys.cv.profiles(),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
      void api.cv
        .getScore(profile?.id)
        .then(setUploadedScore, () => setUploadedScore({ score: null }));
      void triggerPostCvScore();
      if (profile) {
        void syncSuggestedCvProfileMetadata(
          profile.id,
          profile,
          targetRolesText,
        ).catch(() => {
          /* optional */
        });
      }
      void saveProgress.mutateAsync({ step: 2, hasCV: true }).catch(() => {
        // non-critical — do not block the upload flow
      });
    },
    [queryClient, triggerPostCvScore, saveProgress, targetRolesText],
  );

  const finalizeOnboarding = useCallback(async () => {
    const features = selectedArr.includes('cv')
      ? selectedArr
      : [...selectedArr, 'cv'];
    await api.onboarding.saveProgress({
      step: 3,
      completed: true,
      selectedFeatures: features,
      primaryGoal,
    });
    clearStoredWizard();
    await queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.auth.me(accessToken ?? ''),
    });
    const u = useAuthStore.getState().user;
    const token = useAuthStore.getState().accessToken;
    if (u && token) {
      setAuth(
        {
          ...u,
          onboardingCompleted: true,
          selectedFeatures: features,
          primaryGoal,
        },
        token,
      );
    }
  }, [accessToken, primaryGoal, queryClient, selectedArr, setAuth]);

  const ranFinalize = useRef(false);
  useEffect(() => {
    if (step !== 3) return;
    if (ranFinalize.current) return;
    ranFinalize.current = true;
    void finalizeOnboarding()
      .then(() => setOnboardingSaved(true))
      .catch(() => {
        /* best-effort */
      });
  }, [finalizeOnboarding, step]);

  const openResumeEditor = useCallback(
    async (profileId: string | null | undefined) => {
      const id = profileId?.trim();
      if (!id) {
        toast.error('Resume is not ready yet. Try again in a moment.');
        return;
      }
      try {
        if (useAuthStore.getState().user?.onboardingCompleted !== true) {
          await finalizeOnboarding();
        }
        await prefetchCvProfileForEditor(queryClient, id);
        router.push(cvEditorPath(id));
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    },
    [finalizeOnboarding, queryClient, router, toast],
  );

  const resetCvStep = useCallback(() => {
    setCvPath(null);
    setCvEntryPhase('paths');
    setEntryDesignChosen(false);
    setUploadPhase('zone');
    setUploadedScore(null);
    setUploadParsedProfile(null);
    setPasteText('');
    setPasteError(null);
    setFinalScore(null);
    setCompletionProfile(null);
    setManualSubmitting(false);
  }, []);

  const handleManualBuilderComplete = useCallback(
    async (data: CVBuilderData) => {
      const profileId = onboardingCvProfileQuery.data;
      if (!profileId) {
        toast.error(
          'Resume workspace is not ready yet. Please wait a moment and try again.',
        );
        return;
      }
      setManualSubmitting(true);
      try {
        const sections = await api.cv.getSections(true, profileId);
        await saveCVBuilderData(data, sections, {
          template: selectedTemplate,
          cvProfileId: profileId,
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.cv.sectionsRoot(),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.cv.profileDefault(),
        });
        const { profile } = await api.cv.getProfileById(profileId);
        try {
          await syncSuggestedCvProfileMetadata(
            profileId,
            profile,
            targetRolesText,
          );
        } catch {
          /* optional */
        }
        let score: CVScorePayload;
        try {
          score = await api.cv.getScore(profileId);
        } catch {
          score = { score: null };
        }
        setCompletionProfile(profile);
        setFinalScore(score);
        setCompletionSource('manual');
        void triggerPostCvScore();
        await saveProgress.mutateAsync({ step: 2, hasCV: true });
        setStep(3);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setManualSubmitting(false);
      }
    },
    [
      onboardingCvProfileQuery.data,
      queryClient,
      saveProgress,
      selectedTemplate,
      targetRolesText,
      toast,
      triggerPostCvScore,
    ],
  );

  const skipManualResumeOnboarding = useCallback(async () => {
    setFinalScore(null);
    setCompletionProfile(null);
    await saveProgress.mutateAsync({ step: 2, hasCV: false });
    setCompletionSource('skip');
    setStep(3);
  }, [saveProgress]);

  /** The CV being reviewed / styled in step 2 (upload or paste path). */
  const reviewProfile =
    cvPath === 'upload'
      ? uploadParsedProfile
      : cvPath === 'paste'
        ? pasteParsedProfile
        : null;
  const reviewProfileId =
    (cvPath === 'paste' ? pasteParsedProfileId : reviewProfile?.id)?.trim() ||
    null;
  const reviewActive =
    step === 2 &&
    ((cvPath === 'upload' && uploadPhase !== 'zone') ||
      (cvPath === 'paste' && pasteStage !== 'input'));
  const reviewSectionsQuery = useQuery({
    queryKey: queryKeys.onboarding.cvReview(reviewProfileId ?? ''),
    queryFn: () => api.cv.getProfileById(reviewProfileId ?? ''),
    enabled: Boolean(accessToken) && reviewActive && Boolean(reviewProfileId),
    staleTime: 30_000,
  });
  const reviewData = useMemo((): CVBuilderData | null => {
    const detail = reviewSectionsQuery.data;
    if (!detail || !Array.isArray(detail.sections)) return null;
    return transformSectionsToCVBuilderData(
      detail.profile ?? reviewProfile,
      detail.sections,
      { email: me?.email ?? authUser?.email ?? undefined },
    );
  }, [authUser?.email, me?.email, reviewProfile, reviewSectionsQuery.data]);

  useEffect(() => {
    if (!pasteSubmitting) return;
    const id = window.setInterval(() => {
      setPasteStatusIdx((i) => (i + 1) % PASTE_STATUS_MESSAGES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [pasteSubmitting]);

  useEffect(() => {
    if (!processing) return;
    const id = window.setInterval(() => {
      setProcessingStepIdx((i) => (i + 1) % PROCESSING_STEPS.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [processing]);

  const runProcessingThenFinish = useCallback(
    async (opts: {
      source: 'chat' | 'paste';
      payload?: ChatCreateCVPayload;
      profileId?: string;
      profile?: CVProfile;
    }) => {
      setProcessing(true);
      setProcessingStepIdx(0);
      try {
        let profileOut: CVProfile | null = opts.profile ?? null;
        let persistProfileId = (opts.profileId ?? profileOut?.id ?? '').trim();
        if (opts.source === 'chat' && opts.payload) {
          const scoped = (opts.profileId ?? '').trim();
          const created = await api.cv.chatCreateCV({
            ...opts.payload,
            template: selectedTemplate,
            ...(scoped ? { cvProfileId: scoped } : {}),
          });
          profileOut = created.profile;
          persistProfileId = created.profileId;
        }
        setCompletionProfile(profileOut);
        if (persistProfileId && profileOut) {
          try {
            await syncSuggestedCvProfileMetadata(
              persistProfileId,
              profileOut,
              targetRolesText,
            );
          } catch {
            /* optional */
          }
        }
        const sid = persistProfileId;
        const score = await api.cv.getScore(sid || undefined);
        setFinalScore(score);
        setCompletionSource(opts.source);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.cv.profiles(),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.analytics.root(),
        });
        void triggerPostCvScore();
        await saveProgress.mutateAsync({ step: 2, hasCV: true });
        setStep(3);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setProcessing(false);
      }
    },
    [
      queryClient,
      saveProgress,
      selectedTemplate,
      targetRolesText,
      toast,
      triggerPostCvScore,
    ],
  );

  const submitPaste = useCallback(async () => {
    const raw = pasteText.trim();
    if (raw.length < 50) return;
    if (isCvChatInputOverLimit(raw.length)) {
      setPasteError(cvChatInputLimitErrorMessage(raw.length));
      return;
    }
    setPasteError(null);
    setPasteSubmitting(true);
    setPasteStatusIdx(0);
    try {
      let profile: CVProfile | undefined;
      let profileId: string | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const r = await api.cv.parseTextCV({
            rawText: raw,
            template: selectedTemplate,
          });
          profile = r.profile;
          profileId = r.profileId;
          break;
        } catch (e) {
          if (!isTransientAiStructuredOutputError(e) || attempt === 4) throw e;
          await new Promise((res) =>
            window.setTimeout(res, 400 * (attempt + 1)),
          );
        }
      }
      if (!profile || !profileId) throw new Error('parse failed');
      await refreshCvStateAfterCvParseSuccess(queryClient, profile);
      setPasteParsedProfile(profile);
      setPasteParsedProfileId(profileId);
      setPasteSubmitting(false);
      setPasteStage('review');
    } catch (e) {
      setPasteSubmitting(false);
      setPasteError(
        getApiErrorMessage(e) ||
          "We couldn't read that text. Check it includes your work history and try again.",
      );
    }
  }, [pasteText, queryClient, selectedTemplate]);

  /** Saves the chosen design, then finishes the CV step (paste paths still run scoring). */
  const confirmDesign = useCallback(
    async (source: 'upload' | 'paste') => {
      const profileId = reviewProfileId;
      if (!profileId) return;
      setTemplateSaving(true);
      try {
        await api.cv.updateTemplate(selectedTemplate, profileId);
      } catch {
        // design is cosmetic and editable later — never block finishing onboarding
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv.profileDefault(),
      });
      try {
        if (source === 'paste' && pasteParsedProfile) {
          await runProcessingThenFinish({
            source: 'paste',
            profileId,
            profile: { ...pasteParsedProfile, template: selectedTemplate },
          });
          return;
        }
        await saveProgress.mutateAsync({ step: 2, hasCV: true });
        setCompletionSource('upload');
        setFinalScore(uploadedScore);
        setCompletionProfile(
          uploadParsedProfile
            ? { ...uploadParsedProfile, template: selectedTemplate }
            : null,
        );
        setStep(3);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setTemplateSaving(false);
      }
    },
    [
      pasteParsedProfile,
      queryClient,
      reviewProfileId,
      runProcessingThenFinish,
      saveProgress,
      selectedTemplate,
      toast,
      uploadParsedProfile,
      uploadedScore,
    ],
  );

  const entryDesignStage =
    step === 2 &&
    (cvPath === 'chat' || cvPath === 'manual') &&
    !entryDesignChosen;
  const designStage =
    entryDesignStage ||
    (step === 2 &&
      ((cvPath === 'upload' && uploadPhase === 'design') ||
        (cvPath === 'paste' && pasteStage === 'design')));
  const manualResumeEditorShell =
    step === 2 && cvPath === 'manual' && entryDesignChosen;
  const wideStep2 =
    step === 2 && (cvPath === 'chat' || manualResumeEditorShell || designStage);

  const progressHint =
    step === 1
      ? 'Part 1 of 3 · About you'
      : step === 2
        ? 'Part 2 of 3 · Your CV'
        : "Part 3 of 3 · You're ready";

  /** How far through the current part the user is, so the progress bar moves on every screen. */
  const stepProgress =
    step === 1
      ? discoveryStep === 0
        ? 0.1
        : discoveryStep === 1
          ? 0.35
          : discoveryStep === 2
            ? 0.6
            : 0.85
      : step === 2
        ? cvPath === null
          ? 0.12
          : cvPath === 'upload'
            ? uploadPhase === 'zone'
              ? 0.35
              : uploadPhase === 'summary'
                ? 0.65
                : 0.88
            : cvPath === 'paste'
              ? pasteStage === 'input'
                ? 0.35
                : pasteStage === 'review'
                  ? 0.65
                  : 0.88
              : entryDesignChosen
                ? 0.6
                : 0.35
        : 1;

  return (
    <OnboardingShell
      step={step}
      wide={wideStep2}
      hideProgressChrome={manualResumeEditorShell}
      forcedTheme={manualResumeEditorShell ? 'dark' : undefined}
      fillViewportHeight={manualResumeEditorShell}
      progressHint={manualResumeEditorShell ? undefined : progressHint}
      stepProgress={stepProgress}
    >
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <OnboardingDiscovery
              firstName={firstName}
              discoveryStep={discoveryStep}
              jobSearchUrgency={jobSearchUrgency}
              onSelectUrgency={(v) => setJobSearchUrgency(v)}
              targetRolesText={targetRolesText}
              onTargetRolesChange={setTargetRolesText}
              savePending={saveProgress.isPending}
              onBack={() =>
                setDiscoveryStep((d) => (d === 3 ? 2 : d === 2 ? 1 : 0))
              }
              onNext={async () => {
                if (discoveryStep === 0) {
                  setDiscoveryStep(1);
                  return;
                }
                if (discoveryStep === 1) {
                  setDiscoveryStep(2);
                  return;
                }
                if (discoveryStep === 2) {
                  setDiscoveryStep(3);
                  return;
                }
                setCvPath(null);
                setCvEntryPhase('paths');
                setStep(2);
                try {
                  // Referral is asked (optionally) on the final screen instead.
                  const discovery = buildOnboardingDiscoveryApiFields({
                    focusHired,
                    focusStudent: false,
                    jobSearchUrgency,
                    targetRolesText,
                    referralSource,
                    referralOther,
                    referralSkipped: !referralSource.trim(),
                  });
                  await saveProgress.mutateAsync({
                    step: 2,
                    selectedFeatures: selectedArr.includes('cv')
                      ? selectedArr
                      : [...selectedArr, 'cv'],
                    primaryGoal,
                    ...(discovery ?? {}),
                  });
                } catch (e) {
                  toast.error(getApiErrorMessage(e));
                }
              }}
            />
          </motion.div>
        ) : null}

        {step === 2 && !processing && !manualSubmitting ? (
          <motion.div
            key="s2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'mx-auto w-full',
              manualResumeEditorShell
                ? 'flex min-h-0 max-w-[min(100%,1320px)] flex-1 flex-col overflow-hidden'
                : designStage
                  ? 'max-w-[1040px]'
                  : cvPath === 'paste' || cvPath === 'chat'
                    ? 'flex min-h-0 max-w-[680px] flex-1 flex-col overflow-hidden'
                    : 'max-w-[620px] space-y-6',
            )}
          >
            {cvPath === null ? (
              <>
                <div className="flex w-full flex-col items-center text-center">
                  <OnboardingBackLink
                    disabled={saveProgress.isPending}
                    onClick={async () => {
                      setCvPath(null);
                      setCvEntryPhase('paths');
                      setDiscoveryStep(3);
                      setStep(1);
                      try {
                        const discovery = buildOnboardingDiscoveryApiFields({
                          focusHired,
                          focusStudent: false,
                          jobSearchUrgency,
                          targetRolesText,
                          referralSource,
                          referralOther,
                          referralSkipped: !referralSource.trim(),
                        });
                        await saveProgress.mutateAsync({
                          step: 1,
                          selectedFeatures: selectedArr.includes('cv')
                            ? selectedArr
                            : [...selectedArr, 'cv'],
                          primaryGoal,
                          ...(discovery ?? {}),
                        });
                      } catch (e) {
                        toast.error(getApiErrorMessage(e));
                      }
                    }}
                  />
                  <h2 className={ONBOARDING_TITLE_CLASS}>
                    How would you like to add your CV?
                  </h2>
                  <p className={ONBOARDING_SUBTITLE_CLASS}>
                    We&apos;ll read it, show you what we found and score it, so
                    you see results straight away.
                  </p>
                </div>

                <div className="mt-8 flex w-full flex-col gap-3">
                  <CvEntryPathCard
                    recommended
                    index={0}
                    icon={<UploadCloud className="h-6 w-6" />}
                    label="Upload my CV"
                    description="PDF or Word. Fastest if you already have one."
                    timeLabel="About 1 min"
                    onClick={() => setCvPath('upload')}
                  />
                  <CvEntryPathCard
                    index={1}
                    icon={<ClipboardPaste className="h-6 w-6" />}
                    label="Paste the text"
                    description="Copy from a document or your LinkedIn profile."
                    timeLabel="About 1 min"
                    onClick={() => {
                      setPasteStage('input');
                      setCvPath('paste');
                    }}
                  />
                  <CvEntryPathCard
                    index={2}
                    icon={<MessageSquareText className="h-6 w-6" />}
                    label="Create one with AI"
                    description="Answer a few questions and we'll write your CV for you."
                    timeLabel="About 3 min"
                    onClick={() => setCvPath('chat')}
                  />
                  <CvEntryPathCard
                    index={3}
                    icon={<PenLine className="h-6 w-6" />}
                    label="Start from scratch"
                    description="Fill in each section yourself in our editor."
                    timeLabel="About 5 min"
                    onClick={() => setCvPath('manual')}
                  />
                </div>

                <button
                  type="button"
                  className="mx-auto mt-6 flex min-h-[44px] w-full items-center justify-center text-center text-[13px] text-text-tertiary transition hover:text-text-secondary"
                  onClick={async () => {
                    setFinalScore(null);
                    setCompletionProfile(null);
                    await saveProgress.mutateAsync({ step: 2, hasCV: false });
                    setCompletionSource('skip');
                    setStep(3);
                  }}
                >
                  I&apos;ll add my CV later
                </button>
              </>
            ) : null}

            {entryDesignStage ? (
              <div className="flex w-full flex-col items-center pt-2 text-center">
                <OnboardingBackLink
                  onClick={() => {
                    setCvPath(null);
                    setCvEntryPhase('paths');
                  }}
                />
                <StageHeading
                  title="Choose a design"
                  subtitle={
                    cvPath === 'chat'
                      ? "Pick a look first. We'll write your CV into it as we chat."
                      : 'Pick a look first. You can switch designs any time in the editor.'
                  }
                />
                <OnboardingTemplateChooser
                  data={null}
                  selected={selectedTemplate}
                  onSelect={setSelectedTemplate}
                  onConfirm={() => setEntryDesignChosen(true)}
                  saving={false}
                  confirmLabel={`Continue with ${getOnboardingTemplateLabel(selectedTemplate)}`}
                />
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {cvPath === 'chat' && entryDesignChosen ? (
                <motion.div
                  key="chat"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden"
                  data-lenis-prevent-wheel
                >
                  <div className="app-scrollbar flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pt-2">
                    <OnboardingBackLink
                      label="Back to designs"
                      onClick={() => setEntryDesignChosen(false)}
                    />
                    {onboardingCvProfileQuery.isError ? (
                      <Panel className="p-6 text-center">
                        <p className="text-sm text-text-secondary">
                          We couldn&apos;t prepare your resume workspace. Check
                          your connection and try again.
                        </p>
                        <Button
                          variant="accent"
                          className="mt-4 px-7"
                          onClick={() =>
                            void onboardingCvProfileQuery.refetch()
                          }
                        >
                          Retry
                        </Button>
                      </Panel>
                    ) : onboardingCvProfileQuery.isPending ? (
                      <Panel className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                        <Loader2 className="h-9 w-9 animate-spin text-accent-text" />
                        <p className="text-sm text-text-tertiary">
                          Preparing your resume workspace…
                        </p>
                      </Panel>
                    ) : (
                      <div className="w-full">
                        <CVChatInterface
                          selectedTemplate={selectedTemplate}
                          onSkip={async () => {
                            setFinalScore(null);
                            setCompletionProfile(null);
                            await saveProgress.mutateAsync({
                              step: 2,
                              hasCV: false,
                            });
                            setCompletionSource('skip');
                            setStep(3);
                          }}
                          onComplete={async (data) => {
                            const pid = onboardingCvProfileQuery.data?.trim();
                            if (!pid) {
                              toast.error(
                                'Resume workspace is not ready. Please tap Retry above.',
                              );
                              return;
                            }
                            await runProcessingThenFinish({
                              source: 'chat',
                              payload: data,
                              profileId: pid,
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {cvPath === 'paste' ? (
                <motion.div
                  key="paste"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden"
                  data-lenis-prevent-wheel
                >
                  <div className="app-scrollbar flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pt-2">
                    <OnboardingBackLink
                      onClick={() => {
                        if (pasteStage === 'design') {
                          setPasteStage('review');
                          return;
                        }
                        if (pasteStage === 'review') {
                          setPasteStage('input');
                          return;
                        }
                        setCvPath(null);
                        setCvEntryPhase('paths');
                        setPasteError(null);
                        setPasteParsedProfile(null);
                        setPasteParsedProfileId(null);
                      }}
                    />
                    {pasteStage === 'review' && !pasteSubmitting ? (
                      <>
                        <StageHeading
                          title="Check what we found"
                          subtitle="Here's what we pulled from your text. If anything's off, you can fix it in the editor."
                        />
                        <OnboardingCvReview
                          data={reviewData}
                          loading={reviewSectionsQuery.isPending}
                          error={reviewSectionsQuery.isError}
                          onRetry={() => void reviewSectionsQuery.refetch()}
                          onContinue={() => setPasteStage('design')}
                          onFixInEditor={() =>
                            void openResumeEditor(pasteParsedProfileId)
                          }
                          onUploadAnother={() => setPasteStage('input')}
                          uploadAnotherLabel="Edit the text"
                        />
                      </>
                    ) : pasteStage === 'design' && !pasteSubmitting ? (
                      <>
                        <StageHeading
                          title="Choose a design"
                          subtitle="Every design below is your own CV. Pick the one you like best."
                        />
                        <OnboardingTemplateChooser
                          data={reviewData}
                          selected={selectedTemplate}
                          onSelect={setSelectedTemplate}
                          onConfirm={() => void confirmDesign('paste')}
                          saving={templateSaving}
                        />
                      </>
                    ) : !pasteSubmitting ? (
                      <Panel className="flex min-h-0 flex-col overflow-hidden p-5">
                        <p className="text-[15px] font-semibold text-text-primary">
                          Paste your CV
                        </p>
                        <p className="mt-1 text-xs text-text-tertiary">
                          Your full CV, LinkedIn profile or job history notes,
                          up to {CV_CHAT_INPUT_MAX_CHARS.toLocaleString()}{' '}
                          characters.
                        </p>
                        <textarea
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          aria-label="CV text"
                          placeholder="Paste your CV text here. Include your job titles, companies, dates, education and skills. The more you share, the better the result."
                          rows={12}
                          data-lenis-prevent-wheel
                          className="app-scrollbar mt-3 min-h-[220px] max-h-[min(55vh,520px)] w-full flex-1 resize-y overflow-y-auto rounded-xl border border-border-strong bg-bg-sunken px-3.5 py-3 text-[14px] leading-relaxed text-text-primary outline-none transition-[border-color,box-shadow] placeholder:text-text-tertiary focus:border-border-focus focus:shadow-[0_0_0_3px_var(--ck-accent-subtle)]"
                        />
                        <p
                          className={cn(
                            'mt-2 text-right text-[11px]',
                            isCvChatInputOverLimit(pasteText.length)
                              ? 'text-danger-text'
                              : 'text-text-tertiary',
                          )}
                        >
                          {formatCvChatCharCount(pasteText.length)}
                        </p>
                        {pasteError ? (
                          <p className="mt-2 text-sm text-danger-text">
                            {pasteError}
                          </p>
                        ) : null}
                        <Button
                          variant="accent"
                          fullWidth
                          className="mt-4 inline-flex items-center justify-center gap-2"
                          disabled={
                            pasteText.trim().length < 50 ||
                            saveProgress.isPending
                          }
                          onClick={() => void submitPaste()}
                        >
                          <Sparkles className="h-4 w-4 shrink-0" />
                          Build my CV from this text
                          <ArrowRight
                            className="h-4 w-4 shrink-0"
                            strokeWidth={2.5}
                          />
                        </Button>
                        <button
                          type="button"
                          className="mx-auto mt-4 block w-full text-center text-[13px] text-text-tertiary hover:text-text-secondary"
                          onClick={async () => {
                            setFinalScore(null);
                            setCompletionProfile(null);
                            await saveProgress.mutateAsync({
                              step: 2,
                              hasCV: false,
                            });
                            setCompletionSource('skip');
                            setStep(3);
                          }}
                        >
                          I&apos;ll add my CV later
                        </button>
                      </Panel>
                    ) : (
                      <Panel className="p-10 text-center">
                        <p className="flex items-center justify-center gap-2 text-lg font-semibold text-text-primary">
                          <Sparkles className="h-5 w-5 text-accent-text" />
                          Reading your CV…
                        </p>
                        <p className="mt-1 text-[12px] text-text-tertiary">
                          Usually takes 15–30 seconds
                        </p>
                        <div className="mx-auto mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-bg-hover">
                          <motion.div
                            className="h-full bg-accent-solid"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                            style={{ width: '40%' }}
                          />
                        </div>
                        <p className="mt-6 text-sm text-text-tertiary">
                          {PASTE_STATUS_MESSAGES[pasteStatusIdx]}
                        </p>
                      </Panel>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {cvPath === 'manual' && entryDesignChosen ? (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className={cn(
                    'min-h-0 min-w-0 overflow-x-hidden',
                    onboardingCvProfileQuery.data &&
                      !onboardingCvProfileQuery.isError &&
                      !onboardingCvProfileQuery.isPending &&
                      !cvSectionsQuery.isPending &&
                      !cvSectionsQuery.isError
                      ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                      : 'overflow-y-visible',
                  )}
                >
                  <div
                    className={cn(
                      onboardingCvProfileQuery.data &&
                        !onboardingCvProfileQuery.isError &&
                        !onboardingCvProfileQuery.isPending &&
                        !cvSectionsQuery.isPending &&
                        !cvSectionsQuery.isError
                        ? 'flex min-h-0 flex-1 flex-col pt-0'
                        : 'pt-2',
                    )}
                  >
                    {onboardingCvProfileQuery.isError ? (
                      <Panel className="p-6 text-center">
                        <p className="text-sm text-text-secondary">
                          We couldn&apos;t prepare your resume workspace. Check
                          your connection and try again.
                        </p>
                        <Button
                          variant="accent"
                          className="mt-4 px-7"
                          onClick={() =>
                            void onboardingCvProfileQuery.refetch()
                          }
                        >
                          Retry
                        </Button>
                      </Panel>
                    ) : onboardingCvProfileQuery.isPending ? (
                      <Panel className="flex flex-col items-center justify-center gap-4 p-16 text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-accent-text" />
                        <p className="text-sm text-text-tertiary">
                          Preparing your resume workspace…
                        </p>
                      </Panel>
                    ) : cvSectionsQuery.isPending ? (
                      <Panel className="flex flex-col items-center justify-center gap-4 p-16 text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-accent-text" />
                        <p className="text-sm text-text-tertiary">
                          Loading your resume…
                        </p>
                      </Panel>
                    ) : cvSectionsQuery.isError ? (
                      <Panel className="p-6 text-center">
                        <p className="text-sm text-text-secondary">
                          We couldn&apos;t load the editor. Check your
                          connection and try again.
                        </p>
                        <Button
                          variant="accent"
                          className="mt-4 px-7"
                          onClick={() => {
                            void onboardingCvProfileQuery.refetch();
                            void cvSectionsQuery.refetch();
                          }}
                        >
                          Retry
                        </Button>
                      </Panel>
                    ) : onboardingCvProfileQuery.data ? (
                      <OnboardingResumeClinic
                        profileId={onboardingCvProfileQuery.data}
                        sections={manualBuilderSections}
                        selectedTemplate={selectedTemplate}
                        onTemplateIdChange={setSelectedTemplate}
                        onBack={() => setEntryDesignChosen(false)}
                        onDashboardSaved={() => {
                          void queryClient.invalidateQueries({
                            queryKey: queryKeys.cv.sectionsRoot(),
                          });
                        }}
                        onSaveStatusChange={setManualSaveStatus}
                        onContinue={(d) => void handleManualBuilderComplete(d)}
                        onSkip={() => void skipManualResumeOnboarding()}
                        continueDisabled={
                          manualSaveStatus === 'saving' ||
                          saveProgress.isPending ||
                          manualSubmitting
                        }
                      />
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {cvPath === 'upload' ? (
                <motion.div
                  key="upload"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="min-h-0 overflow-x-hidden overflow-y-visible"
                >
                  <div className="flex w-full flex-col items-center pt-2 text-center">
                    <OnboardingBackLink
                      onClick={() => {
                        if (uploadPhase === 'design') {
                          setUploadPhase('summary');
                          return;
                        }
                        resetCvStep();
                      }}
                    />
                    {uploadPhase === 'zone' ? (
                      <>
                        <StageHeading
                          title="Upload your CV"
                          subtitle="We'll read it and show you what we found, so you can check it before moving on."
                        />
                        <OnboardingCvUpload
                          onSuccess={(data) => {
                            void onUploadParsed(data);
                          }}
                        />
                      </>
                    ) : null}
                    {uploadPhase === 'summary' ? (
                      <>
                        <StageHeading
                          title="Check what we found"
                          subtitle="Make sure the important details look right. You can fix anything later in the editor."
                        />
                        <OnboardingCvReview
                          data={reviewData}
                          loading={
                            !uploadParsedProfile ||
                            reviewSectionsQuery.isPending
                          }
                          error={reviewSectionsQuery.isError}
                          onRetry={() => void reviewSectionsQuery.refetch()}
                          onContinue={() => setUploadPhase('design')}
                          onFixInEditor={() =>
                            void openResumeEditor(uploadParsedProfile?.id)
                          }
                          onUploadAnother={() => {
                            setUploadPhase('zone');
                            setUploadParsedProfile(null);
                            setUploadedScore(null);
                          }}
                        />
                      </>
                    ) : null}
                    {uploadPhase === 'design' ? (
                      <>
                        <StageHeading
                          title="Choose a design"
                          subtitle="Every design below is your own CV. Pick the one you like best."
                        />
                        <OnboardingTemplateChooser
                          data={reviewData}
                          selected={selectedTemplate}
                          onSelect={setSelectedTemplate}
                          onConfirm={() => void confirmDesign('upload')}
                          saving={templateSaving}
                        />
                      </>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}

        {processing || manualSubmitting ? (
          <motion.div
            key="proc"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center"
            role="status"
            aria-live="polite"
          >
            <motion.span
              className="text-text-primary"
              animate={
                reducedMotion
                  ? undefined
                  : { y: [0, -10, 0], rotate: [0, -3, 0] }
              }
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <CareerKiteMark size={84} variant="full" />
            </motion.span>
            <p className="mt-7 font-display text-[28px] font-bold tracking-[-0.03em] text-text-primary">
              {manualSubmitting
                ? 'Saving and scoring your CV…'
                : 'Building your CV…'}
            </p>
            <p className="mt-2 text-[14px] text-text-secondary">
              Usually under a minute. Please keep this tab open.
            </p>
            <ul className="mt-8 w-full space-y-3 rounded-2xl border border-border-subtle bg-bg-surface p-5 text-left text-[14px] shadow-raised">
              {PROCESSING_STEPS.map((label, i) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-text-secondary"
                >
                  {i < processingStepIdx ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-success-text"
                      strokeWidth={3}
                    />
                  ) : i === processingStepIdx ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-text" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border border-border-strong" />
                  )}
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}

        {step === 3 && !processing && !manualSubmitting ? (
          <OnboardingComplete
            firstName={firstName}
            finalScore={finalScore}
            profileId={completionProfile?.id ?? null}
            completionSource={completionSource}
            templateLabel={
              completionSource === 'skip'
                ? null
                : getOnboardingTemplateLabel(
                    completionProfile?.template ?? selectedTemplate,
                  )
            }
            accessToken={accessToken}
            onboardingSaved={onboardingSaved}
            initialReferral={referralSource.trim() || undefined}
            onOpenResumeEditor={openResumeEditor}
          />
        ) : null}
      </AnimatePresence>
    </OnboardingShell>
  );
}

function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'w-full rounded-3xl border border-border-subtle bg-bg-surface shadow-raised',
        className,
      )}
    >
      {children}
    </div>
  );
}

function StageHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-7 flex w-full flex-col items-center text-center">
      <h2 className={ONBOARDING_TITLE_CLASS}>{title}</h2>
      <p className={ONBOARDING_SUBTITLE_CLASS}>{subtitle}</p>
    </div>
  );
}

function CvEntryPathCard({
  recommended,
  index,
  icon,
  label,
  description,
  timeLabel,
  onClick,
}: {
  recommended?: boolean;
  index: number;
  icon: ReactNode;
  label: string;
  description: string;
  timeLabel: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.06 * index,
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'group relative flex w-full min-h-[44px] items-center gap-4 overflow-hidden rounded-2xl border px-4 py-4 text-left shadow-raised transition-[border-color,background-color] duration-200 sm:px-5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        recommended
          ? 'border-accent-solid bg-accent-subtle'
          : 'border-border-default bg-bg-surface hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
          recommended
            ? 'bg-brand-gradient text-text-on-accent'
            : 'bg-accent-subtle text-accent-text',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold text-text-primary">
            {label}
          </span>
          {recommended ? (
            <span className="rounded-full bg-accent-solid px-2 py-0.5 text-[11px] font-semibold text-text-on-accent">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-text-secondary">
          {description}
        </span>
      </span>
      <span className="hidden shrink-0 rounded-full border border-border-subtle bg-bg-sunken px-2.5 py-1 text-[12px] font-medium text-text-secondary sm:inline">
        {timeLabel}
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-text-tertiary transition-all group-hover:translate-x-0.5 group-hover:text-text-primary"
        aria-hidden
      />
    </motion.button>
  );
}
