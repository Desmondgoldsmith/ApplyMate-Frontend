'use client';

import type React from 'react';
import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

import { insightKindLabel } from '@/components/dashboard/assistant-voice/insightVoice';
import type { InformationalSurfaceView } from '@/lib/dashboardViewModel';
import { cn } from '@/lib/utils';

import { confidenceBandFromScore, isRecoveryVisualMode } from '@/components/dashboard/experience-renderer/experienceGrammar';

function aggregateSurfaceConfidence(s: InformationalSurfaceView): number | null {
  const c = s.confidence;
  if (!c) return null;
  const vals = [
    c.recommendationConfidence,
    c.routingConfidence,
    c.workflowConfidence,
    c.continuityConfidence,
  ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

type Variant = 'coaching' | 'analytics' | 'encouragement' | 'momentum' | 'recovery' | 'generic';

function inferVariant(s: InformationalSurfaceView): Variant {
  const k = String(s.insightCategory ?? s.category ?? '').trim().toLowerCase();
  if (k.includes('coach')) return 'coaching';
  if (k.includes('analytic') || k === 'pipeline') return 'analytics';
  if (k.includes('encourag') || k.includes('celebrat')) return 'encouragement';
  if (k.includes('momentum') || k.includes('direction')) return 'momentum';
  if (k.includes('recovery') || k.includes('burnout') || k.includes('fatigue')) return 'recovery';
  return 'generic';
}

function nudgeShell(variant: Variant, tone: 'quiet' | 'normal', recoveryVisual: boolean, density: 'sparse' | 'normal' | 'rich'): string {
  const pad = density === 'sparse' ? 'p-5 sm:p-6' : 'p-4 sm:p-5';
  const base = cn('rounded-2xl border transition-colors duration-500 ease-out', pad);
  if (recoveryVisual) {
    return cn(base, 'border-white/[0.05] bg-white/[0.018]');
  }
  if (variant === 'recovery') {
    return cn(base, 'border-white/[0.06] bg-gradient-to-b from-sky-950/25 to-transparent');
  }
  if (variant === 'encouragement') {
    return cn(base, 'border-amber-400/12 bg-gradient-to-b from-amber-950/20 to-transparent');
  }
  if (variant === 'momentum') {
    return cn(base, 'border-[#00C9B1]/12 bg-gradient-to-b from-[#00C9B1]/[0.06] to-transparent');
  }
  if (variant === 'analytics') {
    return cn(base, tone === 'quiet' ? 'border-white/[0.05] bg-[#0a0e0e]' : 'border-white/[0.07] bg-white/[0.025]');
  }
  if (variant === 'coaching') {
    return cn(base, 'border-violet-400/12 bg-violet-950/15');
  }
  return cn(base, tone === 'quiet' ? 'border-white/[0.05] bg-white/[0.02]' : 'border-white/[0.07] bg-white/[0.03]');
}

export function InsightRenderer({
  surface,
  mode,
  fatigueAdjusted,
  insightDensity = 'normal',
  onDismiss,
}: {
  surface: InformationalSurfaceView;
  mode?: string | null;
  fatigueAdjusted?: boolean | null;
  insightDensity?: 'sparse' | 'normal' | 'rich';
  onDismiss?: () => void;
}) {
  const variant = inferVariant(surface);
  const confidence = aggregateSurfaceConfidence(surface);
  const band = confidenceBandFromScore(confidence);
  const tone: 'quiet' | 'normal' =
    surface.visualWeight === 'quiet' || band === 'low' ? 'quiet' : 'normal';
  const recoveryVisual = isRecoveryVisualMode(mode ?? null, fatigueAdjusted ?? null);

  const kind = insightKindLabel(surface.category, surface.insightCategory);
  const title = surface.headline?.trim() || null;
  const body = surface.body?.trim() || null;
  const disc = surface.disclosure;

  const [open, setOpen] = useState(false);

  if (!title && !body) return null;

  const hasMore =
    Boolean(disc?.reasoning) ||
    Boolean(disc?.whyChanged) ||
    Boolean(disc?.sinceYesterday) ||
    Boolean(disc?.memoryMicrocopy);

  return (
    <div className={nudgeShell(variant, tone, recoveryVisual, insightDensity)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {kind ? (
            <p className="text-[11px] font-medium text-[#9CF5EA]/55">{kind}</p>
          ) : null}
          {title ? (
            <p className={cn('mt-1 text-[15px] font-medium leading-snug text-white/88')}>{title}</p>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white/65"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {disc?.memoryMicrocopy ? (
        <p className="mt-3 text-[12px] leading-relaxed text-white/48">{disc.memoryMicrocopy}</p>
      ) : null}
      {body ? (
        <p className={cn('mt-3 text-[13px] leading-relaxed', band === 'low' ? 'text-white/45' : 'text-white/55')}>
          {body}
        </p>
      ) : null}

      {hasMore ? (
        <div className="mt-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#9CF5EA]/55 transition-colors hover:text-[#9CF5EA]/85"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Tell me more
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', open && 'rotate-180')} aria-hidden />
          </button>
          {open ? (
            <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-white/48">
              {disc?.whyChanged ? <p>{disc.whyChanged}</p> : null}
              {disc?.sinceYesterday ? <p>{disc.sinceYesterday}</p> : null}
              {disc?.reasoning ? <p>{disc.reasoning}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
