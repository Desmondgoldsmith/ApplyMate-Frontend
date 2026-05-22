'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  FileText,
  Loader2,
  Mail,
  Pencil,
  StickyNote,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { JobAnalysisCard } from '@/components/dashboard/JobAnalysisCard';
import { ScoreImprovementGuideCard } from '@/components/job-analysis/ScoreImprovementGuideCard';
import { AiRecruiterReportSection } from '@/components/job-analysis/AiRecruiterReportSection';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { useJobApplyUrl } from '@/hooks/useJobApplyUrl';
import { useGenerateContent } from '@/hooks/useGenerateContent';
import { canUseAiFromDailyAiUsage, DAILY_AI_LIMIT_REACHED_MESSAGE } from '@/lib/ai-daily-usage';
import {
  api,
  type FollowUpEmailDraft,
  type HubNoteEntry,
  type HubReminderStatus,
  type JobAnalysis,
  type SyncLocalReminderPayload,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { openExternalJobApplyUrl } from '@/lib/jobApplyUrl';
import { shouldShowScoreImprovementGuide } from '@/lib/scoreImprovement';
import { invalidateGrowthQueries } from '@/hooks/useGrowth';
import {
  invalidateNotificationList,
  scheduleUnreadNotificationCountInvalidate,
} from '@/hooks/useNotifications';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { downloadCoverLetterPdf } from '@/lib/cover-letter-pdf';
import { normalizeText } from '@/lib/normalizeText';
import { cn } from '@/lib/utils';

import {
  JOB_HUB_EMAIL_TEMPLATE_OPTIONS,
  type JobHubEmailTemplateType,
} from './jobHubEmailTemplates';
import {
  addLocalReminder,
  listLocalRemindersForJob,
  localReminderStatus,
  notifyDueLocalReminders,
  removeLocalReminder,
} from '@/lib/jobHubLocalReminders';
import {
  appendNoteEntryIfChanged,
  listNoteEntries,
  removeNoteEntry,
  seedNoteEntriesIfEmpty,
} from '@/lib/jobHubNotesEntries';
import { prefillJobAnalyzerInStorage } from '@/lib/jobHubPrefill';
import {
  HUB_STAGE_LABELS,
  HUB_STAGES,
  canRemoveTrackedJobFromHub,
  type HubStage,
  type TrackedJob,
} from './jobHubMerge';
import { JobHubRowMenu } from './JobHubRowMenu';

/** Brand teal (matches design tokens / primary buttons). */
const TEAL = {
  text: 'text-[#00C9B1]',
  textBright: 'text-[#00C9B1]',
  border: 'border-[#00C9B1]/45',
  borderSoft: 'border-[#00C9B1]/35',
  bgSoft: 'bg-[#00C9B1]/15',
  bgMuted: 'bg-[#00C9B1]/10',
  bgHover: 'hover:bg-[#00C9B1]/20',
  ring: 'ring-[#00C9B1]/40',
  focus: 'focus:border-[#00C9B1]/50',
  activeTab: 'border-[#00C9B1]',
  pillActive: 'border-[#00C9B1]/45 bg-[#00C9B1]/15 text-[#00C9B1]',
} as const;

function notesLocalStorageKey(jobKey: string) {
  return `applymate:job-hub:notes-local:${jobKey}`;
}

function loadLocalNotes(jobKey: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(notesLocalStorageKey(jobKey)) ?? '';
  } catch {
    return '';
  }
}

function saveLocalNotes(jobKey: string, text: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(notesLocalStorageKey(jobKey), text);
  } catch {
    /* ignore */
  }
}

function noteSnippet(body: string, max = 72) {
  const line = body.trim().split(/\r?\n/)[0] ?? '';
  const t = line.length > max ? `${line.slice(0, max)}…` : line;
  return t || '—';
}

function formatRelativeSaved(iso: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'Saved today';
  if (days === 1) return 'Saved a day ago';
  return `Saved ${days} days ago`;
}

type TabId = 'analysis' | 'description' | 'cover' | 'notes' | 'email' | 'resume';

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'analysis', label: 'Match & gaps', icon: FileText },
  { id: 'description', label: 'Description', icon: FileText },
  { id: 'cover', label: 'Cover letter', icon: Mail },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'email', label: 'Email templates', icon: Mail },
  { id: 'resume', label: 'Resumes', icon: FileText },
];

type Props = {
  job: TrackedJob;
  onClose: () => void;
  onStageChange: (job: TrackedJob, stage: HubStage) => void;
  dueUiTick?: number;
  onRequestHubArchive?: (job: TrackedJob) => void;
  onRequestHubPipelineRemove?: (job: TrackedJob) => void;
  onRequestHubUnbookmark?: (job: TrackedJob) => void;
  hubManagePending?: boolean;
  className?: string;
  /** Outer chrome (teal frame) lives on the sliding shell; panel is flush inside. */
  layoutVariant?: 'stacked' | 'sheet';
  initialTab?: TabId;
  /** From Job Hub URL `?template=` (backend deep links). */
  initialEmailTemplate?: JobHubEmailTemplateType;
  onShareWin?: () => void;
  onVerifyPlacement?: () => void;
  verificationStatus?: 'none' | 'pending' | 'verified';
};

