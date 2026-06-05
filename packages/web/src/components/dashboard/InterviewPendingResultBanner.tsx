'use client';

import { queryKeys } from '@/lib/queryKeys';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import {
  interviewResultFromPoll,
  type InterviewEvaluationPollState,
} from '@/lib/interviewEvaluationPoll';
import {
  clearInterviewPendingResult,
  listPendingInterviewResults,
  type PendingInterviewResult,
} from '@/lib/interviewPendingResult';
import { cn } from '@/lib/utils';

function PendingRow({
  item,
  onReady,
  onFailed,
}: {
  item: PendingInterviewResult;
  onReady: (sessionId: string) => void;
  onFailed: (sessionId: string) => void;
}) {
  const pollQ = useQuery({
    queryKey: queryKeys.interview.result(item.sessionId),
    queryFn: () => api.interviews.getResult(item.sessionId),
    refetchInterval: (query) => {
      const poll = query.state.data as InterviewEvaluationPollState | undefined;
      if (poll?.status === 'completed' || poll?.status === 'failed') return false;
      return 5000;
    },
    staleTime: 0,
    retry: false,
  });

  const poll = pollQ.data;
  const result = interviewResultFromPoll(poll);

  useEffect(() => {
    if (result) onReady(item.sessionId);
    if (poll?.status === 'failed') onFailed(item.sessionId);
  }, [item.sessionId, onFailed, onReady, poll?.status, result]);

  const ready = Boolean(result);
  const failed = poll?.status === 'failed';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
        ready
          ? 'border-emerald-400/30 bg-emerald-500/10'
          : failed
            ? 'border-amber-400/25 bg-amber-500/8'
            : 'border-white/[0.08] bg-white/[0.03]',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {ready ? (
          <span className="text-lg" aria-hidden>
            ✓
          </span>
        ) : (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#00C9B1]" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90">
            {ready
              ? 'Interview results are ready'
              : failed
                ? 'Interview scoring needs attention'
                : 'Scoring your interview in the background'}
          </p>
          <p className="mt-0.5 truncate text-xs text-white/45">
            {item.label?.trim() || 'Practice session'}
          </p>
          {failed && poll?.status === 'failed' ? (
            <p className="mt-1 text-[11px] text-amber-100/85">{poll.message}</p>
          ) : null}
        </div>
      </div>
      {ready ? (
        <Link
          href={`/dashboard/interview/${item.sessionId}`}
          className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 text-[13px] font-semibold text-[#00C9B1] hover:bg-[#00C9B1] hover:text-[#080A0A]"
        >
          View results →
        </Link>
      ) : failed ? (
        <Link
          href={`/dashboard/interview/${item.sessionId}`}
          className="text-xs font-medium text-amber-100/90 underline-offset-2 hover:underline"
        >
          Open session
        </Link>
      ) : (
        <span className="text-[11px] text-white/35">Usually 1–3 min</span>
      )}
    </div>
  );
}

/** Polls sessions the user left while scoring; surfaces a CTA when results land. */
export function InterviewPendingResultBanner({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<PendingInterviewResult[]>([]);

  useEffect(() => {
    setItems(listPendingInterviewResults());
    const onStorage = () => setItems(listPendingInterviewResults());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const visible = useMemo(() => items.slice(0, 3), [items]);

  if (visible.length === 0) return null;

  const handleReady = (sessionId: string) => {
    clearInterviewPendingResult(sessionId);
    setItems(listPendingInterviewResults());
    void queryClient.invalidateQueries({ queryKey: queryKeys.interview.sessions() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.interview.session(sessionId), exact: true });
  };

  const handleFailed = (sessionId: string) => {
    clearInterviewPendingResult(sessionId);
    setItems(listPendingInterviewResults());
  };

  return (
    <section
      className={cn('space-y-2', className)}
      aria-label="Interview results in progress"
    >
      {visible.map((item) => (
        <PendingRow
          key={item.sessionId}
          item={item}
          onReady={handleReady}
          onFailed={handleFailed}
        />
      ))}
    </section>
  );
}
