'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSpeech } from '@/hooks/useSpeech';
import { interviewVoiceApi } from '@/lib/interview-voice-api';
import {
  decodeInterviewSpeechBase64,
  isPlayableInterviewSpeechBase64,
} from '@/lib/interviewVoicePlayback';
import { getApiErrorMessage } from '@/lib/axios';
import { INTERVIEW_QUESTION_SPEAK_PAUSE_MS, sleep } from '@/lib/interviewSpeech';

type CacheEntry = {
  objectUrl: string;
  audioBase64: string;
};

export type InterviewVoicePlaybackIssue =
  | { kind: 'browser_fallback' }
  | {
      kind: 'disabled';
      disabledReason?: string;
      requestId?: string | null;
    }
  | {
      kind: 'network_error';
      message: string;
      requestId?: string | null;
    }
  | {
      kind: 'autoplay_blocked';
      requestId?: string | null;
    }
  | {
      kind: 'no_session';
      message: string;
    };

type FetchSpeechResult =
  | { status: 'ok'; entry: CacheEntry; requestId: string | null }
  | {
      status: 'disabled';
      disabledReason?: string;
      requestId: string | null;
    }
  | { status: 'error'; message: string; requestId: string | null };

function cacheKey(sessionId: string, text: string, persona?: string, speed?: number): string {
  const speedKey = typeof speed === 'number' ? Math.round(speed * 100) / 100 : 1;
  return `${sessionId}|${persona ?? ''}|${speedKey}|${text.trim()}`;
}

export type UseInterviewTTSOptions = {
  sessionId: string | null;
  interviewPersona?: string;
  speakingSpeed?: number;
  voiceName?: string;
  voiceRate?: number;
  voicePitch?: number;
};

export type SpeakInterviewerOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number) => void;
  skipLeadPause?: boolean;
  leadPauseMs?: number;
  /** When true, still call onEnd after a disabled/error response so the session can advance. */
  advanceOnUnavailable?: boolean;
};

