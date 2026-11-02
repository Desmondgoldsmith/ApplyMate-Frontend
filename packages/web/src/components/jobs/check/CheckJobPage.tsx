'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { pickDefaultProfile } from '@/components/dashboard/home/homeModel';
import { Button } from '@/components/ui/Button';
import { useAnalyzeJob } from '@/hooks/useAnalyzeJob';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useJobHistory } from '@/hooks/useJobHistory';
import type {
  CvTailorDraft,
  CvTailorDraftEntry,
  JobAnalysis,
  JobHistoryItem,
} from '@/lib/api';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryKeys';

import {
  AddJobStep,
  CheckJobProgress,
  MatchStep,
  TailoredStep,
  WorkingPanel,
} from './CheckJobSteps';
import { looksLikeLink, type CheckStep } from './checkJobModel';

type Stage =
  | 'add'
  | 'loading'
  | 'reading'
  | 'analyzing'
  | 'match'
  | 'tailoring'
  | 'done';

type JobInfo = {
  title: string;
  company: string;
  description: string;
  applyUrl: string | null;
  jobListingId: string | null;
};

const EMPTY_JOB: JobInfo = {
  title: '',
  company: '',
  description: '',
  applyUrl: null,
  jobListingId: null,
};

function stepOf(stage: Stage): CheckStep {
  if (stage === 'match' || stage === 'tailoring') return 2;
  if (stage === 'done') return 3;
  return 1;
}

/**
 * Check a job, in three steps: paste a job (link or text) → see the match and confirm missing
 * skills you really have → one tap makes a tailored copy of the CV, with Undo per change.
 */
