'use client';

import Link from 'next/link';
import { ChevronRight, CornerDownRight } from 'lucide-react';

import { continuationEyebrowLabel } from '@/components/dashboard/assistant-voice';
import type { DashboardContinuationView } from '@/lib/dashboardViewModel';
import { cn } from '@/lib/utils';
import { ExecutionTimeline } from '@/components/dashboard/ExecutionTimeline';

function clampPct(pct: number | null | undefined): number | null {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function humanLastVisit(hours: number | null | undefined): string | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 1) return 'You were just here.';
  if (hours < 24) return `You paused ${Math.round(hours)} hours ago.`;
  const days = Math.max(1, Math.round(hours / 24));
  return days === 1 ? 'You paused yesterday.' : `You paused ${days} days ago.`;
}

function progressSummary(continuation: DashboardContinuationView): string | null {
  const idx = continuation.continuationContext?.exactStepIndex;
  const total = continuation.continuationContext?.totalSteps;
  const pct = clampPct(continuation.percentComplete ?? continuation.continuationContext?.completionPercent ?? null);
  const roleOnly = continuation.jobRoleTitle?.trim();
  if (pct === 0) {
    return roleOnly
      ? `Pick up your interview prep for ${roleOnly} — you started this session.`
      : 'You just started this session.';
  }
  if (pct != null && pct < 10) return 'Everything is ready to continue.';
  if (typeof idx === 'number' && Number.isFinite(idx) && typeof total === 'number' && Number.isFinite(total) && total > 0) {
    const current = Math.min(total, Math.max(1, idx + 1));
    const base = `${current} of ${total} steps along`;
    return pct != null ? `${base} — roughly ${pct}% through.` : `${base}.`;
  }
  if (pct != null) return `Roughly ${pct}% through — worth finishing while it’s fresh.`;
  return null;
}

export function ExecutionWorkspaceCard({
  continuation,
  onClick,
  memoryMicrocopy,
  resumeCtaClassName,
}: {
  continuation: DashboardContinuationView;
  onClick?: () => void;
  memoryMicrocopy?: string | null;
  resumeCtaClassName?: string;
}) {
  const title = continuation.title.trim();
  if (!title) return null;

  const sectionEyebrow = continuationEyebrowLabel(title);
  const step = continuation.continuationContext?.exactStepLabel?.trim() || null;
  const last = humanLastVisit(continuation.interruptionAgeHours);
  const progress = progressSummary(continuation);
  const ctaRaw = continuation.ctaLabel?.trim() || '';
  const ctaLabel =
    /continue interview preparation/i.test(ctaRaw) || /^continue$/i.test(ctaRaw)
      ? 'Continue prep →'
      : ctaRaw || 'Continue prep →';
  const role = continuation.jobRoleTitle?.trim() || null;
  const company = continuation.jobCompanyName?.trim() || null;
  const jobLine =
    role && company ? `${role} · ${company}` : role || company || null;

  return (
    <section className="rounded-2xl border border-[rgba(0,201,177,0.18)] bg-gradient-to-br from-[rgba(0,201,177,0.06)] to-[rgba(0,201,177,0.02)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-[#9CF5EA]/70">{sectionEyebrow}</p>
          <p className="mt-2 text-[17px] font-semibold leading-snug text-white">{title}</p>
          {jobLine ? (
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/72">{jobLine}</p>
          ) : null}
          {step ? (
            <p className="mt-2 text-[14px] leading-relaxed text-white/65">
              <CornerDownRight className="mr-1 inline h-3.5 w-3.5 text-white/35" aria-hidden />
              {step}
            </p>
          ) : continuation.subtitle?.trim() ? (
            <p className="mt-2 text-[14px] leading-relaxed text-white/58">{continuation.subtitle.trim()}</p>
          ) : null}
          {memoryMicrocopy?.trim() ? (
            <p className="mt-3 text-[12px] leading-relaxed text-[#9CF5EA]/65">{memoryMicrocopy.trim()}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-white/42">
            {progress ? <span>{progress}</span> : null}
            {progress && last ? <span className="text-white/20">·</span> : null}
            {last ? <span>{last}</span> : null}
          </div>
        </div>

        {continuation.showPrimaryCta && continuation.href ? (
          <div className="shrink-0">
            <Link
              href={continuation.href}
              onClick={onClick}
              className={cn(
                'inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                resumeCtaClassName ??
                  'border-[#00C9B1]/50 bg-[#00C9B1]/10 text-[#B8F5EC] hover:bg-[#00C9B1] hover:text-[#080A0A]',
              )}
            >
              {ctaLabel.endsWith('→') ? ctaLabel : (
                <>
                  {ctaLabel}
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </>
              )}
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <ExecutionTimeline continuation={continuation} />
      </div>
    </section>
  );
}
