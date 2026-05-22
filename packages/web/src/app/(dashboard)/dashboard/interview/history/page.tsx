'use client';

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { InterviewAvatar } from '@/components/interview/InterviewAvatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useInterviewPrepProgress } from '@/hooks/useInterviewPrep';
import { useInterviewSessions, useRetryInterviewEvaluation } from '@/hooks/useInterviews';
import type { InterviewSession } from '@/lib/api';
import type { InterviewEvaluationPollState } from '@/lib/interviewEvaluationPoll';
import {
  scoreFromProgressTrendPoint,
  scoreFromSessionWithCachedResult,
} from '@/lib/interviewDisplayScore';
import { WEAKNESS_TAG_LABELS } from '@/lib/interview-prep-types';
import { PERSONALITIES } from '@/lib/interviewPersonalities';
import { cn } from '@/lib/utils';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadgeClass(status: string): string {
  if (status === 'completed') return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200';
  if (status === 'in_progress') return 'border-sky-400/35 bg-sky-500/15 text-sky-200';
  if (status === 'abandoned') return 'border-white/15 bg-white/[0.06] text-white/45';
  return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200';
  if (score >= 50) return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
  return 'border-sky-400/35 bg-sky-500/12 text-sky-200';
}

function modeLabel(session: InterviewSession): string {
  if (session.interviewMode === 'job_based') return 'Job-based';
  if (session.interviewMode === 'role_based') return 'Role-based';
  return session.interviewType;
}

function InterviewHistoryRowActions({ row }: { row: InterviewSession }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const retryEvaluation = useRetryInterviewEvaluation(row.id);

  if (row.status === 'evaluation_failed') {
    return (
      <>
        <Button variant="ghost" onClick={() => router.push(`/dashboard/interview/${row.id}`)}>
          Open session
        </Button>
        <Button
          variant="primary"
          disabled={retryEvaluation.isPending}
          onClick={() =>
            retryEvaluation.mutate(undefined, {
              onSuccess: () => {
                void queryClient.invalidateQueries({ queryKey: ['interview-sessions'] });
                void queryClient.invalidateQueries({ queryKey: ['interview-session', row.id], exact: true });
                void queryClient.invalidateQueries({ queryKey: ['interview-result', row.id] });
                router.push(`/dashboard/interview/${row.id}`);
              },
            })
          }
        >
          {retryEvaluation.isPending ? 'Retrying…' : 'Retry scoring'}
        </Button>
      </>
    );
  }

  return null;
}

export default function InterviewHistoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionsQ = useInterviewSessions();
  const progressQ = useInterviewPrepProgress();
  const rows = sessionsQ.data ?? [];

  const progressScoreBySessionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of progressQ.data?.sessions ?? []) {
      const score = scoreFromProgressTrendPoint(p);
      if (score != null) map.set(p.sessionId, score);
    }
    return map;
  }, [progressQ.data?.sessions]);

  const improvementBySessionId = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const out = new Map<string, number | null>();
    let prev: number | null = null;
    for (const row of sorted) {
      const cachedPoll = queryClient.getQueryData<InterviewEvaluationPollState>([
        'interview-result',
        row.id,
      ]);
      const score = scoreFromSessionWithCachedResult(row, {
        cachedPoll,
        progressScore: progressScoreBySessionId.get(row.id) ?? null,
      });
      if (score != null && prev != null) {
        out.set(row.id, Math.round(score - prev));
      } else {
        out.set(row.id, null);
      }
      if (score != null) prev = score;
    }
    return out;
  }, [rows, progressScoreBySessionId, queryClient]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#0C0F0F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Interview History</h1>
            <p className="text-sm text-white/55">All your practice sessions</p>
          </div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/interview')}>
            ← Back to Interview Prep
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0C0F0F] p-5">
        {sessionsQ.isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-lg font-semibold text-white">No interview sessions yet.</p>
            <Button className="mt-5" onClick={() => router.push('/dashboard/interview')}>
              Start Practice
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const personality = PERSONALITIES[row.personality];
              const cachedPoll = queryClient.getQueryData<InterviewEvaluationPollState>([
                'interview-result',
                row.id,
              ]);
              const score = scoreFromSessionWithCachedResult(row, {
                cachedPoll,
                progressScore: progressScoreBySessionId.get(row.id) ?? null,
              });
              const delta = improvementBySessionId.get(row.id);
              const weaknessTags = row.weaknessSnapshot?.weaknesses?.slice(0, 2) ?? [];

              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/interview/${row.id}`)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <InterviewAvatar personality={row.personality} isSpeaking={false} isListening={false} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{personality.name}</p>
                        <Badge variant="muted">{modeLabel(row)}</Badge>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                            statusBadgeClass(row.status),
                          )}
                        >
                          {row.status.replace('_', ' ')}
                        </span>
                        {score != null && row.status === 'completed' ? (
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                              scoreBadgeClass(score),
                            )}
                          >
                            {score}%
                          </span>
                        ) : null}
                        {delta != null && row.status === 'completed' ? (
                          <span
                            className={cn(
                              'text-[11px] font-semibold tabular-nums',
                              delta >= 0 ? 'text-emerald-300' : 'text-amber-200',
                            )}
                          >
                            {delta >= 0 ? '+' : ''}
                            {delta} vs last
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-white/85">
                        {row.jobTitle || row.roleTitle || 'Practice session'}
                      </p>
                      {weaknessTags.length > 0 ? (
                        <p className="mt-1 text-xs text-white/45">
                          Focus:{' '}
                          {weaknessTags
                            .map((w) => WEAKNESS_TAG_LABELS[w.tag] ?? w.tag.replace(/_/g, ' '))
                            .join(' · ')}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-white/40">{formatDate(row.createdAt)}</p>
                    </div>
                  </button>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {row.status === 'in_progress' ? (
                      <Button variant="ghost" onClick={() => router.push(`/dashboard/interview/${row.id}`)}>
                        Resume
                      </Button>
                    ) : null}
                    {row.status === 'completed' ? (
                      <Button variant="ghost" onClick={() => router.push(`/dashboard/interview/${row.id}`)}>
                        View results
                      </Button>
                    ) : null}
                    <InterviewHistoryRowActions row={row} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
