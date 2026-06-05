'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  PenLine,
  Pencil,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import Link from 'next/link';
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

import { OnboardingResumeClinic } from '@/components/onboarding/OnboardingResumeClinic';
import { CvParseImportSummaryPanel } from '@/components/cv/CvParseImportSummaryPanel';
import { CVScoreCard } from '@/components/cv/CVScoreCard';
import {
  CVUploadZone,
  type CvParseSuccessPayload,
} from '@/components/dashboard/CVUploadZone';
import { CVChatInterface } from '@/components/onboarding/CVChatInterface';
import { OnboardingDiscovery } from '@/components/onboarding/OnboardingDiscovery';
import {
  getOnboardingTemplateLabel,
  TemplatePicker,
} from '@/components/onboarding/TemplatePicker';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
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
  type CvParseImportSummary,
} from '@/lib/api';
import { trackConversionFunnelEvent } from '@/lib/analytics';
import { refreshCvStateAfterCvParseSuccess } from '@/lib/cvParseCacheReconcile';
import { cvEditorPath } from '@/lib/cvProfileNavigation';
import { CV_CHAT_INPUT_MAX_CHARS } from '@/lib/cv-chat-input.constants';
import {
  cvChatInputLimitErrorMessage,
  formatCvChatCharCount,
  isCvChatInputOverLimit,
} from '@/lib/cvChatInputDisplay';
import {
  saveCVBuilderData,
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

type FeatureId = 'jobs' | 'cv' | 'interviews' | 'student';
type OnboardingStep = 1 | 2 | 3;

const PASTE_STATUS_MESSAGES = [
  'Extracting your experience…',
  'Writing professional bullets…',
  'Organising your skills…',
  'Almost done…',
];

const PROCESSING_STEPS = [
  'Structuring your experience',
  'Writing professional bullets',
  'Organising your skills',
  'Scoring your resume',
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

function formatOnboardingLayoutLabel(detectedLayout: string): string {
  const labels: Record<string, string> = {
    'single-column': 'single column',
    'two-column-sidebar': 'two column with sidebar',
    'two-column-equal': 'two column',
    unknown: 'unknown',
  };
  return labels[detectedLayout] ?? detectedLayout;
}

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: me, isSuccess: meOk } = useCurrentUser();
  const saveProgress = useSaveOnboardingProgress();
  const onboardingStatus = useOnboardingStatus();
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authUser = useAuthStore((s) => s.user);

  const serverHydratedRef = useRef(false);
  const sessionBootRef = useRef(false);

  const [step, setStep] = useState<OnboardingStep>(1);
  const [discoveryStep, setDiscoveryStep] = useState(0);
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
  const [cvEntryPhase, setCvEntryPhase] = useState<CvEntryPhase>('template');
  const [selectedTemplate, setSelectedTemplate] =
    useState<CvTemplateId>('modern');
  const [uploadedScore, setUploadedScore] = useState<CVScorePayload | null>(
    null,
  );
  const [uploadParsedProfile, setUploadParsedProfile] =
    useState<CVProfile | null>(null);
  const [sectionCount, setSectionCount] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'zone' | 'summary' | 'score'>('zone');
  const [uploadImportSummary, setUploadImportSummary] =
    useState<CvParseImportSummary | null>(null);

  const [pasteText, setPasteText] = useState('');
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteStatusIdx, setPasteStatusIdx] = useState(0);
  const [pasteImportSummary, setPasteImportSummary] =
    useState<CvParseImportSummary | null>(null);
  const [pasteParsedProfile, setPasteParsedProfile] = useState<CVProfile | null>(null);
  const [pasteParsedProfileId, setPasteParsedProfileId] = useState<string | null>(null);

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
    if (focusStudent) {
      out.push('student');
    }
    return out;
  }, [focusHired, focusStudent]);
  const primaryGoal = useMemo(() => {
    if (focusHired && !focusStudent) return 'jobs';
    if (focusStudent && !focusHired) return 'student';
    if (focusHired && focusStudent) return 'jobs';
    return 'cv';
  }, [focusHired, focusStudent]);

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
    if (
      !(
        s.cvPath === 'upload' ||
        s.cvPath === 'chat' ||
        s.cvPath === 'paste' ||
        s.cvPath === 'manual'
      )
    ) {
      if (s.cvEntryPhase === 'template' || s.cvEntryPhase === 'paths')
        setCvEntryPhase(s.cvEntryPhase);
    }
    if (s.uploadPhase === 'zone' || s.uploadPhase === 'score')
      setUploadPhase(s.uploadPhase);
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
      setDiscoveryStep(s.discoveryStep);
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
    if (typeof s.focusStudent === 'boolean') setFocusStudent(s.focusStudent);
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
          setFocusStudent(d.focusStudentLaunchpad);
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
            const list = await api.cv.getSections(true);
            setSectionCount(Array.isArray(list) ? list.length : 0);
            try {
              setUploadParsedProfile(await api.cv.getProfile());
            } catch {
              setUploadParsedProfile(null);
            }
            setUploadPhase(st?.uploadPhase === 'zone' ? 'zone' : 'score');
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.cv.scoreRoot() });
      await queryClient.invalidateQueries({
        queryKey: CV_SUGGESTIONS_QUERY_ROOT,
      });
    } catch {
      /* optional */
    }
  }, [queryClient]);

  const onUploadParsed = useCallback(
    async (parse?: CvParseSuccessPayload) => {
      const fresh = parse?.profile;
      await queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.cv.sectionsRoot() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.cv.scoreRoot() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      const list = await queryClient.fetchQuery({
        queryKey: queryKeys.cv.sectionsActive(true),
        queryFn: () => api.cv.getSections(true),
      });
      setSectionCount(Array.isArray(list) ? list.length : 0);
      try {
        const scoreData = await api.cv.getScore();
        setUploadedScore(scoreData);
      } catch {
        setUploadedScore({ score: null });
      }
      void triggerPostCvScore();
      if (fresh) {
        setUploadParsedProfile(fresh);
        try {
          await syncSuggestedCvProfileMetadata(
            fresh.id,
            fresh,
            targetRolesText,
          );
        } catch {
          /* optional */
        }
      } else {
        try {
          const profile = await api.cv.getProfile();
          setUploadParsedProfile(profile);
          await syncSuggestedCvProfileMetadata(
            profile.id,
            profile,
            targetRolesText,
          );
        } catch {
          /* optional */
        }
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      setUploadImportSummary(parse?.importSummary ?? null);
      setUploadPhase(parse?.importSummary ? 'summary' : 'score');
      try {
        await saveProgress.mutateAsync({ step: 2, hasCV: true });
      } catch {
        // non-critical — do not block the upload flow
      }
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
    void finalizeOnboarding().catch(() => {
      /* best-effort */
    });
  }, [finalizeOnboarding, step]);

  const resetCvStep = useCallback(() => {
    setCvPath(null);
    setCvEntryPhase('paths');
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
        await queryClient.invalidateQueries({ queryKey: queryKeys.cv.sectionsRoot() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
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

  useEffect(() => {
    const t = uploadParsedProfile?.template;
    if (isCvTemplateId(t)) {
      setSelectedTemplate(t);
    }
  }, [uploadParsedProfile?.template]);

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
        if (persistProfileId) {
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
        void triggerPostCvScore();
        await saveProgress.mutateAsync({ step: 2, hasCV: true });
        setStep(3);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setProcessing(false);
      }
    },
    [queryClient, saveProgress, targetRolesText, toast, triggerPostCvScore],
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
      let importSummary: CvParseImportSummary | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const r = await api.cv.parseTextCV({
            rawText: raw,
            template: selectedTemplate,
          });
          profile = r.profile;
          profileId = r.profileId;
          importSummary = r.importSummary;
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
      setPasteImportSummary(importSummary);
      setPasteSubmitting(false);
      if (!importSummary) {
        await runProcessingThenFinish({ source: 'paste', profileId, profile });
      }
    } catch (e) {
      setPasteSubmitting(false);
      setPasteError(
        getApiErrorMessage(e) || 'Could not parse your text. Try again.',
      );
    }
  }, [pasteText, queryClient, runProcessingThenFinish, selectedTemplate]);

  const wideStep2 = step === 2 && (cvPath === 'chat' || cvPath === 'manual');

  const manualResumeEditorShell = step === 2 && cvPath === 'manual';

  const progressHint =
    step === 1
      ? 'Part 1 of 3 · Your Goals'
      : step === 2
        ? 'Part 2 of 3 · Your Resume'
        : "Part 3 of 3 · You're Ready";

  return (
    <OnboardingShell
      step={step}
      wide={wideStep2}
      hideProgressChrome={manualResumeEditorShell}
      fillViewportHeight={manualResumeEditorShell}
      progressHint={manualResumeEditorShell ? undefined : progressHint}
    >
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full"
          >
            <OnboardingDiscovery
              firstName={firstName}
              discoveryStep={discoveryStep}
              focusHired={focusHired}
              focusStudent={focusStudent}
              onToggleHired={() => setFocusHired((v) => !v)}
              onToggleStudent={() => setFocusStudent((v) => !v)}
              jobSearchUrgency={jobSearchUrgency}
              onSelectUrgency={(v) => setJobSearchUrgency(v)}
              targetRolesText={targetRolesText}
              onTargetRolesChange={setTargetRolesText}
              referralSource={referralSource}
              onReferralSourceChange={(v) => {
                setReferralSource(v);
                if (v !== 'Other') setReferralOther('');
              }}
              referralOther={referralOther}
              onReferralOtherChange={setReferralOther}
              savePending={saveProgress.isPending}
              onBack={() => setDiscoveryStep((d) => Math.max(0, d - 1))}
              onNext={async (referralSkipped?: boolean) => {
                if (discoveryStep < 4) {
                  setDiscoveryStep((d) => d + 1);
                  return;
                }
                setCvPath(null);
                setCvEntryPhase('template');
                setStep(2);
                try {
                  const discovery = buildOnboardingDiscoveryApiFields({
                    focusHired,
                    focusStudent,
                    jobSearchUrgency,
                    targetRolesText,
                    referralSource,
                    referralOther,
                    referralSkipped: referralSkipped === true,
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
              cvPath === 'manual'
                ? 'flex min-h-0 max-w-[min(100%,1320px)] flex-1 flex-col overflow-hidden'
                : cvPath === 'paste' || cvPath === 'chat'
                  ? 'flex min-h-0 max-w-[680px] flex-1 flex-col overflow-hidden'
                  : 'max-w-[680px] space-y-6',
            )}
          >
            {cvPath === null && cvEntryPhase === 'template' ? (
              <>
                <div className="flex w-full flex-col items-center text-center">
                  <button
                    type="button"
                    disabled={saveProgress.isPending}
                    className="group mb-2 flex min-h-[44px] cursor-pointer items-center gap-1.5 self-start text-[13px] text-[rgba(255,255,255,0.45)] transition-colors duration-200 hover:text-[rgba(255,255,255,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={async () => {
                      setCvPath(null);
                      setCvEntryPhase('template');
                      setDiscoveryStep(4);
                      setStep(1);
                      try {
                        const discovery = buildOnboardingDiscoveryApiFields({
                          focusHired,
                          focusStudent,
                          jobSearchUrgency,
                          targetRolesText,
                          referralSource,
                          referralOther,
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
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
                    Back
                  </button>
                  <p
                    className="mt-3 text-center text-[11px] font-medium uppercase text-[#00C9B1]"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    Your resume
                  </p>
                  <h2 className="mt-3 max-w-[480px] text-[26px] font-bold leading-[1.2] text-white sm:text-[32px]">
                    Pick your starting template
                  </h2>
                  <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                    You can change this later — it only affects layout.
                  </p>
                </div>
                <div className="mt-8 w-full">
                  <TemplatePicker
                    layout="onboardingGrid"
                    selectedTemplate={selectedTemplate}
                    showHeader={false}
                    onSelect={(t) => {
                      if (isCvTemplateId(t)) setSelectedTemplate(t);
                    }}
                  />
                </div>
                <div className="mt-8 flex w-full justify-center">
                  <button
                    type="button"
                    onClick={() => setCvEntryPhase('paths')}
                    className="flex h-[52px] min-h-[52px] w-full min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#00C9B1] px-8 text-[15px] font-semibold text-white transition-all duration-200 hover:scale-[1.01] hover:brightness-[1.08] hover:shadow-[0_0_24px_rgba(0,201,177,0.25)] active:scale-[0.99] sm:w-auto"
                  >
                    Continue with {getOnboardingTemplateLabel(selectedTemplate)}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </>
            ) : null}

            {cvPath === null && cvEntryPhase === 'paths' ? (
              <>
                <div className="flex w-full flex-col items-center text-center">
                  <button
                    type="button"
                    className="group mb-8 flex min-h-[44px] cursor-pointer items-center gap-1.5 self-start text-[13px] text-[rgba(255,255,255,0.45)] transition-colors duration-200 hover:text-[rgba(255,255,255,0.8)]"
                    onClick={() => setCvEntryPhase('template')}
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
                    Back
                  </button>
                  <p
                    className="text-center text-[11px] font-medium uppercase text-[#00C9B1]"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    Your resume
                  </p>
                  <h2 className="mt-3 max-w-[480px] text-[26px] font-bold leading-[1.2] text-white sm:text-[32px]">
                    How would you like to add your career information?
                  </h2>
                  <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                    Pick what feels easiest — we&apos;ll score your resume so
                    you see value right away.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCvEntryPhase('template')}
                    className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(0,201,177,0.25)] bg-[rgba(0,201,177,0.15)] px-2.5 py-1 text-[11px] font-medium text-[#00C9B1] transition hover:bg-[rgba(0,201,177,0.22)]"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2} />
                    Template:{' '}
                    <span className="capitalize">{selectedTemplate}</span>
                  </button>
                </div>

                <div className="mt-8 flex w-full flex-col gap-3 sm:mt-8">
                  <CvEntryPathCard
                    icon={<UploadCloud className="h-6 w-6 text-[#00C9B1]" />}
                    label="Upload my resume"
                    description="PDF or Word — we parse it, you review, then we score it."
                    timeLabel="~1 min"
                    onClick={() => setCvPath('upload')}
                    active={cvPath === 'upload'}
                  />
                  <CvEntryPathCard
                    icon={<PenLine className="h-6 w-6 text-[#00C9B1]" />}
                    label="Do it manually"
                    description="Edit your resume in the preview — same editor as the clinic."
                    timeLabel="~3 min"
                    onClick={() => setCvPath('manual')}
                    active={cvPath === 'manual'}
                  />
                  <CvEntryPathCard
                    recommended
                    icon={<Sparkles className="h-6 w-6 text-[#00C9B1]" />}
                    label="Create with AI"
                    description="A quick, conversational flow — we draft your resume and score it when you're done."
                    timeLabel="~2 min"
                    onClick={() => setCvPath('chat')}
                    active={cvPath === 'chat'}
                  />
                </div>

                <button
                  type="button"
                  className="mx-auto mt-4 flex min-h-[44px] w-full cursor-pointer items-center justify-center text-center text-[13px] text-[rgba(255,255,255,0.35)] transition hover:text-[rgba(255,255,255,0.55)]"
                  onClick={() => setCvPath('paste')}
                >
                  Prefer to paste text instead?
                </button>

                <button
                  type="button"
                  className="mx-auto mt-6 flex min-h-[44px] w-full cursor-pointer items-center justify-center text-center text-[13px] text-[rgba(255,255,255,0.45)] transition hover:text-[rgba(255,255,255,0.75)]"
                  onClick={async () => {
                    setFinalScore(null);
                    setCompletionProfile(null);
                    await saveProgress.mutateAsync({ step: 2, hasCV: false });
                    setCompletionSource('skip');
                    setStep(3);
                  }}
                >
                  Skip for now →
                </button>
              </>
            ) : null}

            <AnimatePresence initial={false}>
              {cvPath === 'chat' ? (
                <motion.div
                  key="chat"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden"
                  data-lenis-prevent-wheel
                >
                  <div className="app-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pt-2">
                    <button
                      type="button"
                      className="mb-4 text-sm text-white/45 transition hover:text-white"
                      onClick={() => {
                        setCvPath(null);
                        setCvEntryPhase('paths');
                      }}
                    >
                      ← Back
                    </button>
                    {onboardingCvProfileQuery.isError ? (
                      <GlowCard contentClassName="p-6 text-center">
                        <p className="text-sm text-white/70">
                          We couldn&apos;t prepare your resume workspace. Check
                          your connection and try again.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() =>
                            void onboardingCvProfileQuery.refetch()
                          }
                        >
                          Retry
                        </Button>
                      </GlowCard>
                    ) : onboardingCvProfileQuery.isPending ? (
                      <GlowCard contentClassName="flex flex-col items-center justify-center gap-3 p-12 text-center">
                        <Loader2 className="h-9 w-9 animate-spin text-[#00C9B1]" />
                        <p className="text-sm text-white/55">
                          Preparing your resume workspace…
                        </p>
                      </GlowCard>
                    ) : (
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
                  <div className="app-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pt-2">
                    <button
                      type="button"
                      className="mb-4 text-sm text-white/45 transition hover:text-white"
                      onClick={() => {
                        setCvPath(null);
                        setCvEntryPhase('paths');
                        setPasteError(null);
                        setPasteImportSummary(null);
                        setPasteParsedProfile(null);
                        setPasteParsedProfileId(null);
                      }}
                    >
                      ← Back
                    </button>
                    {pasteImportSummary && pasteParsedProfile && !pasteSubmitting ? (
                      <CvParseImportSummaryPanel
                        importSummary={pasteImportSummary}
                        profileId={pasteParsedProfileId}
                        onReviewInBuilder={() => {
                          const id = pasteParsedProfileId?.trim();
                          if (id) router.push(cvEditorPath(id));
                        }}
                        onContinue={() => {
                          const id = pasteParsedProfileId?.trim();
                          const profile = pasteParsedProfile;
                          setPasteImportSummary(null);
                          if (id && profile) {
                            void runProcessingThenFinish({
                              source: 'paste',
                              profileId: id,
                              profile,
                            });
                          }
                        }}
                        continueLabel="Continue to scoring"
                      />
                    ) : !pasteSubmitting ? (
                      <GlowCard
                        className="border border-[rgba(0,201,177,0.15)]"
                        contentClassName="flex min-h-0 flex-col overflow-hidden p-5"
                      >
                        <p className="text-xs text-white/55">
                          Paste your full resume, LinkedIn export, or notes — up to{' '}
                          {CV_CHAT_INPUT_MAX_CHARS.toLocaleString()} characters
                        </p>
                        <textarea
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          placeholder="Paste your resume text, LinkedIn About section, job history notes — anything works. The more you share, the better your resume will be."
                          rows={12}
                          data-lenis-prevent-wheel
                          className="app-scrollbar mt-3 min-h-[220px] max-h-[min(55vh,520px)] flex-1 w-full resize-y overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.10)] bg-[#111616] px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#00C9B1]/40"
                        />
                        <p
                          className={cn(
                            'mt-2 text-right text-[11px]',
                            isCvChatInputOverLimit(pasteText.length)
                              ? 'text-rose-400/90'
                              : 'text-white/45',
                          )}
                        >
                          {formatCvChatCharCount(pasteText.length)}
                        </p>
                        {pasteError ? (
                          <p className="mt-2 text-sm text-[#EF4444]">
                            {pasteError}
                          </p>
                        ) : null}
                        <Button
                          fullWidth
                          className="mt-4 inline-flex items-center justify-center gap-2"
                          disabled={
                            pasteText.trim().length < 50 ||
                            saveProgress.isPending
                          }
                          onClick={() => void submitPaste()}
                        >
                          <Sparkles className="h-4 w-4 shrink-0" />
                          Structure and build my resume
                          <ArrowRight
                            className="h-4 w-4 shrink-0"
                            strokeWidth={2.5}
                          />
                        </Button>
                        <button
                          type="button"
                          className="mx-auto mt-4 block w-full text-center text-[13px] text-white/45 hover:text-white/75"
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
                          Skip for now →
                        </button>
                      </GlowCard>
                    ) : (
                      <GlowCard
                        className="border border-[rgba(0,201,177,0.15)]"
                        contentClassName="p-10 text-center"
                      >
                        <p className="flex items-center justify-center gap-2 text-lg font-semibold text-white">
                          <Sparkles className="h-5 w-5 text-[#00C9B1]" />
                          Reading and structuring your resume…
                        </p>
                        <div className="mx-auto mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
                          <motion.div
                            className="h-full bg-[#00C9B1]"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                            style={{ width: '40%' }}
                          />
                        </div>
                        <p className="mt-6 text-sm text-white/55">
                          {PASTE_STATUS_MESSAGES[pasteStatusIdx]}
                        </p>
                      </GlowCard>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {cvPath === 'manual' ? (
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
                      <GlowCard contentClassName="p-6 text-center">
                        <p className="text-sm text-white/70">
                          We couldn&apos;t prepare your resume workspace. Check
                          your connection and try again.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() =>
                            void onboardingCvProfileQuery.refetch()
                          }
                        >
                          Retry
                        </Button>
                      </GlowCard>
                    ) : onboardingCvProfileQuery.isPending ? (
                      <GlowCard contentClassName="flex flex-col items-center justify-center gap-4 p-16 text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-[#00C9B1]" />
                        <p className="text-sm text-white/55">
                          Preparing your resume workspace…
                        </p>
                      </GlowCard>
                    ) : cvSectionsQuery.isPending ? (
                      <GlowCard contentClassName="flex flex-col items-center justify-center gap-4 p-16 text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-[#00C9B1]" />
                        <p className="text-sm text-white/55">
                          Loading your resume…
                        </p>
                      </GlowCard>
                    ) : cvSectionsQuery.isError ? (
                      <GlowCard contentClassName="p-6 text-center">
                        <p className="text-sm text-white/70">
                          We couldn&apos;t load the editor. Check your
                          connection and try again.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() => {
                            void onboardingCvProfileQuery.refetch();
                            void cvSectionsQuery.refetch();
                          }}
                        >
                          Retry
                        </Button>
                      </GlowCard>
                    ) : onboardingCvProfileQuery.data ? (
                      <OnboardingResumeClinic
                        profileId={onboardingCvProfileQuery.data}
                        sections={manualBuilderSections}
                        selectedTemplate={selectedTemplate}
                        onTemplateIdChange={setSelectedTemplate}
                        onBack={() => {
                          setCvPath(null);
                          setCvEntryPhase('paths');
                        }}
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
                  <div className="pt-2">
                    {uploadPhase === 'zone' ? (
                      <>
                        <button
                          type="button"
                          className="mb-4 text-sm text-white/45 transition hover:text-white"
                          onClick={resetCvStep}
                        >
                          ← Back
                        </button>
                        <h3 className="mb-2 text-xl font-bold text-white">
                          Upload your resume
                        </h3>
                        <p className="mb-4 text-sm text-white/45">
                          PDF or Word — we&apos;ll extract the structure
                          automatically.
                        </p>
                        <CVUploadZone
                          onSuccess={(data) => {
                            void onUploadParsed(data);
                          }}
                        />
                      </>
                    ) : null}
                    {uploadPhase === 'summary' && uploadImportSummary ? (
                      <div className="space-y-4">
                        <button
                          type="button"
                          className="text-sm text-white/45 transition hover:text-white"
                          onClick={() => {
                            setUploadPhase('zone');
                            setUploadImportSummary(null);
                            setUploadParsedProfile(null);
                            setUploadedScore(null);
                          }}
                        >
                          ← Upload another file
                        </button>
                        <CvParseImportSummaryPanel
                          importSummary={uploadImportSummary}
                          profileId={uploadParsedProfile?.id}
                          onReviewInBuilder={() => {
                            const id = uploadParsedProfile?.id?.trim();
                            if (id) router.push(cvEditorPath(id));
                          }}
                          onContinue={() => setUploadPhase('score')}
                          continueLabel="See your score"
                        />
                      </div>
                    ) : null}
                    {uploadPhase === 'score' && uploadedScore ? (
                      <div className="space-y-4">
                        <button
                          type="button"
                          className="text-sm text-white/45 transition hover:text-white"
                          onClick={() => {
                            setUploadPhase('zone');
                            setUploadedScore(null);
                            setUploadParsedProfile(null);
                            setUploadImportSummary(null);
                          }}
                        >
                          ← Upload another file
                        </button>
                        <GlowCard contentClassName="p-7">
                          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="h-8 w-8 shrink-0 text-[#22C55E]" />
                              <div>
                                <p className="text-base font-bold text-white">
                                  Resume parsed successfully
                                </p>
                                <p className="mt-1 text-sm text-white/45">
                                  {sectionCount} sections detected
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-6">
                            {uploadedScore.score !== null &&
                            uploadedScore.score !== undefined ? (
                              <CVScoreCard
                                mode="compact"
                                hideJobMatch
                                score={uploadedScore.score}
                                breakdown={uploadedScore.breakdown}
                                scorePayload={uploadedScore}
                                improvementsCount={
                                  uploadedScore.improvements?.length
                                }
                              />
                            ) : (
                              <p className="text-sm text-white/45">
                                Calculating your score…
                              </p>
                            )}
                          </div>
                          {uploadParsedProfile?.originalTemplate ? (
                            <div className="mt-4 border-t border-white/[0.08] pt-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 shrink-0 rounded-full bg-[#00C9B1]" />
                                <p className="text-xs text-white/55">
                                  We matched your resume format to our{' '}
                                  <span className="capitalize text-white">
                                    {uploadParsedProfile.originalTemplate}
                                  </span>{' '}
                                  template
                                  {uploadParsedProfile.detectedLayout &&
                                  uploadParsedProfile.detectedLayout !==
                                    'unknown' ? (
                                    <span className="text-white/30">
                                      {' '}
                                      (
                                      {formatOnboardingLayoutLabel(
                                        uploadParsedProfile.detectedLayout,
                                      )}{' '}
                                      detected)
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                              <p className="ml-4 mt-1 text-xs text-white/30">
                                You can switch templates or restore this format
                                anytime in your resume editor.
                              </p>
                            </div>
                          ) : null}
                          <div className="mt-6 flex flex-wrap gap-3 border-t border-white/[0.08] pt-4">
                            <Button
                              variant="ghost"
                              className="text-sm"
                              onClick={async () => {
                                await saveProgress.mutateAsync({
                                  step: 2,
                                  hasCV: true,
                                });
                                setCompletionSource('upload');
                                setFinalScore(uploadedScore);
                                setCompletionProfile(uploadParsedProfile);
                                setStep(3);
                                router.push('/dashboard/cv');
                              }}
                            >
                              Edit my resume →
                            </Button>
                            <Button
                              className="text-sm"
                              onClick={async () => {
                                await saveProgress.mutateAsync({
                                  step: 2,
                                  hasCV: true,
                                });
                                setCompletionSource('upload');
                                setFinalScore(uploadedScore);
                                setCompletionProfile(uploadParsedProfile);
                                setStep(3);
                              }}
                            >
                              Continue →
                            </Button>
                          </div>
                        </GlowCard>
                      </div>
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
          >
            <Loader2 className="h-12 w-12 animate-spin text-[#00C9B1]" />
            <p className="mt-8 text-2xl font-bold text-white">
              {manualSubmitting
                ? 'Saving and scoring your resume…'
                : 'Building your resume…'}
            </p>
            <ul className="mt-10 w-full space-y-3 text-left text-sm">
              {PROCESSING_STEPS.map((label, i) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-white/70"
                >
                  {i < processingStepIdx ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-[#22C55E]"
                      strokeWidth={3}
                    />
                  ) : i === processingStepIdx ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#00C9B1]" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border border-white/25" />
                  )}
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}

        {step === 3 && !processing && !manualSubmitting ? (
          <CompletionPanel
            primaryGoal={primaryGoal}
            finalScore={finalScore}
            completionProfile={completionProfile}
            completionSource={completionSource}
            selectedTemplate={completionProfile?.template ?? selectedTemplate}
            accessToken={accessToken}
          />
        ) : null}
      </AnimatePresence>
    </OnboardingShell>
  );
}

function CvEntryPathCard({
  recommended,
  icon,
  label,
  description,
  timeLabel,
  onClick,
  active,
}: {
  recommended?: boolean;
  icon: ReactNode;
  label: string;
  description: string;
  timeLabel: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <GlowCard
      className={cn(
        'cursor-pointer border transition-colors duration-150',
        recommended
          ? 'border-[rgba(0,201,177,0.45)] shadow-[0_0_0_1.5px_rgba(0,201,177,0.4),0_4px_20px_rgba(0,201,177,0.1)]'
          : active
            ? 'border-[rgba(0,201,177,0.45)] bg-[rgba(0,201,177,0.06)]'
            : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.04)]',
      )}
      contentClassName="relative p-5 sm:p-5"
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-h-[44px] flex-col gap-3 text-left sm:flex-row sm:items-start sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.15)]">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            {recommended ? (
              <p className="mb-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#F59E0B]">
                <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                Recommended
              </p>
            ) : null}
            <p className="text-base font-bold text-white">{label}</p>
            <p className="mt-1 text-[13px] leading-snug text-[rgba(255,255,255,0.55)]">
              {description}
            </p>
          </div>
        </div>
        <span className="shrink-0 self-start rounded-full bg-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[11px] font-medium text-white sm:ml-auto sm:self-center">
          {timeLabel}
        </span>
      </button>
    </GlowCard>
  );
}

function CompletionPanel({
  primaryGoal,
  finalScore,
  completionProfile,
  completionSource,
  selectedTemplate,
  accessToken,
}: {
  primaryGoal: string;
  finalScore: CVScorePayload | null;
  completionProfile: CVProfile | null;
  completionSource: 'skip' | 'upload' | 'chat' | 'paste' | 'manual';
  selectedTemplate: string;
  accessToken: string | null;
}) {
  const router = useRouter();
  const sub =
    primaryGoal === 'jobs'
      ? "Let's find you a job that fits."
      : primaryGoal === 'cv'
        ? "Let's make your resume impossible to ignore."
        : primaryGoal === 'interviews'
          ? "Let's get you interview-ready."
          : primaryGoal === 'student'
            ? "Let's build your career from the ground up."
            : 'Your dashboard is ready.';

  const cta = { label: 'Go to dashboard →', href: '/dashboard' };

  const structured = completionProfile?.structured;
  const expN = Array.isArray(structured?.experience)
    ? structured!.experience!.length
    : 0;
  const skillN =
    (Array.isArray(structured?.skills) ? structured!.skills!.length : 0) +
    (Array.isArray(structured?.primarySkills)
      ? structured!.primarySkills!.length
      : 0);

  return (
    <motion.div
      key="s3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto flex max-w-lg flex-col items-center text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[rgba(0,201,177,0.4)] bg-[rgba(0,201,177,0.12)]"
      >
        <CheckCircle2 className="h-10 w-10 text-[#00C9B1]" />
      </motion.div>

      <h2 className="text-[32px] font-extrabold text-white">
        You&apos;re all set.
      </h2>
      {completionSource === 'skip' ? (
        <p className="mt-3 max-w-md text-sm text-white/45">{sub}</p>
      ) : null}

      {completionSource !== 'skip' && finalScore ? (
        <>
          <div className="mt-6 w-full">
            {finalScore.score !== null && finalScore.score !== undefined ? (
              <CVScoreCard
                mode="compact"
                hideJobMatch
                score={finalScore.score}
                breakdown={finalScore.breakdown}
                scorePayload={finalScore}
                improvementsCount={finalScore.improvements?.length}
              />
            ) : (
              <p className="text-sm text-white/45">Calculating your score…</p>
            )}
          </div>
          {completionProfile?.originalTemplate ? (
            <div className="mt-4 w-full border-t border-white/[0.08] pt-4 text-left">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 shrink-0 rounded-full bg-[#00C9B1]" />
                <p className="text-xs text-white/55">
                  We matched your resume format to our{' '}
                  <span className="capitalize text-white">
                    {completionProfile.originalTemplate}
                  </span>{' '}
                  template
                  {completionProfile.detectedLayout &&
                  completionProfile.detectedLayout !== 'unknown' ? (
                    <span className="text-white/30">
                      {' '}
                      (
                      {formatOnboardingLayoutLabel(
                        completionProfile.detectedLayout,
                      )}{' '}
                      detected)
                    </span>
                  ) : null}
                </p>
              </div>
              <p className="ml-4 mt-1 text-xs text-white/30">
                You can switch templates or restore this format anytime in your
                resume editor.
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.08)] px-3 py-1.5 text-xs text-[#00C9B1]">
              ✓ {selectedTemplate} template
            </span>
            {skillN > 0 ? (
              <span className="rounded-full border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.08)] px-3 py-1.5 text-xs text-[#00C9B1]">
                ✓ {skillN} skills detected
              </span>
            ) : null}
            {expN > 0 ? (
              <span className="rounded-full border border-[#22C55E]/35 bg-[#22C55E]/10 px-3 py-1.5 text-xs text-[#86EFAC]">
                ✓ {expN} experience {expN === 1 ? 'entry' : 'entries'}
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="mt-9 w-full max-w-sm space-y-3">
        <Button
          fullWidth
          disabled={!accessToken}
          onClick={() => router.push(cta.href)}
        >
          {cta.label}
        </Button>
        {completionSource !== 'skip' && finalScore ? (
          <Link
            href="/dashboard/cv"
            className="block text-center text-[13px] text-white/45 hover:text-white/75"
          >
            Open resume editor →
          </Link>
        ) : null}
      </div>
    </motion.div>
  );
}
