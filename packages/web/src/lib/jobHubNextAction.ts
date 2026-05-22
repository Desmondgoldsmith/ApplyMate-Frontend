import type { CareerDashboard } from '@/lib/career';

import type { TrackedJob } from '@/app/(dashboard)/dashboard/jobs/jobHubMerge';

export type HubNextAction = {
  id: string;
  label: string;
  detail: string;
  href?: string;
  onClickKey?: 'tailor' | 'apply' | 'interview' | 'accepted';
};

export function pickNextBestAction(
  career: CareerDashboard | undefined,
  jobs: TrackedJob[],
): HubNextAction | null {
  const tailoring = jobs.find(
    (j) =>
      j.applicationAssist?.hasTailoredCv &&
      j.stage !== 'applied' &&
      j.stage !== 'interviewing' &&
      j.stage !== 'negotiating' &&
      j.stage !== 'accepted',
  );
  if (tailoring?.jobAnalysisId) {
    return {
      id: 'tailor',
      label: 'Continue tailoring',
      detail: `Finish CV updates for ${tailoring.title} at ${tailoring.company}.`,
      href: `/dashboard/jobs/analyze?jobId=${encodeURIComponent(tailoring.jobAnalysisId)}&openTailor=1`,
      onClickKey: 'tailor',
    };
  }

  const pipelineTailor = career?.activePipelineJobs.find((p) => p.pipelineStage === 'TAILORED');
  if (pipelineTailor) {
    const metaId =
      typeof pipelineTailor.jobId === 'string' ? pipelineTailor.jobId : '';
    return {
      id: 'tailor-pipeline',
      label: 'Continue tailoring',
      detail: `Resume tailoring for ${pipelineTailor.title ?? 'this role'}.`,
      href: metaId ? `/dashboard/jobs?jobId=${encodeURIComponent(metaId)}` : '/dashboard/jobs',
      onClickKey: 'tailor',
    };
  }

  const finishApply = jobs.find(
    (j) =>
      (j.stage === 'analyzed' || j.applicationAssist?.suggestedNextStep) &&
      !j.isApplied &&
      j.hasAnalysis,
  );
  if (finishApply?.jobAnalysisId) {
    return {
      id: 'apply',
      label: 'Finish application',
      detail: `Complete your application for ${finishApply.title}.`,
      href: `/dashboard/jobs?jobId=${encodeURIComponent(finishApply.jobAnalysisId)}`,
      onClickKey: 'apply',
    };
  }

  const interviewing = jobs.find((j) => j.stage === 'interviewing' && j.jobAnalysisId);
  if (interviewing?.jobAnalysisId) {
    return {
      id: 'interview',
      label: 'Review interview prep',
      detail: `Prep for ${interviewing.title} at ${interviewing.company}.`,
      href: `/dashboard/interview?jobAnalysisId=${encodeURIComponent(interviewing.jobAnalysisId)}&jobTitle=${encodeURIComponent(interviewing.title)}&company=${encodeURIComponent(interviewing.company)}`,
      onClickKey: 'interview',
    };
  }

  const acceptedCount =
    (career?.acceptedJobs.length ?? 0) + jobs.filter((j) => j.stage === 'accepted').length;
  if (acceptedCount > 0) {
    return {
      id: 'accepted',
      label: 'Check accepted jobs',
      detail: `You have ${acceptedCount} accepted ${acceptedCount === 1 ? 'role' : 'roles'} to celebrate.`,
      href: '/dashboard/jobs?pipelineTab=accepted',
      onClickKey: 'accepted',
    };
  }

  const analyzed = career?.activePipelineJobs.find((p) => p.pipelineStage === 'ANALYZED');
  if (analyzed) {
    return {
      id: 'analyze-pipeline',
      label: 'Finish application',
      detail: `Move ${analyzed.title ?? 'your top role'} forward in the pipeline.`,
      href: `/dashboard/jobs?jobId=${encodeURIComponent(analyzed.jobId)}`,
      onClickKey: 'apply',
    };
  }

  return null;
}
