import type {
  ApplyAssistReadyState,
  MomentumType,
  PriorityState,
  UnifiedPriorityItem,
  WorkflowState,
} from '@/lib/today-plan';
import { isAppliedOrLaterState } from '@/lib/today-plan';

/** Badge label for Phase 4.1 `workflowState` (server-authoritative lifecycle). */
export function labelForWorkflowState(state: WorkflowState | null | undefined): string | null {
  if (state == null || state === '') return null;
  const s = String(state).toLowerCase().trim();
  switch (s) {
    case 'onboarding':
      return 'Onboarding';
    case 'discovery':
      return 'Discovery';
    case 'analyzed':
      return 'Analyzed';
    case 'applying':
      return 'Applying';
    case 'applied':
      return 'Applied';
    case 'followup':
      return 'Follow-up';
    case 'interviewing':
      return 'Interviewing';
    case 'offer':
      return 'Offer';
    case 'archived':
      return 'Archived';
    case 'stale':
      return 'Stale';
    default:
      return s
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

/** Short, human labels for `readyState` (backend enum). */
export function labelForReadyState(state: ApplyAssistReadyState | null | undefined): string | null {
  if (!state) return null;
  const s = String(state).toLowerCase().trim();
  switch (s) {
    case 'ready':
      return 'Ready to go';
    case 'needs_cv_tailoring':
      return 'Needs CV tailoring first';
    case 'needs_contact_details':
      return 'Add contact details';
    case 'needs_portfolio_link':
      return 'Add a portfolio link';
    case 'needs_analysis_review':
      return 'Review your analysis first';
    case 'blocked':
      return 'Waiting on something else';
    default:
      return null;
  }
}

export type EffortBand = 'instant' | 'light' | 'heavy' | 'blocked';

/** Derive a single effort/readiness band from friction + ready state (no hype). */
export function inferEffortBand(item: UnifiedPriorityItem): EffortBand {
  const ready = String(item.applyAssist?.readyState ?? '').toLowerCase();
  if (ready === 'blocked') return 'blocked';
  const friction = item.applyAssist?.frictionScore;
  if (typeof friction === 'number' && friction >= 70) return 'heavy';
  if (typeof friction === 'number' && friction >= 40) return 'light';
  if (ready && ready !== 'ready') return 'heavy';
  if (item.applyAssist?.fastPathEligible && (friction == null || friction < 40)) return 'instant';
  return 'light';
}

export function labelForEffortBand(band: EffortBand): string {
  switch (band) {
    case 'instant':
      return 'Quick step';
    case 'light':
      return 'Medium effort';
    case 'heavy':
      return 'Needs prep';
    case 'blocked':
      return 'Blocked for now';
    default:
      return 'Next step';
  }
}

/** Single line for match strength (outcome-oriented, not hype). */
export function formatConfidenceShort(score: number | null): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  if (score >= 40) return 'Fair match';
  return 'Worth a look';
}

export function formatImpactShort(level: 'low' | 'medium' | 'high' | null): string | null {
  if (!level) return null;
  if (level === 'high') return 'High impact if you do it now';
  if (level === 'medium') return 'Solid impact';
  return 'Small win';
}

/** Human-readable pause duration for continuation copy. */
export function formatInterruptionAge(hours: number | null | undefined): string | null {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours < 1) return 'You paused this recently';
  if (hours < 24) return `You paused this about ${Math.max(1, Math.round(hours))} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'You paused this yesterday';
  return `You paused this about ${days} days ago`;
}

/** Join blockers for one readable line (progressive disclosure via tooltip elsewhere). */
export function formatBlockersPreview(blockers: string[], max = 2): string | null {
  const cleaned = blockers.map((b) => b.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  if (cleaned.length <= max) return cleaned.join(', ');
  const head = cleaned.slice(0, max).join(', ');
  return `${head}, +${cleaned.length - max} more`;
}

/** Short lane label for priority chrome (Phase 2A `priorityState`). */
export function laneLabelForPriorityState(state: PriorityState | null | undefined): string | null {
  if (!state) return null;
  switch (state) {
    case 'quick_win':
      return 'Quick win';
    case 'ready_now':
      return 'Ready now';
    case 'continuation':
      return 'Pick up where you left off';
    case 'blocked':
      return 'Blocked';
    case 'high_impact':
      return 'High impact';
    case 'waiting':
      return 'Waiting';
    case 'follow_up':
      return 'Follow up';
    default:
      return null;
  }
}

/** Card shell accents — prefer over generic urgency styling when `priorityState` is set. */
export function shellAccentClassesForPriorityState(state: PriorityState | null | undefined): string {
  if (!state) return '';
  switch (state) {
    case 'quick_win':
      return 'border-emerald-400/18 bg-emerald-500/[0.045]';
    case 'continuation':
      return 'border-[#00C9B1]/42 bg-[#00C9B1]/[0.08]';
    case 'blocked':
      return 'border-amber-500/28 bg-amber-950/[0.18]';
    case 'high_impact':
      return 'border-[#00C9B1]/30 bg-white/[0.055]';
    case 'waiting':
      return 'border-white/[0.07] bg-white/[0.025] opacity-[0.93]';
    case 'follow_up':
      return 'border-violet-400/22 bg-violet-950/[0.14]';
    case 'ready_now':
    default:
      return 'border-white/[0.10] bg-white/[0.038]';
  }
}

export function laneChipClassesForPriorityState(state: PriorityState | null | undefined): string {
  if (!state) return '';
  switch (state) {
    case 'quick_win':
      return 'border-emerald-400/40 bg-emerald-500/14 text-emerald-100';
    case 'continuation':
      return 'border-[#00C9B1]/50 bg-[#00C9B1]/16 text-[#7EF4E6]';
    case 'blocked':
      return 'border-amber-400/35 bg-amber-500/14 text-amber-100';
    case 'high_impact':
      return 'border-[#00C9B1]/40 bg-[#00C9B1]/12 text-[#B8FFF5]';
    case 'waiting':
      return 'border-white/16 bg-white/[0.07] text-white/55';
    case 'follow_up':
      return 'border-violet-400/35 bg-violet-500/12 text-violet-100';
    case 'ready_now':
    default:
      return 'border-white/18 bg-white/[0.08] text-white/72';
  }
}

/** Hero subtext tint from `momentumType` (presentation only). */
export function subtextClassForMomentumType(t: MomentumType | null | undefined): string {
  switch (t) {
    case 'recovery':
      return 'text-amber-100/78';
    case 'continuation':
      return 'text-[#9CF5EA]/88';
    case 'quick_win':
      return 'text-white/52';
    case 'confidence':
      return 'text-[#B8FFF5]/84';
    case 'progress':
    default:
      return 'text-white/50';
  }
}

/** Right-rail job history scan cue when unified `priorityState` is unavailable. */
export function scanLabelForJobHistoryRow(item: {
  matchScore?: number | null;
  hasCoverLetter?: boolean | null;
  isTailored?: boolean | null;
  state?: string | null;
  isApplied?: boolean | null;
  pipelineStatus?: string | null;
}): { label: string; tone: 'accent' | 'passive' | 'warn' } {
  const pipeline = String(item.pipelineStatus ?? '')
    .trim()
    .toLowerCase();
  if (pipeline === 'interviewing') return { label: 'Interviewing', tone: 'accent' };
  if (pipeline === 'offered') return { label: 'Offer stage', tone: 'accent' };
  if (pipeline === 'rejected') return { label: 'Not moving forward', tone: 'passive' };
  if (pipeline === 'applied') return { label: 'Applied', tone: 'passive' };

  const state = String(item.state ?? '')
    .trim()
    .toLowerCase();
  if (state === 'interviewing' || state === 'interview_scheduled' || state === 'interviewed') {
    return { label: 'Interviewing', tone: 'accent' };
  }
  if (state === 'offered' || state === 'offer_received' || state === 'accepted' || state === 'negotiating') {
    return { label: 'Offer stage', tone: 'accent' };
  }
  if (state === 'rejected' || state === 'withdrawn' || state === 'ghosted') {
    return { label: 'Not moving forward', tone: 'passive' };
  }

  const appliedFlag = item.isApplied ?? undefined;
  const applied = isAppliedOrLaterState(item.state, appliedFlag);
  const pipeApplied = isAppliedOrLaterState(item.pipelineStatus, appliedFlag);
  if (applied || pipeApplied || item.isApplied === true) {
    return { label: 'Applied', tone: 'passive' };
  }
  if (!item.hasCoverLetter) return { label: 'Needs cover letter', tone: 'warn' };
  if (!item.isTailored) return { label: 'Needs CV tailoring', tone: 'warn' };
  const sc = typeof item.matchScore === 'number' && Number.isFinite(item.matchScore) ? item.matchScore : 0;
  if (sc >= 75) return { label: 'Strong match', tone: 'accent' };
  if (sc >= 55) return { label: 'Good match', tone: 'accent' };
  return { label: 'Ready to apply', tone: 'accent' };
}