export function useInterviewTTS(options: UseInterviewTTSOptions) {
  const { sessionId, interviewPersona, speakingSpeed = 1, voiceName, voiceRate = 1, voicePitch = 1 } =
    options;

  const speech = useSpeech();
  const {
    stopSpeaking: browserStopSpeaking,
    stopListening: browserStopListening,
    speak: browserSpeak,
    isSpeaking: browserIsSpeaking,
    isSynthesisActive: browserIsSynthesisActive,
    releaseAudioForListening,
    updateSpeakingRate,
    isSpeechSynthesisSupported,
    speechApisReady,
  } = speech;

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const inflightRef = useRef<Map<string, Promise<FetchSpeechResult>>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakGenRef = useRef(0);
  const lastSpeakTextRef = useRef('');
  const lastSpeakOptionsRef = useRef<SpeakInterviewerOptions>({});
  /** After ElevenLabs fails once, use browser voice for the rest of the session (faster, reliable). */
  const preferBrowserVoiceRef = useRef(false);
  const fallbackNoticeShownRef = useRef(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [usingBrowserVoice, setUsingBrowserVoice] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [usesElevenLabs, setUsesElevenLabs] = useState(false);
  const [playbackIssue, setPlaybackIssue] = useState<InterviewVoicePlaybackIssue | null>(null);

  const stopAudioElement = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.onended = null;
      audio.onerror = null;
    }
    audioRef.current = null;
  }, []);

  const stop = useCallback(() => {
    speakGenRef.current += 1;
    stopAudioElement();
    browserStopSpeaking();
    setIsSpeaking(false);
    setIsGeneratingVoice(false);
  }, [browserStopSpeaking, stopAudioElement]);

  const fetchSpeech = useCallback(
    async (text: string): Promise<FetchSpeechResult> => {
      if (!sessionId || !text.trim()) {
        return { status: 'error', message: 'Missing session or text for voice.', requestId: null };
      }

      const key = cacheKey(sessionId, text, interviewPersona, speakingSpeed);
      const cached = cacheRef.current.get(key);
      if (cached) {
        if (isPlayableInterviewSpeechBase64(cached.audioBase64)) {
          return { status: 'ok', entry: cached, requestId: null };
        }
        cacheRef.current.delete(key);
      }

      const inflight = inflightRef.current.get(key);
      if (inflight) return inflight;

      const request = (async (): Promise<FetchSpeechResult> => {
        try {
          const { data, requestId } = await interviewVoiceApi.synthesizeInterviewerSpeech(sessionId, {
            text: text.trim(),
            interviewPersona,
            speakingSpeed,
          });

          if (data.disabled || !data.audioBase64?.trim()) {
            return {
              status: 'disabled',
              disabledReason: data.disabledReason,
              requestId,
            };
          }

          if (!isPlayableInterviewSpeechBase64(data.audioBase64)) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[interview-tts] /speech returned unusable audio (stub or too small)', {
                requestId,
                cacheHit: data.cacheHit,
                base64Length: data.audioBase64.length,
              });
            }
            return {
              status: 'disabled',
              disabledReason: data.disabledReason ?? 'empty_audio',
              requestId,
            };
          }

          const blob = decodeInterviewSpeechBase64(data.audioBase64, data.contentType);
          const objectUrl = URL.createObjectURL(blob);
          const entry: CacheEntry = { objectUrl, audioBase64: data.audioBase64 };
          cacheRef.current.set(key, entry);
          return { status: 'ok', entry, requestId };
        } catch (err) {
          return {
            status: 'error',
            message: getApiErrorMessage(err),
            requestId: null,
          };
        } finally {
          inflightRef.current.delete(key);
        }
      })();

      inflightRef.current.set(key, request);
      return request;
    },
    [interviewPersona, sessionId, speakingSpeed],
  );

  const prefetch = useCallback(
    (text: string) => {
      if (!sessionId || !text.trim()) return;
      const key = cacheKey(sessionId, text, interviewPersona, speakingSpeed);
      if (cacheRef.current.has(key) || inflightRef.current.has(key)) return;
      void fetchSpeech(text);
    },
    [fetchSpeech, interviewPersona, sessionId, speakingSpeed],
  );

  useEffect(() => {
    preferBrowserVoiceRef.current = false;
    fallbackNoticeShownRef.current = false;
    setUsingBrowserVoice(false);
    setPlaybackIssue(null);
  }, [sessionId]);

  const markBrowserFallback = useCallback(() => {
    preferBrowserVoiceRef.current = true;
    setUsingBrowserVoice(true);
    setUsesElevenLabs(false);
    if (!fallbackNoticeShownRef.current) {
      fallbackNoticeShownRef.current = true;
      setPlaybackIssue({ kind: 'browser_fallback' });
    }
  }, []);

  const speakWithDeviceVoice = useCallback(
    (text: string, speakOptions: SpeakInterviewerOptions = {}): Promise<void> => {
      const clean = text.trim();
      if (!clean) {
        speakOptions.onEnd?.();
        return Promise.resolve();
      }
      markBrowserFallback();
      return new Promise((resolve) => {
        browserSpeak(clean, {
          voiceName,
          rate: voiceRate,
          pitch: voicePitch,
          onStart: speakOptions.onStart,
          onEnd: () => {
            speakOptions.onEnd?.();
            resolve();
          },
          onBoundary: speakOptions.onBoundary,
        });
      });
    },
    [browserSpeak, markBrowserFallback, voiceName, voicePitch, voiceRate],
  );

  const attemptBrowserFallback = useCallback(
    (
      clean: string,
      speakOptions: SpeakInterviewerOptions,
      generation: number,
    ): Promise<boolean> => {
      if (!isSpeechSynthesisSupported) return Promise.resolve(false);
      markBrowserFallback();
      return new Promise((resolve) => {
        browserSpeak(clean, {
          voiceName,
          rate: voiceRate,
          pitch: voicePitch,
          onStart: () => {
            if (generation !== speakGenRef.current) return;
            setIsSpeaking(true);
            speakOptions.onStart?.();
          },
          onEnd: () => {
            if (generation !== speakGenRef.current) {
              resolve(false);
              return;
            }
            setIsSpeaking(false);
            resolve(true);
          },
          onBoundary: speakOptions.onBoundary,
        });
      });
    },
    [
      browserSpeak,
      isSpeechSynthesisSupported,
      markBrowserFallback,
      voiceName,
      voicePitch,
      voiceRate,
    ],
  );

  const speak = useCallback(
    (text: string, speakOptions: SpeakInterviewerOptions = {}): Promise<void> => {
      const userOnEnd = speakOptions.onEnd;
      const finish = () => {
        userOnEnd?.();
      };

      return new Promise((resolve) => {
        const complete = () => {
          finish();
          resolve();
        };

        void (async () => {
          const generation = ++speakGenRef.current;
          const clean = text.trim();
          lastSpeakTextRef.current = clean;
          lastSpeakOptionsRef.current = speakOptions;

          if (!clean) {
            complete();
            return;
          }

          browserStopListening();
          stopAudioElement();
          setPlaybackIssue((prev) => (prev?.kind === 'browser_fallback' ? prev : null));

          if (!sessionId) {
            const browserOk = await attemptBrowserFallback(clean, speakOptions, generation);
            if (browserOk) {
              complete();
              return;
            }
            setPlaybackIssue({
              kind: 'no_session',
              message: 'Interview session is not ready for voice playback yet.',
            });
            if (speakOptions.advanceOnUnavailable !== false) {
              complete();
            } else {
              resolve();
            }
            return;
          }

          const endIfStale = () => {
            if (generation !== speakGenRef.current) {
              if (speakOptions.advanceOnUnavailable !== false) {
                complete();
              } else {
                resolve();
              }
              return true;
            }
            return false;
          };

          if (!speakOptions.skipLeadPause) {
            const leadMs = speakOptions.leadPauseMs ?? INTERVIEW_QUESTION_SPEAK_PAUSE_MS;
            if (leadMs > 0) {
              await sleep(leadMs);
              if (endIfStale()) return;
            }
          }

          if (preferBrowserVoiceRef.current && isSpeechSynthesisSupported) {
            const browserOk = await attemptBrowserFallback(clean, speakOptions, generation);
            if (endIfStale()) return;
            if (browserOk) {
              complete();
              return;
            }
          }

          setIsGeneratingVoice(true);
          const fetched = await fetchSpeech(clean);
          if (endIfStale()) {
            setIsGeneratingVoice(false);
            return;
          }
          setIsGeneratingVoice(false);

          if (fetched.status === 'disabled') {
            const browserOk = await attemptBrowserFallback(clean, speakOptions, generation);
            if (endIfStale()) return;
            if (browserOk) {
              complete();
              return;
            }
            setPlaybackIssue({
              kind: 'disabled',
              disabledReason: fetched.disabledReason,
              requestId: fetched.requestId,
            });
            if (speakOptions.advanceOnUnavailable !== false) {
              complete();
            } else {
              resolve();
            }
            return;
          }

          if (fetched.status === 'error') {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[interview-tts] /speech failed:', fetched.message);
            }
            const browserOk = await attemptBrowserFallback(clean, speakOptions, generation);
            if (endIfStale()) return;
            if (browserOk) {
              complete();
              return;
            }
            setPlaybackIssue({
              kind: 'network_error',
              message: fetched.message,
              requestId: fetched.requestId,
            });
            if (speakOptions.advanceOnUnavailable !== false) {
              complete();
            } else {
              resolve();
            }
            return;
          }

          const entry = fetched.entry;
          setUsesElevenLabs(true);
          const audio = new Audio(entry.objectUrl);
          audio.volume = 1;
          audioRef.current = audio;
          audio.onplay = () => {
            if (generation !== speakGenRef.current) return;
            setIsSpeaking(true);
            speakOptions.onStart?.();
          };
          audio.onended = () => {
            if (generation !== speakGenRef.current) return;
            setIsSpeaking(false);
            audioRef.current = null;
            complete();
          };
          audio.onerror = () => {
            if (generation !== speakGenRef.current) return;
            setIsSpeaking(false);
            audioRef.current = null;
            void (async () => {
              const browserOk = await attemptBrowserFallback(clean, speakOptions, generation);
              if (generation !== speakGenRef.current) return;
              if (browserOk) {
                complete();
                return;
              }
              setPlaybackIssue({
                kind: 'network_error',
                message: 'Audio playback failed.',
                requestId: fetched.requestId,
              });
              if (speakOptions.advanceOnUnavailable !== false) {
                complete();
              } else {
                resolve();
              }
            })();
          };

          try {
            await audio.play();
          } catch (err) {
            if (generation !== speakGenRef.current) {
              resolve();
              return;
            }
            stopAudioElement();
            const browserOk = await attemptBrowserFallback(clean, speakOptions, generation);
            if (endIfStale()) return;
            if (browserOk) {
              complete();
              return;
            }
            const isAutoplay =
              err instanceof DOMException &&
              (err.name === 'NotAllowedError' || err.name === 'NotSupportedError');
            if (isAutoplay) {
              const retryBrowser = await attemptBrowserFallback(clean, speakOptions, generation);
              if (retryBrowser) {
                complete();
                return;
              }
              setPlaybackIssue({ kind: 'autoplay_blocked', requestId: fetched.requestId });
            } else {
              setPlaybackIssue({
                kind: 'network_error',
                message: 'Could not play interviewer audio.',
                requestId: fetched.requestId,
              });
            }
            if (speakOptions.advanceOnUnavailable !== false) {
              complete();
            } else {
              resolve();
            }
          }
        })();
      });
    },
    [
      attemptBrowserFallback,
      browserStopListening,
      fetchSpeech,
      isSpeechSynthesisSupported,
      sessionId,
      stopAudioElement,
    ],
  );

  const retryLastSpeech = useCallback(() => {
    const text = lastSpeakTextRef.current;
    if (!text || !sessionId) return;
    preferBrowserVoiceRef.current = false;
    fallbackNoticeShownRef.current = false;
    setUsingBrowserVoice(false);
    setPlaybackIssue(null);
    const key = cacheKey(sessionId, text, interviewPersona, speakingSpeed);
    cacheRef.current.delete(key);
    stop();
    void speak(text, { ...lastSpeakOptionsRef.current, skipLeadPause: true });
  }, [interviewPersona, sessionId, speak, speakingSpeed, stop]);

  const useDeviceVoiceForLastLine = useCallback(() => {
    const text = lastSpeakTextRef.current;
    if (!text) return;
    stop();
    speakWithDeviceVoice(text, lastSpeakOptionsRef.current);
  }, [speakWithDeviceVoice, stop]);

  const clearPlaybackIssue = useCallback(() => {
    setPlaybackIssue(null);
  }, []);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const isInterviewerAudioActive = isSpeaking || browserIsSynthesisActive();

  useEffect(() => {
    return () => {
      stopRef.current();
      for (const entry of cacheRef.current.values()) {
        URL.revokeObjectURL(entry.objectUrl);
      }
      cacheRef.current.clear();
      inflightRef.current.clear();
    };
  }, []);

  return useMemo(
    () => ({
      speak,
      stop,
      prefetch,
      retryLastSpeech,
      useDeviceVoiceForLastLine,
      speakWithDeviceVoice,
      playbackIssue,
      clearPlaybackIssue,
      isSpeaking: isSpeaking || browserIsSpeaking,
      isInterviewerAudioActive,
      isGeneratingVoice,
      usesElevenLabs,
      usingBrowserVoice,
      /** Prefer `isInterviewerAudioActive` in effect deps (stable boolean). */
      isSynthesisActive: () => isInterviewerAudioActive,
      releaseAudioForListening,
      updateSpeakingRate,
      isSpeechSynthesisSupported,
      speechApisReady,
    }),
    [
      browserIsSpeaking,
      isGeneratingVoice,
      isInterviewerAudioActive,
      isSpeaking,
      clearPlaybackIssue,
      playbackIssue,
      prefetch,
      releaseAudioForListening,
      retryLastSpeech,
      speak,
      speakWithDeviceVoice,
      speechApisReady,
      isSpeechSynthesisSupported,
      stop,
      updateSpeakingRate,
      useDeviceVoiceForLastLine,
      usesElevenLabs,
      usingBrowserVoice,
    ],
  );
}
