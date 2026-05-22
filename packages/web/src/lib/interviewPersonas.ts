import type { InterviewPersonality } from '@/lib/api';
import type { CoachPersonality, PrepMode } from '@/lib/interview-prep-types';

/** UX interviewer persona — drives avatars, chrome, and live feedback styling. */
export type InterviewPersonaId =
  | 'friendly_coach'
  | 'strict_interviewer'
  | 'hr_interviewer'
  | 'technical_interviewer'
  | 'silent_observer';

export type PersonaMood = 'supportive' | 'neutral' | 'strict' | 'calm' | 'minimal';

export type PersonalityPresentation = {
  feedbackStyle?: string;
  encouragementTone?: string;
  avatarRenderHint?: string;
  followUpIntensity?: string;
};

export type ResolvedInterviewPersona = {
  id: InterviewPersonaId;
  /** Display name (e.g. Desmond Goldsmith) */
  personName: string;
  /** Role title shown under the name (e.g. Friendly Coach) */
  roleLabel: string;
  /** @deprecated Use personName — kept for API/session label fallbacks */
  label: string;
  mood: PersonaMood;
  moodLabel: string;
  tagline: string;
  accentColor: string;
  legacyAvatar: InterviewPersonality;
  /** Optional UI-only avatar when legacyAvatar is shared across personas */
  avatarPersonality?: InterviewPersonality | 'jordan';
  avatarAsset: string;
  recommended?: boolean;
  showMidSessionFeedback: boolean;
  theme: {
    glowClass: string;
    borderClass: string;
    badgeClass: string;
    meterClass: string;
    cardClass: string;
    nudgeClass: string;
    headerBgClass: string;
  };
  positiveFeedback: string;
  criticalFeedback: string;
  presentation?: PersonalityPresentation;
};

const PERSONA_IDS = new Set<string>([
  'friendly_coach',
  'strict_interviewer',
  'hr_interviewer',
  'technical_interviewer',
  'silent_observer',
]);

export const INTERVIEW_PERSONAS: Record<InterviewPersonaId, ResolvedInterviewPersona> = {
  friendly_coach: {
    id: 'friendly_coach',
    personName: 'Desmond Goldsmith',
    roleLabel: 'Friendly Coach',
    label: 'Desmond Goldsmith',
    mood: 'supportive',
    moodLabel: 'Supportive',
    tagline: "Let's improve your answer",
    accentColor: '#22C55E',
    legacyAvatar: 'alex',
    avatarAsset: '/assets/interviewers/friendly-avatar.png',
    recommended: true,
    showMidSessionFeedback: true,
    theme: {
      glowClass: 'shadow-[0_0_28px_rgba(34,197,94,0.35)]',
      borderClass: 'border-emerald-400/35',
      badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
      meterClass: 'bg-emerald-400',
      cardClass: 'border-emerald-400/25 bg-emerald-500/8',
      nudgeClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
      headerBgClass: 'bg-emerald-500/[0.06]',
    },
    positiveFeedback: 'Good structure 👍',
    criticalFeedback: 'Add one concrete example to strengthen this.',
  },
  strict_interviewer: {
    id: 'strict_interviewer',
    personName: 'Isaac Kumi',
    roleLabel: 'Strict Interviewer',
    label: 'Isaac Kumi',
    mood: 'strict',
    moodLabel: 'Strict',
    tagline: 'Be specific. Show evidence.',
    accentColor: '#EF4444',
    legacyAvatar: 'marcus',
    avatarAsset: '/assets/interviewers/strict-avatar.png',
    showMidSessionFeedback: true,
    theme: {
      glowClass: 'shadow-[0_0_24px_rgba(239,68,68,0.28)]',
      borderClass: 'border-red-400/40',
      badgeClass: 'border-red-400/40 bg-red-500/15 text-red-200',
      meterClass: 'bg-red-500',
      cardClass: 'border-red-400/30 bg-red-500/8',
      nudgeClass: 'border-red-400/35 bg-red-950/80 text-red-100',
      headerBgClass: 'bg-red-500/[0.06]',
    },
    positiveFeedback: 'Clear and direct.',
    criticalFeedback: 'This is too vague. Be specific.',
  },
  hr_interviewer: {
    id: 'hr_interviewer',
    personName: 'Amara Osei',
    roleLabel: 'HR Interviewer',
    label: 'Amara Osei',
    mood: 'calm',
    moodLabel: 'Calm',
    tagline: 'Communication and culture fit matter here.',
    accentColor: '#3B82F6',
    legacyAvatar: 'sarah',
    avatarAsset: '/assets/interviewers/hr-avatar.png',
    showMidSessionFeedback: true,
    theme: {
      glowClass: 'shadow-[0_0_24px_rgba(59,130,246,0.28)]',
      borderClass: 'border-blue-400/35',
      badgeClass: 'border-blue-400/40 bg-blue-500/15 text-blue-200',
      meterClass: 'bg-blue-400',
      cardClass: 'border-blue-400/25 bg-blue-500/8',
      nudgeClass: 'border-blue-400/30 bg-blue-950/70 text-blue-100',
      headerBgClass: 'bg-blue-500/[0.06]',
    },
    positiveFeedback: 'Good communication tone.',
    criticalFeedback: 'Good communication, but refine clarity.',
  },
  technical_interviewer: {
    id: 'technical_interviewer',
    personName: 'Priya Sharma',
    roleLabel: 'Technical Interviewer',
    label: 'Priya Sharma',
    mood: 'neutral',
    moodLabel: 'Structured',
    tagline: 'Walk me through your reasoning step by step.',
    accentColor: '#A855F7',
    legacyAvatar: 'zoe',
    avatarAsset: '/assets/interviewers/technical-avatar.png',
    showMidSessionFeedback: true,
    theme: {
      glowClass: 'shadow-[0_0_24px_rgba(168,85,247,0.28)]',
      borderClass: 'border-violet-400/35',
      badgeClass: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
      meterClass: 'bg-violet-400',
      cardClass: 'border-violet-400/25 bg-violet-500/8',
      nudgeClass: 'border-violet-400/30 bg-violet-950/70 text-violet-100',
      headerBgClass: 'bg-violet-500/[0.06]',
    },
    positiveFeedback: 'Logical breakdown — well done.',
    criticalFeedback: 'Structure the problem, approach, and result clearly.',
  },
  silent_observer: {
    id: 'silent_observer',
    personName: 'Jordan Blake',
    roleLabel: 'Silent Observer',
    label: 'Jordan Blake',
    mood: 'minimal',
    moodLabel: 'Observing',
    tagline: 'Answers are recorded — full feedback after the session.',
    accentColor: '#9CA3AF',
    legacyAvatar: 'alex',
    avatarPersonality: 'jordan',
    avatarAsset: '/assets/interviewers/observer-avatar.png',
    showMidSessionFeedback: false,
    theme: {
      glowClass: 'shadow-none',
      borderClass: 'border-white/15',
      badgeClass: 'border-white/20 bg-white/5 text-white/60',
      meterClass: 'bg-white/40',
      cardClass: 'border-white/10 bg-white/[0.03]',
      nudgeClass: 'border-white/15 bg-white/5 text-white/55',
      headerBgClass: 'bg-white/[0.03]',
    },
    positiveFeedback: '',
    criticalFeedback: '',
  },
};

