'use client';

import { memo, useEffect, useRef } from 'react';

import type { InterviewVoiceBridge } from '@/contexts/InterviewVoiceContext';
import type { MutableRefObject } from 'react';
import type { InterviewPhase } from './sessionTypes';
import {
  isEdgeBrowser,
  sleep,
  STT_EDGE_SILENCE_BEFORE_RECORD_MS,
  sttDelayAfterTts,
} from '@/lib/interviewSpeech';

export const IntroMicPrimeEffect = memo(function IntroMicPrimeEffect({
  phase,
  introStage,
  interviewerAudioBusy,
  voiceBridgeRef,
}: {
  phase: InterviewPhase;
  introStage: 'greeting' | 'self_intro';
  interviewerAudioBusy: boolean;
  voiceBridgeRef: MutableRefObject<InterviewVoiceBridge | null>;
}) {
  const primedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'intro' || introStage !== 'self_intro') {
      primedRef.current = false;
      return;
    }
    const v = voiceBridgeRef.current;
    if (!v) return;
    if (v.inputMode === 'type') {
      primedRef.current = false;
    }
    if (
      v.inputMode !== 'voice' ||
      !v.isSpeechRecognitionSupported ||
      primedRef.current ||
      v.fellBackToManual
    ) {
      return;
    }
    if (interviewerAudioBusy) return;

    primedRef.current = true;
    let cancelled = false;

    const edgeExtra = isEdgeBrowser() ? STT_EDGE_SILENCE_BEFORE_RECORD_MS : 0;
    const delayMs = edgeExtra + sttDelayAfterTts();

    void sleep(delayMs).then(() => {
      if (cancelled) return;
      const bridge = voiceBridgeRef.current;
      if (!bridge || bridge.fellBackToManual || bridge.inputMode !== 'voice') return;
      void bridge.start();
    });

    return () => {
      cancelled = true;
    };
  }, [voiceBridgeRef, introStage, interviewerAudioBusy, phase]);

  return null;
});
