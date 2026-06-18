'use client';

import { Loader2, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { CvProfileDownloadActions } from '@/components/dashboard/CvProfileDownloadActions';
import type { JobAnalysis } from '@/lib/api';
import { resolveSelectedCvProfileId } from '@/lib/jobAnalysisCvContext';

export type JobHubSavePanelAiUsage = {
  isPaidTier: boolean;
  isLoading: boolean;
  remaining: number | null | undefined;
};

export type JobHubSavePanelProps = {
  analysis: JobAnalysis;
  title: string;
  company: string;
  description: string;
  hasCoverLetter: boolean;
  generatePending: boolean;
  savePending: boolean;
  aiUsage: JobHubSavePanelAiUsage;
  selectedProfileId: string | null;
  cvProfileId: string | undefined;
  tailoredCvProfileId: string | null | undefined;
  sourceCvProfileId: string | null | undefined;
  exportTemplate?: string | null;
  onGenerateCoverLetter: () => void;
};

/**
 * Apply-tracker actions: generate cover letter (saves to job list) and mock interview entry.
 */
export function JobHubSavePanel({
  analysis,
  title,
  company,
  hasCoverLetter,
  generatePending,
  savePending,
  aiUsage,
  selectedProfileId,
  cvProfileId,
  tailoredCvProfileId,
  sourceCvProfileId,
  exportTemplate,
  onGenerateCoverLetter,
}: JobHubSavePanelProps) {
  const router = useRouter();
  const downloadCvProfileId =
    resolveSelectedCvProfileId(analysis, cvProfileId ?? selectedProfileId) ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap">
      <Button
        variant="ghost"
        title={
          hasCoverLetter
            ? 'You already have a cover letter for this job. Clear the form to generate another.'
            : undefined
        }
        disabled={
          hasCoverLetter ||
          generatePending ||
          savePending ||
          (!aiUsage.isPaidTier &&
            !aiUsage.isLoading &&
            (aiUsage.remaining ?? 0) === 0)
        }
        className="min-h-[44px] w-full gap-2 rounded-full border border-[#00C9B1]/40 bg-transparent px-5 text-[13px] font-medium text-[#00C9B1] transition-colors hover:bg-[rgba(0,201,177,0.1)] sm:w-auto"
        onClick={onGenerateCoverLetter}
      >
        {savePending
          ? 'Saving...'
          : generatePending
            ? 'Generating...'
            : hasCoverLetter
              ? 'Cover letter ready'
              : !aiUsage.isPaidTier &&
                  !aiUsage.isLoading &&
                  (aiUsage.remaining ?? 0) === 0
                ? 'Daily AI limit reached'
                : 'Generate cover letter'}
      </Button>
      <Button
        variant="ghost"
        className="min-h-[44px] w-full gap-2 rounded-full border border-white/[0.1] bg-transparent px-5 text-[13px] font-medium text-white/70 transition-colors hover:border-white/[0.18] hover:bg-white/[0.04] hover:text-white sm:w-auto"
        onClick={() => {
          const qp = new URLSearchParams();
          const analysisId = (analysis.id ?? '').trim();
          const preferredCv = (
            tailoredCvProfileId ??
            sourceCvProfileId ??
            analysis.cvProfileId ??
            selectedProfileId ??
            cvProfileId ??
            ''
          ).trim();
          const analyzedCv = (
            sourceCvProfileId ??
            analysis.cvProfileId ??
            ''
          ).trim();
          const baseCv = (
            analysis.cvProfileId ??
            selectedProfileId ??
            cvProfileId ??
            ''
          ).trim();
          if (analysisId) qp.set('jobAnalysisId', analysisId);
          if (title.trim()) qp.set('jobTitle', title.trim());
          if (company.trim()) qp.set('company', company.trim());
          if (preferredCv) {
            qp.set('preferredCvProfileId', preferredCv);
            qp.set('tailoringCvProfileId', preferredCv);
          }
          if (analyzedCv) qp.set('analyzedCvProfileId', analyzedCv);
          if (baseCv) qp.set('cvProfileId', baseCv);
          router.push(
            `/dashboard/interview${qp.toString() ? `?${qp.toString()}` : ''}`,
          );
        }}
      >
        <Mic
          className="h-4 w-4 shrink-0 text-white/55"
          strokeWidth={2}
          aria-hidden
        />
        Start Mock Interview
      </Button>
      </div>
      {downloadCvProfileId ? (
        <CvProfileDownloadActions
          cvProfileId={downloadCvProfileId}
          jobAnalysisId={analysis.id}
          template={exportTemplate}
        />
      ) : null}
    </div>
  );
}
