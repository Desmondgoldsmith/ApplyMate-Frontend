'use client';

import { useMemo } from 'react';

import type {
  SimulationSignal,
  SimulationState,
  TurnAnswerResponse,
} from '@/lib/interview-prep-types';
import { isSimulationMode } from '@/lib/interview-prep-types';
import {
  mergeSimulationSnapshot,
  normalizeEmotion,
  normalizePressureTier,
  resolveAvatarDemeanor,
  resolveMicroReactions,
  type AvatarDemeanor,
} from '@/lib/interviewSimulation';

export function useInterviewSimulation(options: {
  prepMode?: string;
  enabled?: boolean;
  lastFeedback: TurnAnswerResponse | null;
  simState?: SimulationState | null;
}) {
  const { prepMode, enabled = true, lastFeedback, simState } = options;
  const active =
    enabled &&
    isSimulationMode(prepMode as Parameters<typeof isSimulationMode>[0]);

  return useMemo(() => {
    if (!active) {
      return {
        active: false as const,
        emotion: 'neutral' as const,
        pressureTier: 'low' as const,
        pacingMultiplier: 1,
        nextQuestionDifficulty: 3,
        signals: [] as SimulationSignal[],
        reactionText: null as string | null,
        nudgeMessage: null as string | null,
        avatarDemeanor: 'neutral' as AvatarDemeanor,
        microReactions: [] as string[],
      };
    }

    const merged = mergeSimulationSnapshot({
      turn: lastFeedback?.simulation ?? null,
      live: simState?.simulation ?? null,
      pressureLevel: simState?.pressureLevel,
      prepMode: prepMode as Parameters<
        typeof mergeSimulationSnapshot
      >[0]['prepMode'],
    });

    const microReactions = resolveMicroReactions(
      merged.signals,
      lastFeedback?.scores,
    );

    return {
      active: true as const,
      emotion: normalizeEmotion(merged.emotion),
      pressureTier: normalizePressureTier(
        merged.pressureTier,
        simState?.pressureLevel,
      ),
      pacingMultiplier: merged.pacingMultiplier,
      nextQuestionDifficulty: merged.nextQuestionDifficulty,
      signals: merged.signals,
      reactionText: merged.reactionText,
      nudgeMessage: merged.nudgeMessage ?? simState?.nudgeMessage ?? null,
      avatarDemeanor: resolveAvatarDemeanor(merged.signals),
      microReactions,
      turnSimulation: lastFeedback?.simulation ?? null,
    };
  }, [
    active,
    lastFeedback?.scores,
    lastFeedback?.simulation,
    simState?.nudgeMessage,
    simState?.pressureLevel,
    simState?.simulation,
  ]);
}
