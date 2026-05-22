import type { PrepMode, SimulationPersona, SimulationPersonaTone } from '@/lib/interview-prep-types';

export type SimulationPersonaUi = {
  id: SimulationPersona;
  title: string;
  subtitle: string;
  tone: SimulationPersonaTone;
  /** CSS atmosphere token key */
  atmosphere: 'calm' | 'neutral' | 'tense' | 'intense';
};

export const SIMULATION_PERSONA_UI: Record<SimulationPersona, SimulationPersonaUi> = {
  friendly_hr: {
    id: 'friendly_hr',
    title: 'HR interviewer',
    subtitle: 'Supportive, structured tone',
    tone: 'friendly',
    atmosphere: 'calm',
  },
  strict_hr: {
    id: 'strict_hr',
    title: 'HR interviewer',
    subtitle: 'Direct, detail-focused',
    tone: 'neutral',
    atmosphere: 'neutral',
  },
  senior_engineer: {
    id: 'senior_engineer',
    title: 'Senior interviewer',
    subtitle: 'Technical and thorough',
    tone: 'neutral',
    atmosphere: 'neutral',
  },
  startup_founder: {
    id: 'startup_founder',
    title: 'Founder interviewer',
    subtitle: 'Fast-paced, unpredictable',
    tone: 'fast-paced',
    atmosphere: 'tense',
  },
  stress_interviewer: {
    id: 'stress_interviewer',
    title: 'High-pressure interviewer',
    subtitle: 'Rapid follow-ups, high expectations',
    tone: 'aggressive',
    atmosphere: 'intense',
  },
};

export function resolveSimulationPersona(
  persona: SimulationPersona | string | undefined,
  prepMode?: PrepMode,
): SimulationPersonaUi {
  const key = (persona ?? '').trim() as SimulationPersona;
  if (key && SIMULATION_PERSONA_UI[key]) {
    return SIMULATION_PERSONA_UI[key];
  }
  if (prepMode === 'hr_simulation') return SIMULATION_PERSONA_UI.friendly_hr;
  if (prepMode === 'senior_interviewer_simulation') {
    return SIMULATION_PERSONA_UI.senior_engineer;
  }
  return SIMULATION_PERSONA_UI.friendly_hr;
}

export function personaToneLabel(tone: SimulationPersonaTone): string {
  switch (tone) {
    case 'friendly':
      return 'Supportive tone';
    case 'aggressive':
      return 'High pressure';
    case 'fast-paced':
      return 'Fast-paced';
    default:
      return 'Professional tone';
  }
}
