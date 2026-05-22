'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isBenignRecognitionError,
  isEdgeBrowser,
  isNoSpeechError,
  sleep,
  sttDelayAfterTts,
  sttRecognitionRestartDelay,
} from '@/lib/interviewSpeech';

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionCtor = new () => RecognitionLike;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

function isSynthesisActive(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking || window.speechSynthesis.paused;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const listeningActiveRef = useRef(false);
  const recognitionHandoffRef = useRef(false);
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const recognitionRestartScheduledRef = useRef(false);
  const speakGenerationRef = useRef(0);
  const recognitionCallbacksRef = useRef<{
    onTranscript: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
  } | null>(null);

  const [speechApis, setSpeechApis] = useState<{ ready: boolean; synth: boolean; rec: boolean }>({
    ready: false,
    synth: false,
    rec: false,
  });

  useEffect(() => {
    setSpeechApis({
      ready: true,
      synth: Boolean(window.speechSynthesis),
      rec: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    });
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const speechApisReady = speechApis.ready;
  const isSpeechSynthesisSupported = speechApis.ready && speechApis.synth;
  const isSpeechRecognitionSupported = speechApis.ready && speechApis.rec;

  const stopListeningInternal = useCallback((handoff = true) => {
    listeningActiveRef.current = false;
    if (recognitionRestartTimerRef.current) {
      window.clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
    recognitionRestartScheduledRef.current = false;
    const active = recognitionRef.current;
    if (!active) {
      setIsListening(false);
      return;
    }
    if (handoff) recognitionHandoffRef.current = true;
    active.stop();
    recognitionRef.current = null;
    setIsListening(false);
    if (handoff) {
      window.setTimeout(() => {
        recognitionHandoffRef.current = false;
      }, 50);
    }
  }, []);

  const pickVoice = useCallback((voiceName?: string): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    if (!voiceName?.trim()) return voices[0] ?? null;
    const hint = voiceName.toLowerCase();
    const exact = voices.find((v) => v.name.toLowerCase() === hint);
    if (exact) return exact;
    const partial = voices.find((v) => v.name.toLowerCase().includes(hint));
    return partial ?? voices[0] ?? null;
  }, []);

  const updateSpeakingRate = useCallback((rate: number): boolean => {
    const utterance = speechRef.current;
    if (!utterance || typeof window === 'undefined' || !window.speechSynthesis) return false;
    if (!isSynthesisActive()) return false;
    utterance.rate = rate;
    return true;
  }, []);

  const pauseSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, []);

  const speak = useCallback(
    (
      text: string,
      options: {
        voiceName?: string;
        rate?: number;
        pitch?: number;
        onStart?: () => void;
        onEnd?: () => void;
        onBoundary?: (charIndex: number) => void;
      } = {},
    ) => {
      stopListeningInternal(true);

      const generation = ++speakGenerationRef.current;

      const endIfNoUtterance = () => {
        queueMicrotask(() => {
          if (generation !== speakGenerationRef.current) return;
          options.onEnd?.();
        });
      };

      if (typeof window === 'undefined' || !window.speechSynthesis) {
        endIfNoUtterance();
        return;
      }
      const clean = text.trim();
      if (!clean) {
        endIfNoUtterance();
        return;
      }

      window.speechSynthesis.cancel();
      speechRef.current = null;
      setIsSpeaking(false);

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;

      let spoke = false;
      const applyVoiceAndSpeak = () => {
        if (spoke || generation !== speakGenerationRef.current) return;
        spoke = true;
        const voice = pickVoice(options.voiceName);
        if (voice) utterance.voice = voice;
        utterance.onstart = () => {
          if (generation !== speakGenerationRef.current) return;
          setIsSpeaking(true);
          options.onStart?.();
        };
        utterance.onend = () => {
          if (generation !== speakGenerationRef.current) return;
          setIsSpeaking(false);
          speechRef.current = null;
          options.onEnd?.();
        };
        utterance.onerror = () => {
          if (generation !== speakGenerationRef.current) return;
          setIsSpeaking(false);
          speechRef.current = null;
          options.onEnd?.();
        };
        utterance.onboundary = (evt) => {
          if (typeof evt.charIndex === 'number') options.onBoundary?.(evt.charIndex);
        };
        speechRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      };

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        applyVoiceAndSpeak();
        return;
      }

      const prev = window.speechSynthesis.onvoiceschanged;
      const synth = window.speechSynthesis;
      const voiceWaitMs = 1500;
      const fallbackTimer = window.setTimeout(() => {
        synth.onvoiceschanged = prev ?? null;
        applyVoiceAndSpeak();
      }, voiceWaitMs);

      synth.onvoiceschanged = () => {
        window.clearTimeout(fallbackTimer);
        applyVoiceAndSpeak();
        synth.onvoiceschanged = prev ?? null;
      };
    },
    [pickVoice, stopListeningInternal],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    speakGenerationRef.current += 1;
    window.speechSynthesis.cancel();
    speechRef.current = null;
    setIsSpeaking((was) => (was ? false : was));
  }, []);

  /**
   * Edge needs synthesis fully stopped (not paused) and a gap before STT,
   * otherwise the mic appears "muted" or recognition aborts immediately.
   */
  const releaseAudioForListening = useCallback(async (): Promise<void> => {
    speakGenerationRef.current += 1;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechRef.current = null;
      setIsSpeaking(false);
    }
    stopListeningInternal(true);
    await sleep(sttDelayAfterTts());
    recognitionHandoffRef.current = false;
  }, [stopListeningInternal]);

  const startListening = useCallback(
    (options: {
      onTranscript: (text: string, isFinal: boolean) => void;
      onError?: (error: string) => void;
      continuous?: boolean;
    }): boolean => {
      if (typeof window === 'undefined') return false;
      if (isSynthesisActive() || isSpeaking) return false;

      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) return false;

      if (recognitionRestartTimerRef.current) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      recognitionRestartScheduledRef.current = false;

      const recognition = new Recognition();
      recognition.continuous = options.continuous ?? true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionCallbacksRef.current = {
        onTranscript: options.onTranscript,
        onError: options.onError,
      };
      listeningActiveRef.current = true;

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result?.[0]) continue;
          const piece = result[0].transcript ?? '';
          if (result.isFinal) finalText += piece;
          else interimText += piece;
        }
        const combined = `${finalText}${interimText}`.trim();
        let hasFinal = false;
        for (let j = 0; j < event.results.length; j += 1) {
          if (event.results[j]?.isFinal) {
            hasFinal = true;
            break;
          }
        }
        recognitionCallbacksRef.current?.onTranscript(combined, hasFinal);
      };
      recognition.onerror = (event) => {
        const code = event.error ?? 'speech-recognition-error';
        if (recognitionHandoffRef.current || isBenignRecognitionError(code)) {
          return;
        }
        if (isNoSpeechError(code)) {
          recognitionCallbacksRef.current?.onError?.(code);
          return;
        }
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
          listeningActiveRef.current = false;
        }
        recognitionCallbacksRef.current?.onError?.(code);
      };
      recognition.onend = () => {
        if (!listeningActiveRef.current || recognitionRef.current !== recognition) {
          setIsListening(false);
          recognitionRestartScheduledRef.current = false;
          return;
        }
        /** Edge: auto-restart fights MediaRecorder and causes silent drops. */
        if (isEdgeBrowser()) {
          setIsListening(false);
          recognitionRestartScheduledRef.current = false;
          return;
        }
        if (recognitionRestartScheduledRef.current) return;
        recognitionRestartScheduledRef.current = true;

        recognitionRestartTimerRef.current = window.setTimeout(() => {
          recognitionRestartTimerRef.current = null;
          recognitionRestartScheduledRef.current = false;
          if (!listeningActiveRef.current || recognitionRef.current !== recognition) {
            setIsListening(false);
            return;
          }
          if (isSynthesisActive()) {
            setIsListening(false);
            return;
          }
          try {
            recognition.start();
          } catch {
            listeningActiveRef.current = false;
            setIsListening(false);
          }
        }, sttRecognitionRestartDelay());
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        listeningActiveRef.current = false;
        setIsListening(false);
        return false;
      }
      return true;
    },
    [isSpeaking],
  );

  const stopListening = useCallback(() => {
    stopListeningInternal(true);
  }, [stopListeningInternal]);

  useEffect(() => {
    return () => {
      listeningActiveRef.current = false;
      if (recognitionRestartTimerRef.current) {
        window.clearTimeout(recognitionRestartTimerRef.current);
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      const active = recognitionRef.current;
      if (active) {
        active.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    updateSpeakingRate,
    releaseAudioForListening,
    isSynthesisActive,
    startListening,
    stopListening,
    isSpeaking,
    isListening,
    speechApisReady,
    isSpeechRecognitionSupported,
    isSpeechSynthesisSupported,
  };
}
