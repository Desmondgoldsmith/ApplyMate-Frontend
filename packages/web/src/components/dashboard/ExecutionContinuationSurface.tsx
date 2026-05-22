'use client';

import Link from 'next/link';
import { ChevronRight, Clock3, CornerDownRight } from 'lucide-react';

import type { DashboardContinuationView } from '@/lib/dashboardViewModel';
import { cn } from '@/lib/utils';
import { ExecutionTimeline } from '@/components/dashboard/ExecutionTimeline';

function clampPct(pct: number | null | undefined): number | null {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function formatHoursAgo(hours: number | null | undefined): string | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.max(1, Math.round(hours / 24));
  return `${days}d ago`;
}

function confidenceBand(value: number | null | undefined): 'low' | 'med' | 'high' | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value >= 80) return 'high';
  if (value >= 60) return 'med';
  return 'low';
}

function ConfidenceChip({ value }: { value: number | null | undefined }) {
  const band = confidenceBand(value);
  if (!band) return null;
  const label = band === 'high' ? 'High continuity' : band === 'med' ? 'Moderate continuity' : 'Low continuity';
  const cls =
    band === 'high'
      ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
      : band === 'med'
        ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
        : 'border-white/12 bg-white/[0.05] text-white/50';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]', cls)}>
      {label}
    </span>
  );
}

function WorkflowProgressCard({ continuation }: { continuation: DashboardContinuationView }) {
  const pct = clampPct(continuation.percentComplete);
  const remainingSteps =
    typeof continuation.remainingSteps === 'number' && Number.isFinite(continuation.remainingSteps)
      ? Math.max(0, Math.round(continuation.remainingSteps))
      : null;
  const minutes =
    typeof continuation.minutes === 'number' && Number.isFinite(continuation.minutes) ? Math.max(1, Math.round(continuation.minutes)) : null;
  const stage = continuation.continuationContext?.taskLabel?.trim() || null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">Progress</p>
        <ConfidenceChip value={continuation.resumeConfidence} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="text-[10px] text-white/40">Completion</p>
          <p className="mt-1 text-[16px] font-semibold text-white">{pct != null ? `${pct}%` : '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="text-[10px] text-white/40">Steps left</p>
          <p className="mt-1 text-[16px] font-semibold text-white">{remainingSteps != null ? remainingSteps : '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="text-[10px] text-white/40">Time left</p>
          <p className="mt-1 text-[16px] font-semibold text-white">{minutes != null ? `~${minutes}m` : '—'}</p>
        </div>
      </div>
      {stage ? <p className="mt-2 text-[12px] text-white/55">Stage: {stage}</p> : null}
    </div>
  );
}

// ExecutionTimeline extracted to `ExecutionTimeline.tsx`

function ResumeContextPanel({ continuation }: { continuation: DashboardContinuationView }) {
  const lastWorked = formatHoursAgo(continuation.interruptionAgeHours);
  const detail =
    continuation.continuationContext?.detailedSummary?.trim() ||
    continuation.subtitle?.trim() ||
    continuation.continuationContext?.taskLabel?.trim() ||
    null;
  if (!lastWorked && !detail) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">Resume context</p>
      <div className="mt-2 space-y-1.5 text-[12px] text-white/55">
        {lastWorked ? (
          <p className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 text-white/35" aria-hidden />
            Last worked: <span className="text-white/75">{lastWorked}</span>
          </p>
        ) : null}
        {detail ? (
          <p className="leading-relaxed">
            <CornerDownRight className="mr-1 inline h-3.5 w-3.5 text-white/35" aria-hidden />
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ExecutionContinuationSurface({
  continuation,
  onClick,
}: {
  continuation: DashboardContinuationView;
  onClick?: () => void;
}) {
  const title = continuation.title.trim();
  if (!title) return null;
  const ctaLabel = continuation.ctaLabel?.trim() || 'Continue';
  const role = continuation.jobRoleTitle?.trim() || null;
  const company = continuation.jobCompanyName?.trim() || null;
  const jobLine =
    role && company ? `${role} · ${company}` : role || company || null;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Execution session</p>
          <p className="mt-2 text-[16px] font-semibold leading-snug text-white/92">{title}</p>
          {jobLine ? (
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/70">{jobLine}</p>
          ) : null}
          {continuation.subtitle?.trim() ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{continuation.subtitle.trim()}</p>
          ) : null}
        </div>
        {continuation.showPrimaryCta && continuation.href ? (
          <div className="shrink-0">
            <Link
              href={continuation.href}
              onClick={onClick}
              className={cn(
                'inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                'border-[#00C9B1]/45 text-[#00C9B1] hover:bg-[#00C9B1] hover:text-[#080A0A]',
              )}
            >
              {ctaLabel}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ExecutionTimeline continuation={continuation} />
        <WorkflowProgressCard continuation={continuation} />
        <ResumeContextPanel continuation={continuation} />
      </div>
    </section>
  );
}

