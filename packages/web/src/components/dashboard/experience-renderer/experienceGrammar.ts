import type { ExperienceStabilityPayload, TodayPlanPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

/** Backend guarantees hero narrative may render without churning on hydration/refetch. */
export function experienceStableForHero(st: ExperienceStabilityPayload | null | undefined): boolean {
  if (st == null) return true;
  if (st.stable === true) return true;
  if (st.stable === false) return false;
  return st.experienceReady === true;
}

/** Phase 3: prefer `experienceState.stable` when present; else legacy `experienceStability`. */
export function planStableForHero(plan: TodayPlanPayload | null | undefined): boolean {
  const es = plan?.experienceState;
  if (es?.stable === false) return false;
  if (es?.stable === true) return true;
  return experienceStableForHero(plan?.experienceStability ?? null);
}

export type ConfidenceBand = 'high' | 'med' | 'low';

export function confidenceBandFromScore(value: number | null | undefined): ConfidenceBand | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value >= 80) return 'high';
  if (value >= 55) return 'med';
  return 'low';
}

export function modeShellClass(mode: string | null): string {
  const m = (mode ?? '').trim().toUpperCase();
  if (m.includes('INTERVIEW')) {
    return '[--exp-accent:#00C9B1] [--exp-border:rgba(0,201,177,0.18)]';
  }
  if (m.includes('RECOVERY')) {
    return '[--exp-accent:rgba(156,245,234,0.55)] [--exp-border:rgba(255,255,255,0.06)]';
  }
  if (m.includes('SPRINT') || m.includes('APPLICATION')) {
    return '[--exp-accent:#9CF5EA] [--exp-border:rgba(0,201,177,0.22)]';
  }
  return '';
}

export function modeSectionSpacingClass(mode: string | null): string {
  const m = (mode ?? '').trim().toUpperCase();
  if (m.includes('INTERVIEW')) return 'gap-6';
  if (m.includes('RECOVERY')) return 'gap-9';
  if (m.includes('SPRINT') || m.includes('APPLICATION')) return 'gap-6';
  return 'gap-8';
}

export function isRecoveryVisualMode(mode: string | null, fatigueAdjusted: boolean | null): boolean {
  const m = (mode ?? '').trim().toUpperCase();
  if (m.includes('RECOVERY')) return true;
  return fatigueAdjusted === true;
}

/** Quiet reassurance tied to interruption timing — avoid stacking noisy phrases. */
export function continuationMemoryMicrocopy(interruptionAgeHours: number | null | undefined): string | null {
  if (typeof interruptionAgeHours !== 'number' || !Number.isFinite(interruptionAgeHours)) return null;
  if (interruptionAgeHours >= 18 && interruptionAgeHours <= 40) return 'You paused here yesterday.';
  if (interruptionAgeHours >= 48 && interruptionAgeHours < 96) return 'Easy to pick this back up when you’re ready.';
  return null;
}

export function continuationResumeCtaClass(resumeConfidence: number | null | undefined): string {
  const band = confidenceBandFromScore(resumeConfidence);
  const base =
    'inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors';
  if (band === 'low') {
    return cn(
      base,
      'border-white/22 bg-white/[0.05] text-[#C9F7EF]/90 hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/14 hover:text-white',
    );
  }
  if (band === 'med') {
    return cn(
      base,
      'border-[#00C9B1]/40 bg-[#00C9B1]/08 text-[#9CF5EA] hover:bg-[#00C9B1] hover:text-[#080A0A]',
    );
  }
  return cn(
    base,
    'border-[#00C9B1]/55 bg-[#00C9B1]/10 text-[#9CF5EA] hover:bg-[#00C9B1] hover:text-[#080A0A]',
  );
}

export function heroPrimaryCtaClass(params: {
  emotionalTone: string | null;
  confidenceBand: ConfidenceBand | null;
  recoveryVisual: boolean;
}): string {
  /** Matches legacy orchestrated hero CTAs (e.g. “Analyze a job”) — teal outline, no fill. */
  const base =
    'inline-flex min-h-[44px] min-w-[10.5rem] items-center justify-center rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors';
  if (params.recoveryVisual) {
    return cn(
      base,
      'border-white/18 bg-white/[0.05] text-[#C9F7EF]/90 hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/12 hover:text-white',
    );
  }
  return cn(
    base,
    'border-[#00C9B1]/45 bg-transparent text-[#00C9B1] hover:bg-[#00C9B1] hover:text-[#080A0A]',
  );
}
