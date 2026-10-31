'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';

import { CreateCVProfileModal } from '@/components/dashboard/CreateCVProfileModal';
import { DashboardCvProfilesPanel } from '@/components/dashboard/DashboardCvProfilesPanel';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';

function CvProfilesPageInner() {
  const [createOpen, setCreateOpen] = useState(false);
  const {
    displayRows,
    listInconsistent,
    isBootstrapping,
    loadFailed,
    isRetrying,
    retry,
  } = useCvProfileRowsDisplay();
  const retryRef = useRef(retry);
  retryRef.current = retry;

  useEffect(() => {
    if (!loadFailed) return;
    const id = window.setInterval(() => retryRef.current(), 10_000);
    return () => window.clearInterval(id);
  }, [loadFailed]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto w-full min-w-0 max-w-3xl space-y-5 px-0"
    >
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] font-bold leading-tight text-text-primary">
            Your CVs
          </h1>
          <p className="mt-1 max-w-xl text-[15px] text-text-secondary">
            Keep one CV for each kind of job you apply for. Your default (marked
            ★) is the one we use to match you to jobs.
          </p>
        </div>
        <Button
          type="button"
          variant="accent"
          className="h-11 shrink-0 gap-1.5 px-5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New CV
        </Button>
      </div>

      {listInconsistent ? (
        <div
          role="alert"
          className="rounded-xl border border-warning-border bg-warning-subtle px-4 py-3 text-[14px] leading-relaxed text-warning-text"
        >
          We couldn&apos;t load your full list of CVs. Your CVs are safe — try
          refreshing the page, or{' '}
          <Link href="/dashboard/cv" className="font-semibold underline">
            open your CV
          </Link>
          .
        </div>
      ) : null}

      {loadFailed ? (
        <div
          role="alert"
          className="flex flex-col items-center rounded-2xl border border-border-subtle bg-bg-surface px-6 py-10 text-center"
        >
          <p className="text-[17px] font-semibold text-text-primary">
            We can&apos;t load your CVs right now
          </p>
          <p className="mt-1 max-w-sm text-[14px] text-text-secondary">
            Your CVs are safe. We&apos;ll keep trying, or you can try again now.
          </p>
          <Button
            type="button"
            variant="accent"
            className="mt-5 px-6"
            disabled={isRetrying}
            onClick={retry}
          >
            {isRetrying ? 'Trying…' : 'Try again'}
          </Button>
        </div>
      ) : (
        <DashboardCvProfilesPanel
          profiles={displayRows}
          isLoading={isBootstrapping}
          onNewCv={() => setCreateOpen(true)}
        />
      )}

      <CreateCVProfileModal open={createOpen} onOpenChange={setCreateOpen} />
    </motion.div>
  );
}

export default function CvProfilesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton height={28} width={200} borderRadius={8} />
          <Skeleton height={120} width="100%" borderRadius={12} />
        </div>
      }
    >
      <CvProfilesPageInner />
    </Suspense>
  );
}
