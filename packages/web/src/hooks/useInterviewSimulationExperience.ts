'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { PrepMode, SimulationState, TurnAnswerResponse } from '@/lib/interview-prep-types';
import { isSimulationMode } from '@/lib/interview-prep-types';
import {
  mergeSimulationSnapshot,
  normalizeEmotion,
  normalizePressureTier,
  resolveAvatarDemeanor,
  resolveMicroReactions,
  type AvatarDemeanor,
} from '@/lib/interviewSimulation';
import type { SimulationPersonaUi } from '@/lib/interviewSimulationPersona';

const PRESSURE_THROTTLE_MS = 400;
const PRESSURE_DELTA_MIN = 4;

function logReasoningTagsDev(tags: string[] | undefined): void {
  if (process.env.NODE_ENV === 'production' || !tags?.length) return;
  console.debug('[simulation] reasoningTags', tags);
}

export function useInterviewSimulationExperience(options: {
  sessionId: string;
  prepMode?: PrepMode | string;
  enabled?: boolean;
  lastFeedback: TurnAnswerResponse | null;
  simState?: SimulationState | null;
}) {
  const { sessionId, prepMode, enabled = true, lastFeedback, simState } = options;
  const active = enabled && isSimulationMode(prepMode as PrepMode);

  const merged = useMemo(() => {
    if (!active) return null;
    return mergeSimulationSnapshot({
      turn: lastFeedback?.simulation ?? null,
      live: simState?.simulation ?? null,
      pressureLevel: simState?.pressureLevel,
      prepMode: prepMode as PrepMode,
    });
  }, [
    active,
    lastFeedback?.simulation,
    prepMode,
    simState?.pressureLevel,
    simState?.simulation,
  ]);

  useEffect(() => {
    logReasoningTagsDev(lastFeedback?.simulation?.reasoningTags);
  }, [lastFeedback?.simulation?.reasoningTags]);

  const [displayIntensity, setDisplayIntensity] = useState(28);
  const [showPressureMeter, setShowPressureMeter] = useState(false);
  const [interruptionAlert, setInterruptionAlert] = useState<string | null>(null);

  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTargetRef = useRef(28);
  const lastTierRef = useRef<string | null>(null);
  const interruptionTurnRef = useRef<string | null>(null);

  useEffect(() => {
    setDisplayIntensity(28);
    setShowPressureMeter(false);
    setInterruptionAlert(null);
    lastTargetRef.current = 28;
    lastTierRef.current = null;
    interruptionTurnRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (!active || !merged || !sessionId) return;

    const target = merged.pressureIntensity;
    const tier = merged.pressureTier;
    const tierChanged = lastTierRef.current !== tier;
    lastTierRef.current = tier;

    const applyIntensity = () => {
      const prev = lastTargetRef.current;
      if (Math.abs(target - prev) < PRESSURE_DELTA_MIN && !tierChanged) return;
      lastTargetRef.current = target;
      setDisplayIntensity(target);
      setShowPressureMeter(
        tier !== 'low' || target >= 38 || Math.abs(target - prev) >= PRESSURE_DELTA_MIN,
      );
    };

    if (throttleRef.current) clearTimeout(throttleRef.current);
    throttleRef.current = setTimeout(applyIntensity, PRESSURE_THROTTLE_MS);
    return () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, [active, merged, sessionId]);

  useEffect(() => {
    if (!active || !merged?.interruption.occurred) return;
    const turnKey = lastFeedback?.turn?.id;
    if (!turnKey || interruptionTurnRef.current === turnKey) return;
    interruptionTurnRef.current = turnKey;
    const msg =
      merged.interruption.message ?? 'Interviewer is following up…';
    setInterruptionAlert(msg);
    const t = setTimeout(() => setInterruptionAlert(null), 1200);
    return () => clearTimeout(t);
  }, [
    active,
    lastFeedback?.turn?.id,
    merged?.interruption.message,
    merged?.interruption.occurred,
  ]);

  return useMemo(() => {
    if (!active || !merged) {
      return {
        active: false as const,
        emotion: 'neutral' as const,
        pressureTier: 'low' as const,
        pressureIntensity: 28,
        displayPressureIntensity: 28,
        showPressureMeter: false,
        pacingMultiplier: 1,
        nextQuestionDifficulty: 3,
        signals: [] as const,
        reactionText: null as string | null,
        nudgeMessage: null as string | null,
        avatarDemeanor: 'neutral' as AvatarDemeanor,
        microReactions: [] as string[],
        personaUi: null as SimulationPersonaUi | null,
        nextBehavior: null,
        interruptionAlert: null as string | null,
        atmosphere: 'calm' as const,
        turnSimulation: null,
      };
    }

    const microReactions = resolveMicroReactions(
      merged.signals,
      lastFeedback?.scores,
    );

    return {
      active: true as const,
      emotion: normalizeEmotion(merged.emotion),
      pressureTier: normalizePressureTier(merged.pressureTier, simState?.pressureLevel),
      pressureIntensity: merged.pressureIntensity,
      displayPressureIntensity: displayIntensity,
      showPressureMeter,
      pacingMultiplier: merged.pacingMultiplier,
      nextQuestionDifficulty: merged.nextQuestionDifficulty,
      signals: merged.signals,
      reactionText: merged.reactionText,
      nudgeMessage: merged.nudgeMessage ?? simState?.nudgeMessage ?? null,
      avatarDemeanor: resolveAvatarDemeanor(merged.signals),
      microReactions,
      personaUi: merged.persona,
      nextBehavior: merged.nextBehavior,
      interruptionAlert,
      atmosphere: merged.persona.atmosphere,
      turnSimulation: lastFeedback?.simulation ?? null,
    };
  }, [
    active,
    displayIntensity,
    interruptionAlert,
    lastFeedback?.scores,
    lastFeedback?.simulation,
    merged,
    showPressureMeter,
    simState?.nudgeMessage,
    simState?.pressureLevel,
  ]);
}
