import type {
  InterviewEmotion,
  PrepMode,
  PressureTier,
  SimulationLiveState,
  SimulationNextBehavior,
  SimulationPersona,
  SimulationSignal,
  TurnSimulationFeedback,
} from '@/lib/interview-prep-types';
import { resolveSimulationPersona, type SimulationPersonaUi } from '@/lib/interviewSimulationPersona';

export type AvatarDemeanor = 'supportive' | 'neutral' | 'strict';

export const EMOTION_DISPLAY: Record<
  InterviewEmotion,
  { emoji: string; label: string }
> = {
  neutral: { emoji: '😐', label: 'Neutral' },
  concerned: { emoji: '😟', label: 'Concerned' },
  curious: { emoji: '🤔', label: 'Curious' },
  impressed: { emoji: '😌', label: 'Impressed' },
  strict: { emoji: '🧊', label: 'Strict' },
};

const VALID_EMOTIONS = new Set<string>(Object.keys(EMOTION_DISPLAY));
const VALID_PRESSURE = new Set<string>(['low', 'medium', 'high']);

export function normalizeEmotion(raw: string | undefined | null): InterviewEmotion {
  const key = (raw ?? 'neutral').trim().toLowerCase();
  return VALID_EMOTIONS.has(key) ? (key as InterviewEmotion) : 'neutral';
}

export function normalizePressureTier(
  tier: PressureTier | string | undefined | null,
  numericLevel?: number,
): PressureTier {
  const key = (tier ?? '').trim().toLowerCase();
  if (VALID_PRESSURE.has(key)) return key as PressureTier;
  const n = numericLevel ?? 1;
  if (n >= 4) return 'high';
  if (n >= 2) return 'medium';
  return 'low';
}

export type MergedSimulationSnapshot = {
  emotion: InterviewEmotion;
  pressureTier: PressureTier;
  pressureIntensity: number;
  pacingMultiplier: number;
  nextQuestionDifficulty: number;
  signals: SimulationSignal[];
  reactionText: string | null;
  nudgeMessage: string | null;
  persona: SimulationPersonaUi;
  nextBehavior: SimulationNextBehavior | null;
  interruption: { occurred: boolean; message: string | null };
};

function resolvePressureIntensity(
  turn?: TurnSimulationFeedback | null,
  live?: SimulationLiveState | null,
  tier?: PressureTier,
  numericLevel?: number,
): number {
  const fromTurn = turn?.pressureIntensity;
  const fromLive = live?.pressureIntensity;
  if (typeof fromTurn === 'number' && Number.isFinite(fromTurn)) {
    return Math.max(0, Math.min(100, Math.round(fromTurn)));
  }
  if (typeof fromLive === 'number' && Number.isFinite(fromLive)) {
    return Math.max(0, Math.min(100, Math.round(fromLive)));
  }
  const resolvedTier = tier ?? normalizePressureTier(turn?.pressureLevel ?? live?.pressureTier, numericLevel);
  return pressureBarPercent(resolvedTier);
}

export function mergeSimulationSnapshot(options: {
  turn?: TurnSimulationFeedback | null;
  live?: SimulationLiveState | null;
  pressureLevel?: number;
  prepMode?: PrepMode | string;
}): MergedSimulationSnapshot {
  const turn = options.turn;
  const live = options.live;

  const signals = [
    ...(turn?.signals ?? []),
    ...((live?.recentSignals ?? []) as SimulationSignal[]),
  ].filter((s, i, arr) => s && arr.indexOf(s) === i);

  const pressureTier = normalizePressureTier(
    turn?.pressureLevel ?? live?.pressureTier,
    options.pressureLevel,
  );

  const interruptionOccurred =
    Boolean(turn?.interruption?.occurred) || turn?.nextBehavior === 'interruption';
  const interruptionMessage =
    turn?.interruption?.message?.trim() ||
    (interruptionOccurred ? turn?.reactionText?.trim() || 'Let me jump in with a follow-up.' : null);

  return {
    emotion: normalizeEmotion(turn?.emotion ?? String(live?.emotion ?? 'neutral')),
    pressureTier,
    pressureIntensity: resolvePressureIntensity(turn, live, pressureTier, options.pressureLevel),
    pacingMultiplier: turn?.pacingMultiplier ?? live?.pacingMultiplier ?? 1,
    nextQuestionDifficulty: Math.min(
      5,
      Math.max(1, turn?.nextQuestionDifficulty ?? live?.nextQuestionDifficulty ?? 3),
    ),
    signals,
    reactionText: turn?.reactionText?.trim() || live?.reactionText?.trim() || null,
    nudgeMessage: turn?.nudgeMessage ?? null,
    persona: resolveSimulationPersona(turn?.persona ?? live?.persona, options.prepMode as PrepMode | undefined),
    nextBehavior: turn?.nextBehavior ?? null,
    interruption: {
      occurred: interruptionOccurred,
      message: interruptionMessage,
    },
  };
}