export function CheckJobPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const analyzeJob = useAnalyzeJob();
  const { displayRows, isBootstrapping } = useCvProfileRowsDisplay();
  const history = useJobHistory({ limit: 6 });

  const [stage, setStage] = useState<Stage>('add');
  const [text, setText] = useState('');
  const [cvId, setCvId] = useState<string | null>(null);
  const [job, setJob] = useState<JobInfo>(EMPTY_JOB);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<CvTailorDraft | null>(null);
  const [scoreBefore, setScoreBefore] = useState<number | null>(null);
  const [scoreAfter, setScoreAfter] = useState<number | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  /** The jobId already on screen, so writing it into the URL does not load it again. */
  const shownJobIdRef = useRef<string | null>(null);

  const jobIdParam = searchParams.get('jobId')?.trim() || null;
  const listingParam = searchParams.get('jobListingId')?.trim() || null;
  const cvParam = searchParams.get('cvProfileId')?.trim() || null;

  useEffect(() => {
    if (cvId || displayRows.length === 0) return;
    const fromUrl = cvParam && displayRows.find((r) => r.id === cvParam);
    setCvId(
      fromUrl ? fromUrl.id : (pickDefaultProfile(displayRows)?.id ?? null),
    );
  }, [cvId, cvParam, displayRows]);

  const template = useMemo(
    () => displayRows.find((r) => r.id === cvId)?.template ?? null,
    [cvId, displayRows],
  );

  const showSavedJob = useCallback(
    (
      id: string,
      info: JobInfo,
      a: JobAnalysis,
      savedDraft: CvTailorDraft | null,
    ) => {
      shownJobIdRef.current = id;
      setJob(info);
      setAnalysis(a);
      setConfirmed(new Set());
      if (savedDraft && savedDraft.drafts.length > 0) {
        setDraft(savedDraft);
        setScoreBefore(a.scoreBeforeTailoring ?? null);
        setScoreAfter(a.matchScore ?? null);
        setStage('done');
      } else {
        setDraft(null);
        setStage('match');
      }
    },
    [],
  );

  const openJobInUrl = useCallback(
    (id: string) => {
      shownJobIdRef.current = id;
      router.replace(`${pathname}?jobId=${encodeURIComponent(id)}`, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const runAnalysis = useCallback(
    async (info: JobInfo) => {
      setStage('analyzing');
      setAddError(null);
      try {
        const result = await analyzeJob.mutateAsync({
          description: info.description,
          ...(info.title ? { title: info.title } : {}),
          ...(info.company ? { company: info.company } : {}),
          ...(cvId ? { cvProfileId: cvId } : {}),
          ...(info.applyUrl ? { applyUrl: info.applyUrl } : {}),
          ...(info.jobListingId ? { jobListingId: info.jobListingId } : {}),
        });
        let shown: JobAnalysis = result;
        let saved: { title: string; company: string } | null = null;
        if (result.id) {
          // The saved check is the cleaned-up one (same list the score uses, same as a refresh shows).
          try {
            const detail = await api.jobs.getJob(result.id);
            shown = { ...detail.analysis, id: detail.analysis.id ?? result.id };
            saved = { title: detail.title, company: detail.company };
          } catch {
            /* the fresh result is still usable */
          }
        }
        const next: JobInfo = {
          ...info,
          title: info.title || saved?.title || result.title?.trim() || '',
          company:
            info.company || saved?.company || result.company?.trim() || '',
          applyUrl: info.applyUrl ?? shown.applyUrl ?? result.applyUrl ?? null,
        };
        setJob(next);
        setAnalysis(shown);
        setConfirmed(new Set());
        setDraft(null);
        setStage('match');
        if (result.id) openJobInUrl(result.id);
      } catch (e) {
        setAddError(getApiErrorMessage(e));
        setStage('add');
      }
    },
    [analyzeJob, cvId, openJobInUrl],
  );

  const submit = useCallback(async () => {
    const value = text.trim();
    if (!value) return;
    if (!looksLikeLink(value)) {
      await runAnalysis({ ...EMPTY_JOB, description: value });
      return;
    }
    setStage('reading');
    setAddError(null);
    try {
      const imported = await api.jobs.importLink(value);
      await runAnalysis({
        title: imported.title,
        company: imported.company,
        description: imported.description,
        applyUrl: imported.applyUrl,
        jobListingId: null,
      });
    } catch (e) {
      setAddError(getApiErrorMessage(e));
      setStage('add');
    }
  }, [runAnalysis, text]);

  // A saved job (?jobId=) or a job board listing (?jobListingId=) opened from elsewhere.
  useEffect(() => {
    if (jobIdParam && jobIdParam !== shownJobIdRef.current) {
      let cancelled = false;
      setStage('loading');
      api.jobs
        .getJob(jobIdParam)
        .then((detail) => {
          if (cancelled) return;
          showSavedJob(
            jobIdParam,
            {
              title: detail.title,
              company: detail.company,
              description: detail.description,
              applyUrl: detail.analysis.applyUrl ?? null,
              jobListingId: detail.analysis.jobListingId ?? null,
            },
            { ...detail.analysis, id: detail.analysis.id ?? jobIdParam },
            detail.tailorDraft ?? null,
          );
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setAddError(getApiErrorMessage(e));
          setStage('add');
        });
      return () => {
        cancelled = true;
      };
    }
    if (listingParam && !jobIdParam && stage === 'add' && cvId) {
      let cancelled = false;
      setStage('loading');
      api.jobDiscovery
        .getDetail(listingParam)
        .then((listing) => {
          if (cancelled) return;
          void runAnalysis({
            title: listing.title,
            company: listing.company,
            description: listing.description,
            applyUrl: listing.url ?? null,
            jobListingId: listing.id || listingParam,
          });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setAddError(getApiErrorMessage(e));
          setStage('add');
        });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
    // runAnalysis/showSavedJob are stable enough; re-running on stage changes would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdParam, listingParam, cvId]);

  const tailor = useCallback(async () => {
    if (!analysis?.id) return;
    const sourceCvId = analysis.cvProfileId ?? cvId;
    if (!sourceCvId) return;
    setStage('tailoring');
    setTailorError(null);
    const before = analysis.matchScore ?? null;
    try {
      const res = await api.cv.createTailorDraft({
        cvProfileId: sourceCvId,
        jobAnalysisId: analysis.id,
        selectedSkills: [...confirmed],
        autoApply: true,
      });
      setDraft(res.draft);
      setScoreBefore(before);
      setScoreAfter(res.jobAnalysis?.matchScore ?? before);
      if (res.jobAnalysis) setAnalysis({ ...analysis, ...res.jobAnalysis });
      setStage('done');
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jobs.history(),
      });
    } catch (e) {
      setTailorError(getApiErrorMessage(e));
      setStage('match');
    }
  }, [analysis, confirmed, cvId, queryClient]);

  const changeEntry = useCallback(
    async (entry: CvTailorDraftEntry, action: 'undo' | 'putBack') => {
      if (!draft) return;
      setBusyEntryId(entry.sectionId);
      try {
        const res =
          action === 'undo' && entry.patchId
            ? await api.cv.revertPatch(entry.patchId)
            : await api.cv.acceptTailorSection(draft.id, entry.sectionId, {
                overwriteEdits: true,
              });
        setDraft(res.draft);
        if (res.jobAnalysis?.matchScore != null) {
          setScoreAfter(res.jobAnalysis.matchScore);
        }
      } catch (e) {
        setTailorError(getApiErrorMessage(e));
      } finally {
        setBusyEntryId(null);
      }
    },
    [draft],
  );

  const writeCoverLetter = useCallback(async () => {
    if (!analysis?.id) return;
    setCoverBusy(true);
    setCoverError(null);
    try {
      const out = await api.jobs.generate({
        title: job.title,
        company: job.company,
        description: job.description,
        questions: [],
        jobAnalysisId: analysis.id,
      });
      setCoverLetter(out.coverLetter?.trim() || null);
    } catch (e) {
      setCoverError(getApiErrorMessage(e));
    } finally {
      setCoverBusy(false);
    }
  }, [analysis?.id, job]);

  const startOver = useCallback(() => {
    shownJobIdRef.current = null;
    setStage('add');
    setText('');
    setJob(EMPTY_JOB);
    setAnalysis(null);
    setDraft(null);
    setConfirmed(new Set());
    setAddError(null);
    setTailorError(null);
    setCoverLetter(null);
    setCoverError(null);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const recent = useMemo(() => {
    const items: JobHistoryItem[] = Array.isArray(history.data)
      ? history.data
      : [];
    return items
      .filter((j) => j.id && !j.id.startsWith('optimistic-'))
      .slice(0, 3)
      .map((j) => ({
        id: j.id,
        title: (j.jobTitle || j.title || '').trim(),
        company: (j.company || '').trim(),
        score: j.matchScore,
        logoUrl: j.companyLogoUrl ?? null,
      }));
  }, [history.data]);

  const noCv = !isBootstrapping && displayRows.length === 0;

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-text-primary sm:text-[32px]">
            Check a job
          </h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            See how well you match, then get a CV made for the job. About 2
            minutes.
          </p>
        </div>
        <CheckJobProgress current={stepOf(stage)} />
      </header>

      {noCv ? (
        <section className="rounded-3xl border border-border-subtle bg-bg-surface p-6 text-center shadow-raised">
          <h2 className="font-display text-[20px] font-bold text-text-primary">
            Add your CV first
          </h2>
          <p className="mt-1 text-[14px] text-text-secondary">
            We compare jobs with your CV, so we need it before we can check a
            job.
          </p>
          <Button asChild variant="accent" className="mt-4 px-7">
            <Link href="/dashboard/cv">Add my CV</Link>
          </Button>
        </section>
      ) : stage === 'add' ? (
        <AddJobStep
          text={text}
          onText={(v) => {
            setText(v);
            if (addError) setAddError(null);
          }}
          cvRows={displayRows}
          cvId={cvId}
          onCvChange={setCvId}
          error={addError}
          onSubmit={() => void submit()}
          recent={recent}
        />
      ) : stage === 'loading' ? (
        <WorkingPanel
          title="Opening the job…"
          steps={['Loading your saved check']}
          note="One moment."
        />
      ) : stage === 'reading' ? (
        <WorkingPanel
          title="Reading the job…"
          steps={['Opening the link', 'Finding the job details']}
          note="This takes a few seconds."
        />
      ) : stage === 'analyzing' ? (
        <WorkingPanel
          title="Checking your match…"
          steps={[
            'Reading what the job asks for',
            'Comparing it with your CV',
            'Working out your score',
          ]}
          note="Usually about 30 seconds. You can stay on this page."
        />
      ) : stage === 'tailoring' ? (
        <WorkingPanel
          title="Tailoring your CV…"
          steps={[
            'Making a copy of your CV',
            'Rewording your summary and bullets',
            'Checking nothing was made up',
          ]}
          note="Usually about 30 seconds. Your original CV is not touched."
        />
      ) : stage === 'match' && analysis ? (
        <MatchStep
          analysis={analysis}
          title={job.title}
          company={job.company}
          logoUrl={analysis.companyLogoUrl ?? null}
          confirmed={confirmed}
          onToggle={(label) =>
            setConfirmed((prev) => {
              const next = new Set(prev);
              if (next.has(label)) next.delete(label);
              else next.add(label);
              return next;
            })
          }
          onTailor={() => void tailor()}
          error={tailorError}
          onStartOver={startOver}
        />
      ) : stage === 'done' && draft && analysis?.id ? (
        <TailoredStep
          draft={draft}
          cvName={analysis.tailoredCvName ?? draft.tailoredCvName ?? null}
          title={job.title}
          company={job.company}
          logoUrl={analysis.companyLogoUrl ?? null}
          scoreBefore={scoreBefore}
          scoreAfter={scoreAfter}
          applyUrl={job.applyUrl}
          template={template}
          jobAnalysisId={analysis.id}
          busyEntryId={busyEntryId}
          onUndo={(e) => void changeEntry(e, 'undo')}
          onPutBack={(e) => void changeEntry(e, 'putBack')}
          coverLetter={coverLetter}
          coverBusy={coverBusy}
          coverError={coverError ?? tailorError}
          onCoverLetter={() => void writeCoverLetter()}
          onStartOver={startOver}
        />
      ) : null}
    </div>
  );
}
