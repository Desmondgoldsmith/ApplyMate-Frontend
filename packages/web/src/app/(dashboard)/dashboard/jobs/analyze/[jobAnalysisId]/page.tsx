import { redirect } from 'next/navigation';

type Props = { params: Promise<{ jobAnalysisId: string }> };

/** Deep links from dashboard continuation: `/jobs/analyze/:id` → analyzer with job loaded. */
export default async function JobsAnalyzeByIdPage({ params }: Props) {
  const { jobAnalysisId } = await params;
  const id = jobAnalysisId?.trim();
  if (!id) {
    redirect('/dashboard/jobs/analyze');
  }
  redirect(`/dashboard/jobs/analyze?jobId=${encodeURIComponent(id)}`);
}