/** Brief beat when interviewer interrupts (no modal). */
export function interruptionAlertDelayMs(): number {
  return 420;
}

/** Hesitation before speaking after a follow-up in sim mode. */
export function followUpHesitationMs(personaTone?: string): number {
  if (personaTone === 'aggressive' || personaTone === 'fast-paced') return 520;
  if (personaTone === 'friendly') return 680;
  return 580;
}

/** Pre-speak pause before question audio (harder = longer). */
export function questionLeadDelayMs(difficulty: number): number {
  const d = Math.min(5, Math.max(1, difficulty));
  if (d <= 2) return 280;
  if (d === 3) return 520;
  if (d === 4) return 780;
  return 1050;
}

/** UI beat before question text is spoken (typing feel). */
export function questionTypingDelayMs(difficulty: number): number {
  const d = Math.min(5, Math.max(1, difficulty));
  if (d <= 2) return 320;
  if (d === 3) return 520;
  return 720;
}

export function simulationThinkingDelayMs(signals: SimulationSignal[]): number {
  const base = 650;
  if (signals.includes('ANSWER_WEAK')) return base + 520;
  if (signals.includes('TIME_DELAY_HIGH')) return base + 280;
  if (signals.includes('ANSWER_STRONG')) return base - 120;
  return base;
}

export function transitionPauseWithSimulation(
  baseMs: number,
  signals: SimulationSignal[],
): number {
  let ms = baseMs;
  if (signals.includes('ANSWER_WEAK')) ms += 380;
  if (signals.includes('ANSWER_STRONG')) ms -= 80;
  if (signals.includes('USER_UNCERTAIN')) ms += 160;
  return Math.max(220, ms);
}

export function resolveAvatarDemeanor(signals: SimulationSignal[]): AvatarDemeanor {
  const strong =
    signals.includes('ANSWER_STRONG') || signals.includes('USER_CONFIDENT');
  const weak =
    signals.includes('ANSWER_WEAK') || signals.includes('USER_UNCERTAIN');
  if (strong && !weak) return 'strict';
  if (weak && !strong) return 'supportive';
  return 'neutral';
}

const SIGNAL_MICRO_COPY: Partial<Record<SimulationSignal, string>> = {
  ANSWER_STRONG: 'Strong example used',
  ANSWER_WEAK: 'Try being more specific',
  USER_CONFIDENT: 'Good structure',
  USER_UNCERTAIN: 'Needs clarity',
  TIME_DELAY_HIGH: 'Watch pacing under pressure',
};

export function resolveMicroReactions(
  signals: SimulationSignal[],
  scores?: { clarityScore?: number; structureScore?: number; relevanceScore?: number },
): string[] {
  const lines: string[] = [];
  for (const sig of signals) {
    const copy = SIGNAL_MICRO_COPY[sig];
    if (copy && !lines.includes(copy)) lines.push(copy);
  }
  if (scores) {
    if ((scores.structureScore ?? 0) >= 75 && !lines.includes('Good structure')) {
      lines.push('Good structure');
    }
    if ((scores.clarityScore ?? 0) < 60 && !lines.includes('Needs clarity')) {
      lines.push('Needs clarity');
    }
  }
  return lines.slice(0, 2);
}

export function pressureBarPercent(tier: PressureTier): number {
  switch (tier) {
    case 'high':
      return 88;
    case 'medium':
      return 58;
    default:
      return 28;
  }
}
