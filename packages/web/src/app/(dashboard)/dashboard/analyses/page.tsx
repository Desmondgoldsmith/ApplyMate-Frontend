'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApplicationRow } from '@/components/dashboard/ApplicationRow';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { JOB_HISTORY_PAGE_SIZE, useJobHistoryPage } from '@/hooks/useJobHistory';

export default function AnalysesPage() {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const history = useJobHistoryPage(pageIndex, JOB_HISTORY_PAGE_SIZE);
  const items = history.data?.items ?? [];
  const total = history.data?.total ?? 0;
  const limit = history.data?.limit ?? JOB_HISTORY_PAGE_SIZE;
  const offset = history.data?.offset ?? pageIndex * limit;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    if (!history.isLoading && total > 0) {
      const maxPage = Math.max(0, totalPages - 1);
      if (pageIndex > maxPage) setPageIndex(maxPage);
    }
  }, [history.isLoading, total, totalPages, pageIndex]);

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = offset + items.length;
  const showPager = total > limit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white">Job analyses</h2>
          <p className="text-sm text-white/50">
            Every successful analysis is listed here (newest first). Use Analyze to run a new analysis or generate a
            cover letter.
          </p>
        </div>
        <Link
          href="/dashboard/jobs/analyze"
          className="inline-flex items-center justify-center rounded-xl bg-[#00C9B1] px-4 py-2.5 text-sm font-semibold text-[#080A0A] transition hover:bg-[#00C9B1]"
        >
          Analyze a job
        </Link>
      </div>

      <GlowCard contentClassName="p-5">
        {history.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={56} borderRadius={12} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-white/60">No analyses yet.</p>
            <Link
              href="/dashboard/jobs/analyze"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#00C9B1] px-4 py-2.5 text-sm font-semibold text-[#080A0A] transition hover:bg-[#00C9B1]"
            >
              Analyze your first job
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full cursor-pointer text-left transition hover:opacity-90"
                    onClick={() => {
                      const qs = new URLSearchParams({ jobId: item.id });
                      const jl = item.jobListingId?.trim();
                      if (jl) qs.set('jobListingId', jl);
                      router.push(`/dashboard/jobs/analyze?${qs.toString()}`);
                    }}
                  >
                  <ApplicationRow
                    company={item.company ?? 'Unknown company'}
                    title={item.jobTitle || item.title || 'Untitled role'}
                    matchScore={item.matchScore ?? 0}
                    date={item.createdAt}
                  />
                  </button>
                </li>
              ))}
            </ul>
            {showPager ? (
              <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/50">
                  Showing {rangeStart}–{rangeEnd} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pageIndex <= 0 || history.isFetching}
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pageIndex >= totalPages - 1 || history.isFetching}
                    onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : total > 0 ? (
              <p className="border-t border-white/10 pt-4 text-sm text-white/50">
                {total} {total === 1 ? 'analysis' : 'analyses'}
              </p>
            ) : null}
          </div>
        )}
      </GlowCard>
    </motion.div>
  );
}
