'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TrackedJob } from '@/app/(dashboard)/dashboard/jobs/jobHubMerge';
import {
  hasLegacyJobHubStorage,
  isJobHubMigrationComplete,
  runJobHubLegacyMigration,
} from '@/lib/jobHubLegacyMigration';

export function useJobHubLegacyMigration(jobs: TrackedJob[], enabled: boolean) {
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const [migrationFailed, setMigrationFailed] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const run = useCallback(async () => {
    setRetrying(true);
    const result = await runJobHubLegacyMigration(jobs, queryClient);
    setRetrying(false);
    if (result.ok) {
      setMigrationFailed(null);
    } else {
      setMigrationFailed(result.message);
    }
  }, [jobs, queryClient]);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    if (isJobHubMigrationComplete() && !hasLegacyJobHubStorage()) return;
    startedRef.current = true;
    void run();
  }, [enabled, run]);

  const needsSync =
    Boolean(migrationFailed) ||
    (!isJobHubMigrationComplete() && hasLegacyJobHubStorage());

  return {
    migrationFailed,
    needsSync,
    retryMigration: run,
    retrying,
  };
}
