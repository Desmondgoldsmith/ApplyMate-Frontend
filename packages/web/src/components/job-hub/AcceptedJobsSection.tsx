'use client';

import { Share2, Trophy } from 'lucide-react';
import Link from 'next/link';

import type { CareerBadge, CareerPipelineJob } from '@/lib/career';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export type AcceptedJobCard = {
  jobId: string;
  title: string;
  company: string;
  acceptedAt: string | null;
  badge?: CareerBadge | null;
};

export function AcceptedJobsSection({
  jobs,
  onOpenJob,
  onShareAchievement,
  className,
  variant = 'full',
  viewAllHref,
  totalCount,
}: {
  jobs: AcceptedJobCard[];
  onOpenJob: (jobId: string) => void;
  onShareAchievement: (job: AcceptedJobCard) => void;
  className?: string;
  variant?: 'full' | 'rail';
  viewAllHref?: string;
  totalCount?: number;
}) {
  if (jobs.length === 0) return null;

  const countLabel = totalCount ?? jobs.length;

  if (variant === 'rail') {
    return (
      <section
        className={cn('rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-3', className)}
      >
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-300" aria-hidden />
          <h2 className="text-[13px] font-semibold text-white">Accepted</h2>
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
            {countLabel}
          </span>
        </div>
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.jobId}>
              <button
                type="button"
                className="w-full rounded-lg border border-white/[0.08] bg-[#0C0F0F]/80 px-3 py-2 text-left transition hover:border-amber-400/25"
                onClick={() => onOpenJob(job.jobId)}
              >
                <p className="truncate text-[13px] font-medium text-white">{job.title}</p>
                <p className="truncate text-[11px] text-white/45">{job.company}</p>
              </button>
              <Button
                type="button"
                variant="ghost"
                className="mt-1.5 h-8 w-full animate-pulse gap-1.5 border border-amber-400/30 text-[11px] text-amber-100"
                onClick={() => onShareAchievement(job)}
              >
                <Share2 className="h-3 w-3" />
                Share win
              </Button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className={cn('rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-4 sm:p-5', className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" aria-hidden />
          <h2 className="text-[15px] font-semibold text-white">Accepted offers</h2>
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            {countLabel}
          </span>
        </div>
        {viewAllHref && (totalCount ?? jobs.length) > jobs.length ? (
          <Link
            href={viewAllHref}
            className="text-[12px] font-medium text-[#00C9B1] hover:underline"
          >
            View all ({totalCount ?? jobs.length})
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {jobs.map((job) => (
          <article
            key={job.jobId}
            className="rounded-xl border border-white/[0.08] bg-[#0C0F0F]/80 p-4"
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onOpenJob(job.jobId)}
            >
              <p className="text-[14px] font-semibold text-white">{job.title}</p>
              <p className="mt-0.5 text-[13px] text-white/50">{job.company}</p>
              {job.acceptedAt ? (
                <p className="mt-2 text-[11px] text-white/40">
                  Accepted{' '}
                  {new Date(job.acceptedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              ) : null}
            </button>
            {job.badge ? (
              <span className="mt-2 inline-flex rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                {job.badge.title}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="mt-3 h-9 w-full gap-2 border border-white/12 text-[12px] text-white/75"
              onClick={() => onShareAchievement(job)}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share achievement
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