function formatReminderWhen(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function reminderStatusLabel(s: ReturnType<typeof localReminderStatus>) {
  if (s === 'upcoming') return 'Upcoming';
  if (s === 'due') return 'Due';
  return 'Elapsed';
}

function formatAssistLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function JobHubDetailPanel({
  job,
  onClose,
  onStageChange,
  dueUiTick = 0,
  onRequestHubArchive,
  onRequestHubPipelineRemove,
  onRequestHubUnbookmark,
  hubManagePending = false,
  className,
  layoutVariant = 'stacked',
  initialTab = 'analysis',
  initialEmailTemplate,
  onShareWin,
  onVerifyPlacement,
  verificationStatus = 'none',
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesBaselineRef = useRef('');
  const notesHydratedScopeRef = useRef('');

  const [reminderAt, setReminderAt] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderSyncCloud, setReminderSyncCloud] = useState(false);
  const [localRemindersVersion, setLocalRemindersVersion] = useState(0);
  const [analyzeNavigateBusy, setAnalyzeNavigateBusy] = useState(false);
  const [browserAlertsOn, setBrowserAlertsOn] = useState(false);
  const [notesListTick, setNotesListTick] = useState(0);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});
  const [noteRowEditId, setNoteRowEditId] = useState<string | null>(null);
  const [noteRowEditText, setNoteRowEditText] = useState('');

  const [emailTemplate, setEmailTemplate] = useState<JobHubEmailTemplateType>(
    initialEmailTemplate ?? JOB_HUB_EMAIL_TEMPLATE_OPTIONS[0]!.value,
  );
  const [emailExtra, setEmailExtra] = useState('');
  const [emailDraft, setEmailDraft] = useState<FollowUpEmailDraft | null>(null);

  const jobDetail = useQuery({
    queryKey: ['job', job.jobAnalysisId],
    queryFn: () => api.jobs.getJob(job.jobAnalysisId!),
    enabled: Boolean(job.jobAnalysisId),
  });

  const generated = useQuery({
    queryKey: ['job-generated', job.jobAnalysisId],
    queryFn: () => api.jobs.getGenerated(job.jobAnalysisId!),
    enabled: Boolean(job.jobAnalysisId) && tab === 'cover',
  });

  const bookmarkListingId = (job.boardDiscoveryId ?? '').trim();
  const bookmarkDiscoveryDetail = useQuery({
    queryKey: ['job-discovery-detail', bookmarkListingId],
    queryFn: () => api.jobDiscovery.getDetail(bookmarkListingId),
    enabled: Boolean(bookmarkListingId) && !job.jobAnalysisId && tab === 'description',
  });

  const noteQueryKey = useMemo((): readonly ['hub-note-entries', 'application' | 'bookmark' | 'job' | 'local', string] => {
    if (job.applicationId) return ['hub-note-entries', 'application', job.applicationId];
    if (job.jobAnalysisId) return ['hub-note-entries', 'job', job.jobAnalysisId];
    if (job.hubBookmarkId) return ['hub-note-entries', 'bookmark', job.hubBookmarkId];
    return ['hub-note-entries', 'local', job.key];
  }, [job.applicationId, job.jobAnalysisId, job.hubBookmarkId, job.key]);

  const isLocalNotes = noteQueryKey[1] === 'local';
  const notesScope = `${noteQueryKey[1]}:${noteQueryKey[2]}`;

  const serverNotesQ = useQuery({
    queryKey: noteQueryKey,
    queryFn: () => {
      if (job.applicationId) return api.applications.listNotes(job.applicationId);
      if (job.jobAnalysisId) return api.jobs.listNotes(job.jobAnalysisId);
      if (job.hubBookmarkId) return api.jobDiscovery.listBookmarkNotes(job.hubBookmarkId);
      return Promise.resolve([]);
    },
    enabled: !isLocalNotes,
  });

  useEffect(() => {
    setTab(initialTab);
  }, [job.key, initialTab]);

  useEffect(() => {
    if (initialEmailTemplate) setEmailTemplate(initialEmailTemplate);
  }, [job.key, initialEmailTemplate]);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined') {
      setBrowserAlertsOn(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    setNotesStatus('idle');
    setExpandedNoteIds({});
    setNoteRowEditId(null);
    setNoteRowEditText('');
    notesHydratedScopeRef.current = '';
    if (isLocalNotes) {
      const next = loadLocalNotes(job.key);
      setNotesDraft(next);
      notesBaselineRef.current = next;
      seedNoteEntriesIfEmpty(job.key, next);
      setNotesListTick((n) => n + 1);
      return;
    }
    const legacy = job.applicationNotes ?? '';
    setNotesDraft(legacy);
    notesBaselineRef.current = legacy;
  }, [job.key, isLocalNotes, job.applicationNotes]);

  useEffect(() => {
    if (isLocalNotes || !serverNotesQ.isSuccess) return;
    if (notesHydratedScopeRef.current === notesScope) return;
    const rows = serverNotesQ.data ?? [];
    if (rows.length > 0) {
      const latest = rows[0]!.body;
      setNotesDraft(latest);
      notesBaselineRef.current = latest;
    }
    notesHydratedScopeRef.current = notesScope;
  }, [isLocalNotes, notesScope, serverNotesQ.isSuccess, serverNotesQ.data]);

  const savedNoteRows = useMemo((): HubNoteEntry[] => {
    if (isLocalNotes) {
      return listNoteEntries(job.key).map((e) => ({
        id: e.id,
        body: e.body,
        snippet: noteSnippet(e.body),
        createdAt: e.savedAt,
        updatedAt: null,
      }));
    }
    return serverNotesQ.data ?? [];
  }, [isLocalNotes, job.key, serverNotesQ.data, notesListTick]);

  const bumpLocalReminders = useCallback(() => {
    setLocalRemindersVersion((v) => v + 1);
  }, []);

  /** Exactly one of analysis id or bookmark id — matches POST /jobs/hub-reminders (prefer analysis when both exist). */
  const canUseHubReminders = Boolean(job.jobAnalysisId || job.hubBookmarkId);

  const hubRemindersQuery = useQuery({
    queryKey: ['hub-reminders', job.jobAnalysisId ?? '', job.hubBookmarkId ?? ''],
    queryFn: () =>
      api.jobs.listHubReminders(
        job.jobAnalysisId
          ? { jobAnalysisId: job.jobAnalysisId }
          : { jobBookmarkId: job.hubBookmarkId! },
      ),
    enabled: canUseHubReminders,
  });

  const createHubReminderMut = useMutation({
    mutationFn: () => {
      const iso = new Date(reminderAt).toISOString();
      const t = reminderMessage.trim();
      if (job.jobAnalysisId) {
        return api.jobs.createHubReminder({
          jobAnalysisId: job.jobAnalysisId,
          remindAt: iso,
          ...(t ? { title: t } : {}),
        });
      }
      if (job.hubBookmarkId) {
        return api.jobs.createHubReminder({
          jobBookmarkId: job.hubBookmarkId,
          remindAt: iso,
          ...(t ? { title: t } : {}),
        });
      }
      return Promise.reject(new Error('No job or bookmark scope for hub reminder'));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hub-reminders'] });
      if (job.jobAnalysisId) void queryClient.invalidateQueries({ queryKey: ['job', job.jobAnalysisId] });
      void queryClient.invalidateQueries({ queryKey: ['job-history'] });
      void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
      invalidateTodayPlanQueries(queryClient);
      invalidateGrowthQueries(queryClient);
      setReminderAt('');
      setReminderMessage('');
      setReminderSyncCloud(false);
      toast.success('Follow-up saved');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteHubReminderMut = useMutation({
    mutationFn: (id: string) => api.jobs.deleteHubReminder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hub-reminders'] });
      if (job.jobAnalysisId) void queryClient.invalidateQueries({ queryKey: ['job', job.jobAnalysisId] });
      void queryClient.invalidateQueries({ queryKey: ['job-history'] });
      void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
      invalidateTodayPlanQueries(queryClient);
      invalidateGrowthQueries(queryClient);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const patchHubReminderMut = useMutation({
    mutationFn: (args: { id: string; status: HubReminderStatus }) =>
      api.jobs.patchHubReminder(args.id, { status: args.status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hub-reminders'] });
      if (job.jobAnalysisId) void queryClient.invalidateQueries({ queryKey: ['job', job.jobAnalysisId] });
      invalidateTodayPlanQueries(queryClient);
      invalidateGrowthQueries(queryClient);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const displayReminders = useMemo(() => {
    return listLocalRemindersForJob(job.key).filter((r) => r.source !== 'server');
  }, [job.key, localRemindersVersion, dueUiTick]);

  const hubRemindersDisplay = useMemo(() => {
    const rows = hubRemindersQuery.data ?? [];
    return rows.filter((r) => r.status === 'pending');
  }, [hubRemindersQuery.data]);

  const postHubNote = useMutation({
    mutationFn: (body: string) => {
      if (job.applicationId) return api.applications.createNote(job.applicationId, body);
      if (job.jobAnalysisId) return api.jobs.createNote(job.jobAnalysisId, body);
      if (job.hubBookmarkId) return api.jobDiscovery.createBookmarkNote(job.hubBookmarkId, body);
      return Promise.reject(new Error('No note scope'));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...noteQueryKey] });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
      invalidateTodayPlanQueries(queryClient);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const patchHubNote = useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) => {
      if (job.applicationId) return api.applications.updateNote(job.applicationId, noteId, body);
      if (job.jobAnalysisId) return api.jobs.updateNote(job.jobAnalysisId, noteId, body);
      if (job.hubBookmarkId) return api.jobDiscovery.updateBookmarkNote(job.hubBookmarkId, noteId, body);
      return Promise.reject(new Error('No note scope'));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...noteQueryKey] });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
      invalidateTodayPlanQueries(queryClient);
      setNoteRowEditId(null);
      setNoteRowEditText('');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteHubNote = useMutation({
    mutationFn: (noteId: string) => {
      if (job.applicationId) return api.applications.deleteNote(job.applicationId, noteId);
      if (job.jobAnalysisId) return api.jobs.deleteNote(job.jobAnalysisId, noteId);
      if (job.hubBookmarkId) return api.jobDiscovery.deleteBookmarkNote(job.hubBookmarkId, noteId);
      return Promise.reject(new Error('No note scope'));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...noteQueryKey] });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
      invalidateTodayPlanQueries(queryClient);
      setNoteRowEditId(null);
      setNoteRowEditText('');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const notesMutationBusy =
    postHubNote.isPending || patchHubNote.isPending || deleteHubNote.isPending;

  const flushNotesSave = useCallback(() => {
    if (notesBaselineRef.current === notesDraft) return;
    const trimmed = notesDraft.trim();
    if (!trimmed) return;
    setNotesStatus('saving');
    if (isLocalNotes) {
      try {
        saveLocalNotes(job.key, notesDraft);
        notesBaselineRef.current = notesDraft;
        appendNoteEntryIfChanged(job.key, notesDraft);
        setNotesListTick((n) => n + 1);
        setNotesStatus('saved');
        window.setTimeout(() => setNotesStatus('idle'), 2000);
      } catch {
        setNotesStatus('error');
        toast.error('Could not save notes in this browser.');
      }
      return;
    }
    postHubNote.mutate(trimmed, {
      onSuccess: () => {
        notesBaselineRef.current = notesDraft;
        setNotesStatus('saved');
        window.setTimeout(() => setNotesStatus('idle'), 2000);
      },
      onError: () => setNotesStatus('error'),
    });
  }, [isLocalNotes, job.key, notesDraft, noteQueryKey, postHubNote, toast]);

  useEffect(() => {
    if (!isLocalNotes) return;
    if (notesBaselineRef.current === notesDraft) return;
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(() => {
      flushNotesSave();
    }, 1200);
    return () => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    };
  }, [notesDraft, flushNotesSave, isLocalNotes]);

  const genEmail = useMutation({
    mutationFn: async () => {
      if (job.applicationId) {
        return api.applications.generateEmailTemplate(job.applicationId, {
          templateType: emailTemplate,
          jobAnalysisId: job.jobAnalysisId,
          extraContext: emailExtra.trim() || undefined,
        });
      }
      if (job.jobAnalysisId) {
        return api.jobs.generateEmailTemplate(job.jobAnalysisId, {
          templateType: emailTemplate,
          extraContext: emailExtra.trim() || undefined,
        });
      }
      throw new Error('Missing job context');
    },
    onSuccess: (draft) => {
      setEmailDraft(draft);
      toast.success('Draft generated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const generateCover = useGenerateContent();
  const aiUsage = useDailyAiUsage();

  /** Local-only path: require future time + message. */
  const reminderValid = useMemo(() => {
    if (!reminderAt.trim()) return false;
    const t = new Date(reminderAt).getTime();
    return Number.isFinite(t) && t > Date.now();
  }, [reminderAt]);

  /** Hub CRM path: any parseable date/time (server validates). */
  const hubReminderTimeOk = useMemo(() => {
    if (!reminderAt.trim()) return false;
    const t = new Date(reminderAt).getTime();
    return Number.isFinite(t);
  }, [reminderAt]);

  const canSyncCloudReminder = Boolean(job.applicationId || job.jobAnalysisId);

  const syncCloudReminder = useMutation({
    mutationFn: (payload: SyncLocalReminderPayload) => api.users.syncLocalReminder(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['job-history'] });
      invalidateNotificationList(queryClient);
      scheduleUnreadNotificationCountInvalidate(queryClient);
      invalidateTodayPlanQueries(queryClient);
      toast.success('Reminder synced for email and in-app delivery');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const scheduleLocalReminder = useCallback(() => {
    if (!reminderValid || !reminderMessage.trim()) return;
    const iso = new Date(reminderAt).toISOString();
    const msg = reminderMessage.trim();
    addLocalReminder(job.key, iso, msg);
    bumpLocalReminders();
    setReminderAt('');
    setReminderMessage('');
    notifyDueLocalReminders();
    toast.success('Reminder saved on this device');

    if (reminderSyncCloud && canSyncCloudReminder) {
      syncCloudReminder.mutate({
        remindAt: iso,
        message: msg,
        applicationId: job.applicationId ?? undefined,
        jobAnalysisId: job.jobAnalysisId ?? undefined,
        jobKey: job.key,
        title: job.title,
        company: job.company,
      });
    }
    setReminderSyncCloud(false);
  }, [
    job.applicationId,
    job.company,
    job.jobAnalysisId,
    job.key,
    job.title,
    bumpLocalReminders,
    canSyncCloudReminder,
    reminderAt,
    reminderMessage,
    reminderSyncCloud,
    reminderValid,
    syncCloudReminder,
    toast,
  ]);

  const scheduleHubReminder = useCallback(() => {
    if (!hubReminderTimeOk) return;
    createHubReminderMut.mutate();
  }, [createHubReminderMut, hubReminderTimeOk]);

  const scheduleReminder = useCallback(() => {
    if (canUseHubReminders) {
      scheduleHubReminder();
      return;
    }
    scheduleLocalReminder();
  }, [canUseHubReminders, scheduleHubReminder, scheduleLocalReminder]);

  const detail = jobDetail.data;
  const analysisForCard: JobAnalysis | null =
    detail && detail.analysis
      ? {
          ...detail.analysis,
          id: detail.analysis.id ?? job.jobAnalysisId ?? undefined,
          title: detail.analysis.title ?? detail.title,
          company: detail.analysis.company ?? detail.company,
          matchScore:
            typeof detail.analysis.matchScore === 'number' && Number.isFinite(detail.analysis.matchScore)
              ? detail.analysis.matchScore
              : 0,
        }
      : null;

  const tailoredCvProfileIdForLink = analysisForCard?.tailoredCvProfileId?.trim() ?? '';
  const showTailoredCvInBuilderLink =
    Boolean(job.jobAnalysisId) &&
    Boolean(analysisForCard?.isTailored) &&
    Boolean(tailoredCvProfileIdForLink);
  const { applyUrl: resolvedApplyUrl } = useJobApplyUrl({
    applyUrl: analysisForCard?.applyUrl ?? job.applyUrl,
    jobListingId: analysisForCard?.jobListingId ?? job.boardDiscoveryId,
    enabled: Boolean(job.jobAnalysisId || job.boardDiscoveryId),
  });

  const bestCvProfileIdForClinic = useMemo(() => {
    const a = analysisForCard as
      | (JobAnalysis & {
          cvProfileId?: string | null;
          sourceCvProfileId?: string | null;
          tailoredCvProfileId?: string | null;
        })
      | null;
    return (
      a?.tailoredCvProfileId?.trim() ||
      a?.sourceCvProfileId?.trim() ||
      a?.cvProfileId?.trim() ||
      ''
    );
  }, [analysisForCard]);

  const coverBody = normalizeText(generated.data?.coverLetter as unknown).trim();
  const descriptionForCoverGenerate = (detail?.description ?? '').trim();
  const hasSavedCover = Boolean(coverBody);
  const canAttemptCoverGenerate =
    Boolean(job.jobAnalysisId) && jobDetail.isSuccess && descriptionForCoverGenerate.length >= 30;

  const openAnalyzePrefilled = useCallback(async () => {
    setAnalyzeNavigateBusy(true);
    try {
      const title = job.title ?? '';
      const company = job.company ?? '';
      let description =
        jobDetail.data?.description?.trim() ?? (job.boardDescription?.trim() || '');
      const discoveryId = (job.boardDiscoveryId ?? '').trim();
      if (job.jobAnalysisId && !description) {
        try {
          const d = await queryClient.fetchQuery({
            queryKey: ['job', job.jobAnalysisId],
            queryFn: () => api.jobs.getJob(job.jobAnalysisId!),
          });
          description = d?.description?.trim() ?? '';
        } catch {
          /* description stays empty */
        }
      } else if (!job.jobAnalysisId && discoveryId && !description) {
        try {
          const d = await queryClient.fetchQuery({
            queryKey: ['job-discovery-detail', discoveryId],
            queryFn: () => api.jobDiscovery.getDetail(discoveryId),
          });
          description = d?.description?.trim() ?? '';
        } catch {
          /* description stays empty */
        }
      }
      prefillJobAnalyzerInStorage(title, company, description, {
        hubBookmarkId: job.hubBookmarkId ?? undefined,
      });
      router.push('/dashboard/jobs/analyze?clean=1');
    } finally {
      setAnalyzeNavigateBusy(false);
    }
  }, [
    job.title,
    job.company,
    job.jobAnalysisId,
    job.boardDescription,
    job.boardDiscoveryId,
    job.hubBookmarkId,
    jobDetail.data?.description,
    queryClient,
    router,
  ]);

  const canGenerateEmail = Boolean(job.applicationId || job.jobAnalysisId);

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden bg-[#060a0a] lg:w-0',
        layoutVariant === 'stacked' &&
          'max-lg:mt-2 max-lg:rounded-t-[1.25rem] max-lg:border max-lg:border-[#00C9B1]/50 max-lg:shadow-[0_-6px_28px_-12px_rgba(0,201,177,0.45)]',
        layoutVariant === 'sheet' && 'max-lg:mt-0 max-lg:rounded-none max-lg:border-0 max-lg:shadow-none',
        'lg:border-l lg:border-[#00C9B1]/35 lg:shadow-none',
        className,
      )}
    >
      <header className="shrink-0 border-b border-white/[0.06] px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl lg:text-2xl">{job.title}</h1>
            <p className="mt-1 text-sm text-white/55">{job.company}</p>
            {job.createdAt ? (
              <p className="mt-1 text-xs text-white/35">{formatRelativeSaved(job.createdAt)}</p>
            ) : null}
            {resolvedApplyUrl ? (
              <Button
                type="button"
                className="mt-3 h-9 gap-2 bg-[#00C9B1] px-4 text-[12px] font-semibold text-[#080A0A] hover:bg-[#00C9B1]"
                onClick={() => openExternalJobApplyUrl(resolvedApplyUrl)}
              >
                Apply on company site
              </Button>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canRemoveTrackedJobFromHub(job) &&
            onRequestHubArchive &&
            onRequestHubPipelineRemove &&
            onRequestHubUnbookmark ? (
              <JobHubRowMenu
                job={job}
                disabled={hubManagePending}
                onRequestArchive={onRequestHubArchive}
                onRequestRemoveFromPipeline={onRequestHubPipelineRemove}
                onRequestUnbookmark={onRequestHubUnbookmark}
              />
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/12 p-2 text-white/45 transition-colors hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]"
              aria-label="Close job"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1 overflow-x-auto pb-1 sm:mt-4 sm:gap-1.5">
          {HUB_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStageChange(job, s)}
              className={cn(
                'whitespace-nowrap rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors sm:px-2.5 sm:text-[11px]',
                s === job.stage
                  ? cn(TEAL.pillActive)
                  : 'border-white/10 bg-white/[0.02] text-white/45 hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/10 hover:text-[#00C9B1]/90',
              )}
            >
              {HUB_STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        {job.stage === 'accepted' && onShareWin ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-2 border border-amber-400/40 bg-amber-500/10 text-amber-100 animate-pulse"
              onClick={onShareWin}
            >
              <Share2 className="h-4 w-4" />
              Share your win
            </Button>
            {onVerifyPlacement && verificationStatus === 'none' ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-2 border border-white/15 text-white/70"
                onClick={onVerifyPlacement}
              >
                <ShieldCheck className="h-4 w-4" />
                Verify placement
              </Button>
            ) : verificationStatus !== 'none' ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/55">
                <CheckCircle2 className="h-4 w-4 text-[#00C9B1]" />
                {verificationStatus === 'verified' ? 'Verified' : 'Pending review'}
              </span>
            ) : null}
          </div>
        ) : null}

        {job.applicationAssist ? (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">Apply assist</p>
            <p className="mt-1 text-[12px] text-white/60">
              {job.applicationAssist.suggestedNextStep?.trim() ||
                job.nextRecommendedAction?.trim() ||
                'Complete the checklist below to apply faster with less friction.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                job.applicationAssist.hasCvReady
                  ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/15 bg-white/[0.03] text-white/55',
              )}>
                {job.applicationAssist.hasCvReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                CV ready
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                job.applicationAssist.hasTailoredCv
                  ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/15 bg-white/[0.03] text-white/55',
              )}>
                {job.applicationAssist.hasTailoredCv ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                Tailored CV
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                job.applicationAssist.hasCoverLetterDraft
                  ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/15 bg-white/[0.03] text-white/55',
              )}>
                {job.applicationAssist.hasCoverLetterDraft ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                Cover letter draft
              </span>
            </div>
            {job.applicationAssist.missingFields.length > 0 ? (
              <p className="mt-2 text-[12px] text-white/50">
                Missing: {job.applicationAssist.missingFields.map(formatAssistLabel).join(', ')}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-8 border border-white/[0.08] px-2.5 text-[11px]"
                onClick={() =>
                  router.push(
                    bestCvProfileIdForClinic
                      ? `/dashboard/cv?profileId=${encodeURIComponent(bestCvProfileIdForClinic)}`
                      : '/dashboard/cv',
                  )
                }
              >
                Open CV Clinic
              </Button>
              {Boolean(job.jobAnalysisId) && !job.applicationAssist.hasTailoredCv ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 border border-[#00C9B1]/35 px-2.5 text-[11px] text-[#00C9B1] hover:bg-[#00C9B1]/12"
                  onClick={() =>
                    router.push(`/dashboard/jobs/analyze?jobId=${encodeURIComponent(job.jobAnalysisId!)}&openTailor=1`)
                  }
                >
                  Tailor CV for this job
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="h-8 border border-white/[0.08] px-2.5 text-[11px]"
                onClick={() => void openAnalyzePrefilled()}
                disabled={analyzeNavigateBusy}
              >
                {analyzeNavigateBusy ? 'Opening…' : 'Open Analyzer'}
              </Button>
            </div>
          </div>
        ) : null}

        <nav className="mt-3 flex gap-0 overflow-x-auto border-b border-white/[0.06] pb-px sm:mt-4 sm:gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1 border-b-2 px-2 py-2 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-3 sm:text-xs',
                  active
                    ? cn(TEAL.activeTab, TEAL.textBright)
                    : 'border-transparent text-white/45 hover:border-[#00C9B1]/30 hover:text-[#00C9B1]/90',
                )}
              >
                <Icon className="h-3.5 w-3.5 opacity-80" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto app-scrollbar overscroll-contain touch-pan-y [webkit-overflow-scrolling:touch] px-3 py-4 pb-24 sm:px-4 sm:py-5 lg:px-6 lg:pb-6">
        {tab === 'analysis' ? (
          <>
            {!job.jobAnalysisId ? (
              <div className="border-t border-white/[0.08] pt-5">
                <p className="text-sm text-white/55">
                  Run the job analyzer to see your fit score, gaps, and tailored CV options for this role.
                </p>
                <div className="mt-4">
                  <Button
                    className="bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
                    disabled={analyzeNavigateBusy}
                    onClick={() => void openAnalyzePrefilled()}
                  >
                    {analyzeNavigateBusy ? 'Opening…' : 'Open analyzer'}
                  </Button>
                </div>
              </div>
            ) : jobDetail.isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <Loader2 className={cn('h-8 w-8 animate-spin', TEAL.text)} />
                <p className="text-sm text-white/45">Loading job…</p>
              </div>
            ) : jobDetail.isError ? (
              <p className="text-sm text-rose-200">{getApiErrorMessage(jobDetail.error)}</p>
            ) : analysisForCard ? (
              <div className="space-y-6">
                <JobAnalysisCard
                  analysis={analysisForCard}
                  rematchInProgress={false}
                  scoreBeforeTailor={analysisForCard.scoreBeforeTailoring ?? null}
                  isTailored={Boolean(analysisForCard.isTailored)}
                  showTailorAction={true}
                  hideAiReport
                  applyUrl={resolvedApplyUrl}
                  onApplyNow={() => {
                    if (resolvedApplyUrl) openExternalJobApplyUrl(resolvedApplyUrl);
                  }}
                />
                {shouldShowScoreImprovementGuide(analysisForCard.scoreImprovement) ? (
                  <ScoreImprovementGuideCard guide={analysisForCard.scoreImprovement!} />
                ) : null}
                <AiRecruiterReportSection
                  analysis={analysisForCard}
                  defaultOpen={Boolean(analysisForCard.analysisV2)}
                  applyUrl={resolvedApplyUrl}
                  isTailored={Boolean(
                    analysisForCard.isTailored || analysisForCard.scoreBeforeTailoring != null,
                  )}
                  onApplyNow={() => {
                    if (resolvedApplyUrl) openExternalJobApplyUrl(resolvedApplyUrl);
                  }}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'description' ? (
          job.jobAnalysisId ? (
            jobDetail.isLoading ? (
              <Loader2 className={cn('h-8 w-8 animate-spin', TEAL.text)} />
            ) : jobDetail.isError ? (
              <p className="text-sm text-rose-200">{getApiErrorMessage(jobDetail.error)}</p>
            ) : detail ? (
              <div className="border-t border-white/[0.08] pt-5">
                <h2 className="text-sm font-semibold text-white">Job description</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/40">
                  Full job ad from your saved analysis.
                </p>
                <div
                  className={cn(
                    'mt-4',
                    layoutVariant === 'sheet'
                      ? ''
                      : 'max-h-[min(78vh,900px)] overflow-y-auto app-scrollbar',
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-[1.65] text-white/80">
                    {(detail.description ?? '').trim() || 'No description on file.'}
                  </p>
                </div>
              </div>
            ) : null
          ) : bookmarkListingId ? (
            bookmarkDiscoveryDetail.isLoading ? (
              <div className="flex items-center gap-2 border-t border-white/[0.08] pt-5 text-sm text-white/45">
                <Loader2 className={cn('h-6 w-6 animate-spin', TEAL.text)} aria-hidden />
                Loading description…
              </div>
            ) : bookmarkDiscoveryDetail.isError ? (
              <p className="border-t border-white/[0.08] pt-5 text-sm text-rose-200">
                {getApiErrorMessage(bookmarkDiscoveryDetail.error)}
              </p>
            ) : (
              <div className="border-t border-white/[0.08] pt-5">
                <h2 className="text-sm font-semibold text-white">Job description</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/40">
                  From your saved job ad (full text when we have it).
                </p>
                <div
                  className={cn(
                    'mt-4',
                    layoutVariant === 'sheet'
                      ? ''
                      : 'max-h-[min(78vh,900px)] overflow-y-auto app-scrollbar',
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-[1.65] text-white/80">
                    {(
                      (bookmarkDiscoveryDetail.data?.description ?? '').trim() ||
                      (job.boardDescription ?? '').trim()
                    ).trim() || 'No description stored for this bookmark yet.'}
                  </p>
                </div>
                <p className="mt-4 text-sm text-white/45">
                  Want the full workflow? Open the analyzer — we&apos;ll fill in what we know.
                </p>
                <Button
                  className="mt-3 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
                  disabled={analyzeNavigateBusy}
                  onClick={() => void openAnalyzePrefilled()}
                >
                  {analyzeNavigateBusy ? 'Opening…' : 'Open analyzer'}
                </Button>
              </div>
            )
          ) : (
            <div className="border-t border-white/[0.08] pt-5">
              <p className="text-sm text-white/45">
                No discovery listing is linked to this row, so the description cannot be loaded here.
              </p>
              <p className="mt-2 text-sm text-white/45">Try the analyzer — you can paste the ad there.</p>
              <Button
                className="mt-4 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
                disabled={analyzeNavigateBusy}
                onClick={() => void openAnalyzePrefilled()}
              >
                {analyzeNavigateBusy ? 'Opening…' : 'Open analyzer'}
              </Button>
            </div>
          )
        ) : null}

        {tab === 'cover' ? (
          !job.jobAnalysisId ? (
            <div className="border-t border-white/[0.08] pt-5">
              <h2 className="text-sm font-semibold text-white">Cover letter</h2>
              <p className="mt-2 text-sm text-white/55">
                Analyze this job first. Then you can write or generate a cover letter here.
              </p>
              <Button
                className="mt-4 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
                disabled={analyzeNavigateBusy}
                onClick={() => void openAnalyzePrefilled()}
              >
                {analyzeNavigateBusy ? 'Opening…' : 'Open analyzer'}
              </Button>
            </div>
          ) : (
            <div className="border-t border-white/[0.08] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">Cover letter</h2>
                {coverBody ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1.5 border border-white/12 text-xs"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(coverBody);
                          toast.success('Cover letter copied');
                        } catch {
                          toast.error('Could not copy');
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1.5 border border-white/12 text-xs"
                      onClick={() => {
                        downloadCoverLetterPdf({
                          body: coverBody,
                          title: job.title,
                          company: job.company,
                        });
                        toast.success('PDF download started');
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Download PDF
                    </Button>
                  </div>
                ) : null}
              </div>
              {!hasSavedCover && job.jobAnalysisId ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    className="bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
                    disabled={
                      !canAttemptCoverGenerate ||
                      generateCover.isPending ||
                      (!aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0)
                    }
                    title={
                      !canAttemptCoverGenerate
                        ? 'Need a saved job description (about 30+ characters) from your analysis.'
                        : undefined
                    }
                    onClick={() => {
                      if (!canUseAiFromDailyAiUsage(aiUsage)) {
                        toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
                        return;
                      }
                      generateCover.mutate(
                        {
                          title: job.title,
                          company: job.company,
                          description: descriptionForCoverGenerate,
                          questions: [],
                          ...(job.jobAnalysisId?.trim()
                            ? { jobAnalysisId: job.jobAnalysisId.trim() }
                            : {}),
                        },
                        {
                          onSuccess: () => {
                            toast.success('Cover letter generated');
                          },
                          onError: (err) => {
                            toast.error(getApiErrorMessage(err));
                            void queryClient.invalidateQueries({ queryKey: ['me'] });
                          },
                        },
                      );
                    }}
                  >
                    {generateCover.isPending ? 'Generating…' : 'Generate cover letter'}
                  </Button>
                  {!canAttemptCoverGenerate ? (
                    <span className="text-xs text-white/40">
                      Job ad on file is too short. Refresh it in the analyzer, then try again.
                    </span>
                  ) : !aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0 ? (
                    <span className="text-xs text-amber-200/90">Daily free AI limit reached.</span>
                  ) : null}
                </div>
              ) : null}
              {generated.isLoading ? (
                <Loader2 className={cn('mt-4 h-6 w-6 animate-spin', TEAL.text)} />
              ) : coverBody ? (
                <div
                  className={cn(
                    'mt-3',
                    layoutVariant === 'sheet'
                      ? ''
                      : 'max-h-[min(60vh,560px)] overflow-y-auto app-scrollbar',
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{coverBody}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/45">No saved cover letter for this job yet.</p>
              )}
            </div>
          )
        ) : null}

        {tab === 'notes' ? (
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div className="min-w-0 border-t border-white/[0.08] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">Notes</h2>
                <span className="text-[11px] text-white/40">
                  {notesStatus === 'saving' ? 'Saving…' : null}
                  {notesStatus === 'saved' ? 'Saved' : null}
                  {notesStatus === 'error' ? 'Save failed' : null}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/35">
                {isLocalNotes
                  ? 'Stored on this device only. Pausing typing auto-saves.'
                  : 'Saved to your account. Tap a row to read or edit.'}
              </p>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => {
                  if (notesSaveTimer.current) {
                    clearTimeout(notesSaveTimer.current);
                    notesSaveTimer.current = null;
                  }
                  if (isLocalNotes) flushNotesSave();
                }}
                rows={10}
                className={cn(
                  'mt-3 w-full resize-y rounded-xl border border-white/12 bg-[#080b0b] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none',
                  TEAL.focus,
                )}
                placeholder="Contacts, links, next steps…"
              />
              <Button
                className="mt-3"
                variant="ghost"
                disabled={notesMutationBusy}
                onClick={() => flushNotesSave()}
              >
                Save now
              </Button>

              <div className="mt-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Saved notes</h3>
                <p className="mt-1 text-[11px] text-white/30">Tap a row to expand.</p>
                {!isLocalNotes && serverNotesQ.isLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/45">
                    <Loader2 className={cn('h-4 w-4 animate-spin', TEAL.text)} aria-hidden />
                    Loading notes…
                  </div>
                ) : savedNoteRows.length === 0 ? (
                  <p className="mt-3 text-xs text-white/35">
                    {isLocalNotes ? 'Nothing saved yet.' : 'No saved notes yet — add text above.'}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {savedNoteRows.map((row) => {
                      const open = expandedNoteIds[row.id] === true;
                      return (
                        <li
                          key={row.id}
                          className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#080b0b]/80"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedNoteIds((prev) => ({ ...prev, [row.id]: !open }))
                            }
                            className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-[#00C9B1]/12"
                          >
                            {open ? (
                              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-hidden />
                            ) : (
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-hidden />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] font-medium uppercase tracking-wide text-white/35">
                                {formatReminderWhen(row.createdAt)}
                              </span>
                              <span className="mt-0.5 block text-xs text-white/70">
                                {row.snippet?.trim() ? row.snippet : noteSnippet(row.body)}
                              </span>
                            </span>
                          </button>
                          {open ? (
                            <div className="border-t border-white/[0.06] px-3 py-2.5 pl-10">
                              {!isLocalNotes && noteRowEditId === row.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={noteRowEditText}
                                    onChange={(e) => setNoteRowEditText(e.target.value)}
                                    rows={6}
                                    className={cn(
                                      'w-full resize-y rounded-lg border border-white/12 bg-[#080b0b] px-3 py-2 text-sm text-white focus:outline-none',
                                      TEAL.focus,
                                    )}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="border border-white/12 text-xs"
                                      disabled={notesMutationBusy || !noteRowEditText.trim()}
                                      onClick={() =>
                                        patchHubNote.mutate({
                                          noteId: row.id,
                                          body: noteRowEditText.trim(),
                                        })
                                      }
                                    >
                                      Save changes
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="text-xs text-white/55"
                                      disabled={notesMutationBusy}
                                      onClick={() => {
                                        setNoteRowEditId(null);
                                        setNoteRowEditText('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                                  {row.body}
                                </p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {!isLocalNotes ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="gap-1.5 border border-white/12 text-xs"
                                      disabled={notesMutationBusy || noteRowEditId === row.id}
                                      onClick={() => {
                                        setNoteRowEditId(row.id);
                                        setNoteRowEditText(row.body);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="gap-1.5 border border-rose-400/25 text-xs text-rose-200/90 hover:bg-rose-500/10"
                                      disabled={notesMutationBusy}
                                      onClick={() => {
                                        if (
                                          !window.confirm(
                                            'Delete this note? This cannot be undone.',
                                          )
                                        )
                                          return;
                                        deleteHubNote.mutate(row.id);
                                        setExpandedNoteIds((prev) => ({ ...prev, [row.id]: false }));
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                      Delete
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="gap-1.5 border border-white/12 text-xs"
                                    disabled={notesMutationBusy}
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          'Remove this note from this device?',
                                        )
                                      )
                                        return;
                                      removeNoteEntry(job.key, row.id);
                                      setNotesListTick((n) => n + 1);
                                      setExpandedNoteIds((prev) => ({ ...prev, [row.id]: false }));
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="min-w-0 border-t border-white/[0.08] pt-5">
              <h2 className="text-sm font-semibold text-white">Reminders</h2>
              {canUseHubReminders ? (
                <p className="mt-1 text-xs text-white/40">
                  Hub follow-ups sync to your account (not the same as application email reminders). Open from any
                  device.
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/40">
                  Reminders on this device. Turn on alerts for a pop-up. Optional: email too if you sync to your account.
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/12 text-xs"
                  disabled={browserAlertsOn || typeof Notification === 'undefined'}
                  onClick={async () => {
                    if (typeof Notification === 'undefined') {
                      toast.error('This browser does not support notifications.');
                      return;
                    }
                    const p = await Notification.requestPermission();
                    if (p === 'granted') {
                      setBrowserAlertsOn(true);
                      toast.success('You’ll get a pop-up when a reminder is due.');
                      notifyDueLocalReminders();
                    } else {
                      toast.error('Alerts stay off until you allow them in your browser settings.');
                    }
                  }}
                >
                  {browserAlertsOn ? 'Browser alerts on' : 'Turn on browser alerts'}
                </Button>
              </div>

              {canUseHubReminders && hubRemindersQuery.isLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-white/45">
                  <Loader2 className={cn('h-5 w-5 animate-spin', TEAL.text)} aria-hidden />
                  Loading follow-ups…
                </div>
              ) : canUseHubReminders && hubRemindersQuery.isError ? (
                <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(hubRemindersQuery.error)}</p>
              ) : canUseHubReminders && hubRemindersDisplay.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {hubRemindersDisplay.map((r) => {
                    const st = localReminderStatus(r.remindAt);
                    const line = r.title?.trim() || r.note?.trim() || '—';
                    return (
                      <li
                        key={r.id}
                        className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#080b0b]/80 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                st === 'upcoming' && 'bg-[#00C9B1]/20 text-[#00C9B1]',
                                st === 'due' && 'bg-amber-500/20 text-amber-100',
                                st === 'elapsed' && 'bg-white/[0.06] text-white/45',
                              )}
                            >
                              {reminderStatusLabel(st)}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                              Account
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-white/45">{formatReminderWhen(r.remindAt)}</p>
                          <p className="mt-1 text-sm text-white/85">{line}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5 self-start sm:items-end">
                          <button
                            type="button"
                            className="rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/55 hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/12 hover:text-[#00C9B1]"
                            onClick={() => patchHubReminderMut.mutate({ id: r.id, status: 'completed' })}
                            disabled={patchHubReminderMut.isPending}
                          >
                            Mark done
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-rose-400/25 px-2 py-1 text-[11px] text-rose-200/90 hover:bg-rose-500/10"
                            onClick={() => {
                              if (!window.confirm('Delete this follow-up?')) return;
                              deleteHubReminderMut.mutate(r.id);
                            }}
                            disabled={deleteHubReminderMut.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : canUseHubReminders ? (
                <p className="mt-3 text-xs text-white/30">No open follow-ups for this job.</p>
              ) : displayReminders.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {displayReminders.map((r) => {
                    const st = localReminderStatus(r.remindAt);
                    return (
                      <li
                        key={r.id}
                        className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#080b0b]/80 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                st === 'upcoming' && 'bg-[#00C9B1]/20 text-[#00C9B1]',
                                st === 'due' && 'bg-amber-500/20 text-amber-100',
                                st === 'elapsed' && 'bg-white/[0.06] text-white/45',
                              )}
                            >
                              {reminderStatusLabel(st)}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                              This device
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-white/45">{formatReminderWhen(r.remindAt)}</p>
                          <p className="mt-1 text-sm text-white/85">{r.message || '—'}</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 self-start rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/55 hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/12 hover:text-[#00C9B1]"
                          onClick={() => {
                            removeLocalReminder(r.id);
                            bumpLocalReminders();
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-white/30">No reminders for this job yet.</p>
              )}

              {canUseHubReminders && displayReminders.length > 0 ? (
                <>
                  <p className="mt-6 text-xs font-medium uppercase tracking-wide text-white/45">Also on this device</p>
                  <ul className="mt-2 space-y-2">
                    {displayReminders.map((r) => {
                      const st = localReminderStatus(r.remindAt);
                      return (
                        <li
                          key={r.id}
                          className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#080b0b]/80 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  st === 'upcoming' && 'bg-[#00C9B1]/20 text-[#00C9B1]',
                                  st === 'due' && 'bg-amber-500/20 text-amber-100',
                                  st === 'elapsed' && 'bg-white/[0.06] text-white/45',
                                )}
                              >
                                {reminderStatusLabel(st)}
                              </span>
                              <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                                This device
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-white/45">{formatReminderWhen(r.remindAt)}</p>
                            <p className="mt-1 text-sm text-white/85">{r.message || '—'}</p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 self-start rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/55 hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/12 hover:text-[#00C9B1]"
                            onClick={() => {
                              removeLocalReminder(r.id);
                              bumpLocalReminders();
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}

              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-white/45">When</span>
                  <input
                    type="datetime-local"
                    value={reminderAt}
                    onChange={(e) => setReminderAt(e.target.value)}
                    className={cn(
                      'block w-full rounded-xl border border-white/12 bg-[#080b0b] px-3 py-2 text-sm text-white focus:outline-none',
                      TEAL.focus,
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-white/45">
                    {canUseHubReminders ? 'Title (optional)' : 'Message'}
                  </span>
                  <input
                    type="text"
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    placeholder="e.g. Follow up with Jamie at Acme"
                    className={cn(
                      'block w-full rounded-xl border border-white/12 bg-[#080b0b] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none',
                      TEAL.focus,
                    )}
                  />
                </div>
                {!canUseHubReminders ? (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={reminderSyncCloud}
                      disabled={!canSyncCloudReminder || syncCloudReminder.isPending}
                      onChange={(e) => setReminderSyncCloud(e.target.checked)}
                      className="mt-0.5 shrink-0 rounded border-white/20 bg-[#080b0b]"
                    />
                    <span className="text-xs leading-snug text-white/50">
                      <span className="font-medium text-white/70">Also schedule on my account</span> — email and
                      in-app reminder when due (per your backend). Leave off to keep this reminder device-only.
                      {!canSyncCloudReminder ? (
                        <span className="mt-1 block text-amber-200/80">
                          Requires a saved job analysis or an application row so the server can attach the reminder.
                        </span>
                      ) : null}
                    </span>
                  </label>
                ) : null}
                <Button
                  variant="ghost"
                  className="border border-white/12"
                  disabled={
                    canUseHubReminders
                      ? !hubReminderTimeOk || createHubReminderMut.isPending
                      : !reminderValid || !reminderMessage.trim() || syncCloudReminder.isPending
                  }
                  onClick={() => scheduleReminder()}
                >
                  {canUseHubReminders
                    ? createHubReminderMut.isPending
                      ? 'Saving…'
                      : 'Save follow-up'
                    : syncCloudReminder.isPending
                      ? 'Saving…'
                      : 'Save reminder'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'email' ? (
          <div className="border-t border-white/[0.08] pt-5">
            <h2 className="text-sm font-semibold text-white">Email templates</h2>
            {!canGenerateEmail ? (
              <p className="mt-2 text-sm text-white/45">
                Save an analysis or application first. Then you can draft emails here.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-white/40">
                  AI draft only — copy what you need. Nothing auto-sends.
                </p>
                <div className="mt-5 max-w-2xl space-y-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-white/45">
                    Template type
                  </span>
                  <select
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value as JobHubEmailTemplateType)}
                    className={cn(
                      'block w-full rounded-xl border border-white/12 bg-[#080b0b] px-3 py-2.5 text-sm text-white focus:outline-none',
                      TEAL.focus,
                    )}
                  >
                    {JOB_HUB_EMAIL_TEMPLATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-5 max-w-2xl space-y-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-white/45">
                    Optional extra detail
                  </span>
                  <textarea
                    value={emailExtra}
                    onChange={(e) => setEmailExtra(e.target.value)}
                    rows={4}
                    placeholder="e.g. hiring manager name, dates, tone…"
                    className={cn(
                      'block w-full rounded-xl border border-white/12 bg-[#080b0b] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none',
                      TEAL.focus,
                    )}
                  />
                </div>
                <Button
                  className="mt-4 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
                  disabled={genEmail.isPending}
                  onClick={() => {
                    setEmailDraft(null);
                    genEmail.mutate();
                  }}
                >
                  {genEmail.isPending ? 'Generating…' : 'Generate'}
                </Button>
                {emailDraft ? (
                  <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-[#080b0b] p-4">
                    <p className="text-xs font-semibold text-white/55">Subject</p>
                    <p className="text-sm text-white">{emailDraft.subject}</p>
                    <p className="text-xs font-semibold text-white/55">Body</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{emailDraft.body}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1.5 border border-white/12 text-xs"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`${emailDraft.subject}\n\n${emailDraft.body}`);
                          toast.success('Copied to clipboard');
                        } catch {
                          toast.error('Could not copy');
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy draft
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {tab === 'resume' ? (
          <div className="border-t border-white/[0.08] pt-5">
            <h2 className="text-sm font-semibold text-white">CV for this role</h2>
            {!job.jobAnalysisId ? (
              <p className="mt-2 text-sm text-white/55">
                Analyze this job first. After that you can tailor your CV to match it.
              </p>
            ) : analysisForCard?.isTailored && analysisForCard.tailoredCvName ? (
              <p className="mt-2 text-sm text-white/75">
                CV tailored for this job:{' '}
                <span className="font-medium text-white">{analysisForCard.tailoredCvName}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-white/55">No tailored CV saved for this job yet.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {showTailoredCvInBuilderLink ? (
                <Link
                  href={`/dashboard/cv?profileId=${encodeURIComponent(tailoredCvProfileIdForLink)}`}
                  className={cn(
                    'inline-flex items-center rounded-xl border px-3 py-2 text-xs font-semibold',
                    TEAL.borderSoft,
                    TEAL.bgMuted,
                    TEAL.textBright,
                    TEAL.bgHover,
                  )}
                >
                  Open tailored CV in editor
                </Link>
              ) : null}
              {job.jobAnalysisId ? (
                <Link
                  href={`/dashboard/jobs/analyze?jobId=${encodeURIComponent(job.jobAnalysisId)}&openTailor=1`}
                  className="inline-flex items-center rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/12 hover:text-[#00C9B1]"
                >
                  Tailor your CV (analyzer)
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/12 text-xs"
                  disabled={analyzeNavigateBusy}
                  onClick={() => void openAnalyzePrefilled()}
                >
                  {analyzeNavigateBusy ? 'Opening…' : 'Open analyzer'}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