export function isInterviewPersonaId(raw: unknown): raw is InterviewPersonaId {
  return typeof raw === 'string' && PERSONA_IDS.has(raw.trim().toLowerCase());
}

export function normalizeInterviewPersonaId(raw: unknown): InterviewPersonaId {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (PERSONA_IDS.has(s)) return s as InterviewPersonaId;
  return 'friendly_coach';
}

function coachToPersona(coach: CoachPersonality): InterviewPersonaId {
  if (coach === 'strict') return 'strict_interviewer';
  if (coach === 'friendly') return 'friendly_coach';
  if (coach === 'fast_paced') return 'technical_interviewer';
  return 'hr_interviewer';
}

function prepModeToPersona(prepMode?: PrepMode): InterviewPersonaId | null {
  if (prepMode === 'hr_simulation') return 'hr_interviewer';
  if (prepMode === 'senior_interviewer_simulation') return 'strict_interviewer';
  return null;
}

export type SessionPersonaSource = {
  interviewPersona?: string;
  interviewPersonaId?: string;
  interviewerPersonality?: string;
  coachPersonality?: string;
  prepMode?: PrepMode;
  interviewType?: string;
  personality?: InterviewPersonality;
  interviewerLabel?: string;
  interviewerRoleLabel?: string;
  interviewerAvatar?: string;
  interviewerColor?: string;
  personalityPresentation?: PersonalityPresentation;
};

/** Legacy sessions that still send a role title in `interviewerLabel`. */
const LEGACY_ROLE_INTERVIEWER_LABELS = new Set(
  Object.values(INTERVIEW_PERSONAS).map((p) => p.roleLabel.trim().toLowerCase()),
);

/** True when `interviewerLabel` is a role title, not a human name (pre–May 2026 API). */
export function isLegacyRoleInterviewerLabel(label: string | undefined | null): boolean {
  const fromApi = label?.trim() ?? '';
  if (!fromApi) return true;
  const normalized = fromApi.toLowerCase();
  if (LEGACY_ROLE_INTERVIEWER_LABELS.has(normalized)) return true;
  return (
    /\b(coach|interviewer|observer)\b/i.test(fromApi) && !/\s[A-Za-z]+\s[A-Za-z]+/.test(fromApi)
  );
}

/**
 * Human name for TTS and "X asks:" — prefers API `interviewerLabel` when it is a person name.
 */
export function resolveInterviewerPersonName(
  interviewerLabel: string | undefined | null,
  persona: ResolvedInterviewPersona,
): string {
  const fromApi = interviewerLabel?.trim() ?? '';
  if (fromApi && !isLegacyRoleInterviewerLabel(fromApi)) return fromApi;
  return persona.personName;
}

