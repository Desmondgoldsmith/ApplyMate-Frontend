import type { CoachPersonality } from '@/lib/interview-prep-types';

export type CoachPersonalityConfig = {
  id: CoachPersonality;
  label: string;
  subtitle: string;
  description: string;
  followUpStyle: string;
};

export const COACH_PERSONALITIES: Record<CoachPersonality, CoachPersonalityConfig> = {
  friendly: {
    id: 'friendly',
    label: 'Friendly interviewer',
    subtitle: 'Warm & encouraging',
    description: 'Supportive tone with gentle follow-ups when answers need more detail.',
    followUpStyle: 'Gentle prompts',
  },
  professional: {
    id: 'professional',
    label: 'Professional interviewer',
    subtitle: 'Structured & clear',
    description: 'Balanced corporate style with clear expectations and fair follow-ups.',
    followUpStyle: 'Balanced probes',
  },
  strict: {
    id: 'strict',
    label: 'Strict interviewer',
    subtitle: 'Direct & demanding',
    description: 'Higher bar for specificity; follow-ups push for evidence and outcomes.',
    followUpStyle: 'Firm challenges',
  },
  fast_paced: {
    id: 'fast_paced',
    label: 'Fast-paced interviewer',
    subtitle: 'Quick & efficient',
    description: 'Keeps momentum high with shorter transitions and brisk follow-ups.',
    followUpStyle: 'Rapid follow-ups',
  },
};

export function normalizeCoachPersonality(raw: unknown): CoachPersonality {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'friendly' || s === 'professional' || s === 'strict' || s === 'fast_paced') {
    return s;
  }
  return 'professional';
}

import { isInterviewPersonaId } from '@/lib/interviewPersonas';

export function resolveCoachPersonality(session: {
  coachPersonality?: string;
  interviewerPersonality?: string;
}): CoachPersonality {
  if (session.coachPersonality) return normalizeCoachPersonality(session.coachPersonality);
  const legacy = session.interviewerPersonality;
  if (legacy && !isInterviewPersonaId(legacy)) {
    return normalizeCoachPersonality(legacy);
  }
  return 'professional';
}