export function resolveSessionPersona(session: SessionPersonaSource): ResolvedInterviewPersona {
  const fromPrep = prepModeToPersona(session.prepMode);
  const rawPersona =
    session.interviewPersona ??
    session.interviewPersonaId ??
    (isInterviewPersonaId(session.interviewerPersonality) ? session.interviewerPersonality : null);

  let id: InterviewPersonaId = fromPrep ?? 'friendly_coach';
  if (rawPersona && isInterviewPersonaId(rawPersona)) {
    id = normalizeInterviewPersonaId(rawPersona);
  } else if (!fromPrep && session.coachPersonality) {
    const coach = session.coachPersonality.trim().toLowerCase();
    if (coach === 'friendly' || coach === 'professional' || coach === 'strict' || coach === 'fast_paced') {
      id = coachToPersona(coach as CoachPersonality);
    }
  } else if (session.interviewType === 'technical') {
    id = 'technical_interviewer';
  }

  const base = INTERVIEW_PERSONAS[id];
  const personName = resolveInterviewerPersonName(session.interviewerLabel, base);
  const roleLabel = session.interviewerRoleLabel?.trim() || base.roleLabel;
  const label = personName;
  const accentColor = session.interviewerColor?.trim() || base.accentColor;
  const avatarAsset = session.interviewerAvatar?.trim()
    ? session.interviewerAvatar.startsWith('/')
      ? session.interviewerAvatar
      : `/assets/interviewers/${session.interviewerAvatar}`
    : base.avatarAsset;

  return {
    ...base,
    personName,
    roleLabel,
    label,
    accentColor,
    avatarAsset,
    presentation: session.personalityPresentation ?? base.presentation,
  };
}

/** Avatar key for SVG rendering — unique per persona even when legacy API personality repeats. */
export function personaAvatarKey(persona: ResolvedInterviewPersona): InterviewPersonality | 'jordan' {
  return persona.avatarPersonality ?? persona.legacyAvatar;
}

/** Spoken + on-screen intro — uses resolved {@link personName}, not legacy personality copy. */
export function interviewerGreetingMessage(persona: ResolvedInterviewPersona): string {
  const name = persona.personName.trim();
  switch (persona.id) {
    case 'strict_interviewer':
      return `I'm ${name}. I'll be direct with you — tough questions, because that's what the real interview will feel like. Let's get started.`;
    case 'hr_interviewer':
      return `Good day. I'm ${name}, and I'll be conducting your interview today. We'll work through several structured questions — please use specific examples where you can. Shall we begin?`;
    case 'technical_interviewer':
      return `Hi — I'm ${name}. Walk me through your reasoning step by step on each question. I'm interested in how you think, not just the final answer. Ready?`;
    case 'silent_observer':
      return `I'm ${name}. I'll stay quiet during the session — you'll receive full feedback when we're done.`;
    default:
      return `Hi! I'm ${name}, and I'm really looking forward to learning more about you today. There are no trick questions here — just a conversation. Ready to get started?`;
  }
}

/** Spoken + on-screen wrap-up after End interview. */
export function postInterviewThankYouMessage(persona: ResolvedInterviewPersona): string {
  const first = persona.personName.split(/\s+/)[0] || persona.personName;
  switch (persona.id) {
    case 'strict_interviewer':
      return `That's a wrap — well done showing up for the hard questions. I'm ${persona.personName}, and your scored feedback is usually ready in under a minute. Stay on this screen, head to your dashboard, or check interview history whenever you like.`;
    case 'hr_interviewer':
      return `Thank you for completing the session. I'm ${persona.personName}. Your results and coaching notes are typically ready within thirty seconds to a minute and a half. You can wait here, or pick them up later from your dashboard.`;
    case 'technical_interviewer':
      return `Nice work — we're done. I'm ${persona.personName}. I'm sending your answers off for scoring now; results usually land in about a minute. Chill here, or grab them from your dashboard when you're ready.`;
    case 'silent_observer':
      return `Thank you. I'm ${persona.personName}. Your full feedback will be ready shortly — about a minute on average.`;
    default:
      return `${first}, you absolutely crushed showing up today — seriously, well done. I'm ${persona.personName}. I'm queuing your personalised results now; they usually land in thirty seconds to a minute and a half. Stick around if you want the instant reveal, or wander off to the dashboard — we'll have your score waiting when you're back.`;
  }
}

export function personaFeedbackMessage(
  persona: ResolvedInterviewPersona,
  scores?: { clarityScore?: number; structureScore?: number; relevanceScore?: number },
): string | null {
  if (!persona.showMidSessionFeedback) return null;
  const vals = [scores?.clarityScore, scores?.structureScore, scores?.relevanceScore].filter(
    (v): v is number => typeof v === 'number',
  );
  if (vals.length === 0) return persona.tagline;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return avg >= 65 ? persona.positiveFeedback : persona.criticalFeedback;
}
