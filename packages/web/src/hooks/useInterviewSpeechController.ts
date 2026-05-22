'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHybridSpeech } from '@/hooks/useHybridSpeech';
import {
  isNoSpeechError,
  isTurnAnswerLongEnough,
  TURN_ANSWER_MIN_CHARS,
  resolveAnswerSource,
  shouldFallbackToManual,
  shouldRetryStt,
  speechErrorMessage,
  SPEECH_FAILED_LABEL,
  SPEECH_PROCESSING_LABEL,
  STT_MAX_CONSECUTIVE_FAILURES,
  STT_TRANSCRIPT_DEBOUNCE_MS,
  type SpeechError,
  type RecordingState,
  type TranscriptionState,
  type VoiceHealth,
  type VoiceProcessingStatus,
  type VoiceUiStatus,
} from '@/lib/interviewSpeech';

export type InterviewSpeechMode = 'browser_stt' | 'manual';

export type UseInterviewSpeechControllerOptions = {
  blocked?: boolean;
  sessionId?: string | null;
  /** Only set during `answering` so intro is not uploaded against Q1 turn. */
  turnId?: string | null;
};

export function useInterviewSpeechController(options: UseInterviewSpeechControllerOptions = {}) {
  const { blocked = false, sessionId = null, turnId = null } = options;

  const useWhisperPath = Boolean(sessionId && turnId);
  const hybrid = useHybridSpeech({ sessionId, turnId, blocked });
  const speech = hybrid.speech;

  const [inputMode, setInputMode] = useState<'voice' | 'type'>('type');
  const [mode, setMode] = useState<InterviewSpeechMode>('browser_stt');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscriptState] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);
  const [voiceHealth, setVoiceHealth] = useState<VoiceHealth>('good');
  const [fellBackToManual, setFellBackToManual] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<VoiceProcessingStatus>('idle');
  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState>('idle');
  const [transcriptionMessage, setTranscriptionMessage] = useState<string | null>(null);
  const [usedDeviceCaptions, setUsedDeviceCaptions] = useState(false);

  const sttFinalRef = useRef('');
  const sttInterimRef = useRef('');
  const userEditedRef = useRef(false);
  const usedBrowserSttRef = useRef(false);
  const usedWhisperRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const restartLoopsRef = useRef(0);
  const debounceTimerRef = useRef<number | null>(null);
  const appliedDefaultVoiceRef = useRef(false);
  const listenEpochRef = useRef(0);
  const stopEpochRef = useRef(0);
  const isRecordingRef = useRef(false);
  const lastBrowserInterimRef = useRef('');

  const isSupported = useWhisperPath
    ? hybrid.recorder.isSupported || hybrid.isSpeechRecognitionSupported
    : speech.isSpeechRecognitionSupported;

  const applyTranscript = useCallback((text: string, source: 'whisper' | 'browser') => {
    if (userEditedRef.current) return;
    const trimmed = text.trim();
    setTranscriptState(trimmed);
    setInterimTranscript('');
    sttFinalRef.current = trimmed;
    sttInterimRef.current = '';
    if (source === 'whisper') {
      usedWhisperRef.current = true;
      usedBrowserSttRef.current = false;
    } else {
      usedBrowserSttRef.current = true;
      usedWhisperRef.current = false;
    }
  }, []);

  const flushTranscriptToState = useCallback((finalText: string, interim: string) => {
    if (userEditedRef.current) return;
    const display = `${finalText}${interim}`.trim();
    setTranscriptState(display);
    setInterimTranscript(interim.trim());
  }, []);

  const scheduleTranscriptUpdate = useCallback(
    (combined: string, hasFinal: boolean) => {
      if (userEditedRef.current) return;

      let finalPart = '';
      let interimPart = '';
      if (hasFinal) {
        finalPart = combined;
        interimPart = '';
        sttFinalRef.current = combined;
        sttInterimRef.current = '';
      } else {
        interimPart = combined.startsWith(sttFinalRef.current)
          ? combined.slice(sttFinalRef.current.length)
          : combined;
        sttInterimRef.current = interimPart;
        finalPart = sttFinalRef.current;
      }

      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        flushTranscriptToState(finalPart, interimPart);
        if (hasFinal && finalPart.trim()) {
          consecutiveFailuresRef.current = 0;
          if (voiceHealth !== 'good') setVoiceHealth('good');
        }
      }, STT_TRANSCRIPT_DEBOUNCE_MS);
    },
    [flushTranscriptToState, voiceHealth],
  );

  const switchToManualMode = useCallback(
    (reason?: string) => {
      if (useWhisperPath) {
        hybrid.reset();
      } else {
        speech.stopListening();
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      setProcessingStatus('idle');
      setTranscriptionState('idle');
      setTranscriptionMessage(null);
      setMode('manual');
      setInputMode('type');
      setFellBackToManual(true);
      setVoiceHealth('fallback');
      if (reason) {
        setError({ code: 'fallback', message: reason, recoverable: true });
      }
    },
    [hybrid, speech, useWhisperPath],
  );

  const handleSttErrorRef = useRef<(code: string) => void>(() => {});

  const handleSttError = useCallback(
    (code: string) => {
      if (shouldFallbackToManual(code)) {
        consecutiveFailuresRef.current = STT_MAX_CONSECUTIVE_FAILURES;
        switchToManualMode(speechErrorMessage(code));
        return;
      }
      if (isNoSpeechError(code)) {
        setError({ code, message: speechErrorMessage(code), recoverable: true });
        return;
      }
      if (shouldRetryStt(code)) {
        consecutiveFailuresRef.current += 1;
        restartLoopsRef.current += 1;
        if (restartLoopsRef.current >= 3) setVoiceHealth('unstable');
        setError({ code, message: speechErrorMessage(code), recoverable: true });
        if (consecutiveFailuresRef.current >= STT_MAX_CONSECUTIVE_FAILURES) {
          switchToManualMode(
            'Voice input is having trouble. We switched you to typing so you can keep going.',
          );
        }
        return;
      }
      consecutiveFailuresRef.current += 1;
      setError({ code, message: speechErrorMessage(code), recoverable: true });
      if (consecutiveFailuresRef.current >= STT_MAX_CONSECUTIVE_FAILURES) {
        switchToManualMode(
          'Voice input is having trouble. We switched you to typing so you can keep going.',
        );
      } else {
        setVoiceHealth('unstable');
      }
    },
    [switchToManualMode],
  );

  handleSttErrorRef.current = handleSttError;

  const startBrowserOnly = useCallback(async () => {
    listenEpochRef.current += 1;
    const epoch = listenEpochRef.current;

    if (!userEditedRef.current) {
      sttFinalRef.current = '';
      sttInterimRef.current = '';
      setTranscriptState('');
      setInterimTranscript('');
    }

    setError(null);
    setTranscriptionState('idle');
    setTranscriptionMessage(null);
    await speech.releaseAudioForListening();
    if (epoch !== listenEpochRef.current) return false;

    const started = speech.startListening({
      onTranscript: (text, hasFinal) => {
        if (epoch !== listenEpochRef.current) return;
        usedBrowserSttRef.current = true;
        scheduleTranscriptUpdate(text, hasFinal);
      },
      onError: (err) => {
        if (epoch !== listenEpochRef.current) return;
        handleSttErrorRef.current(err);
      },
      continuous: true,
    });

    return started;
  }, [scheduleTranscriptUpdate, speech]);

  const start = useCallback(async () => {
    if (blocked || !isSupported || mode === 'manual' || inputMode === 'type') return;
    if (speech.isSpeaking || speech.isSynthesisActive()) return;

    setError(null);
    setTranscriptionState('idle');
    setTranscriptionMessage(null);
    setUsedDeviceCaptions(false);
    setProcessingStatus('recording');

    if (useWhisperPath) {
      const started = await hybrid.start();
      if (started) {
        setMode('browser_stt');
        const rs = hybrid.recordingState;
        const activelyRecording = rs === 'recording';
        isRecordingRef.current = activelyRecording;
        setIsRecording(activelyRecording);
        setProcessingStatus(activelyRecording ? 'recording' : 'idle');
      } else {
        isRecordingRef.current = false;
        setIsRecording(false);
        setProcessingStatus('idle');
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= STT_MAX_CONSECUTIVE_FAILURES) {
          switchToManualMode('Could not start voice input. Please type your answer.');
        }
      }
      return;
    }

    const started = await startBrowserOnly();
    if (started) {
      isRecordingRef.current = true;
      setIsRecording(true);
      setMode('browser_stt');
      setProcessingStatus('recording');
    } else {
      isRecordingRef.current = false;
      setIsRecording(false);
      setProcessingStatus('idle');
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= STT_MAX_CONSECUTIVE_FAILURES) {
        switchToManualMode('Could not start voice input. Please type your answer.');
      }
    }
  }, [
    blocked,
    hybrid,
    inputMode,
    isSupported,
    mode,
    speech,
    startBrowserOnly,
    switchToManualMode,
    useWhisperPath,
  ]);

  const handleStopResult = useCallback(
    (epochAtStop: number) => {
      void hybrid.stop().then((result) => {
        if (epochAtStop !== stopEpochRef.current) return;

        setProcessingStatus('idle');

        if (result.status === 'failed') {
          const partialBrowser = hybrid.browserInterim.trim();
          if (
            partialBrowser.length >= TURN_ANSWER_MIN_CHARS &&
            !userEditedRef.current
          ) {
            setTranscriptionState('success');
            setTranscriptionMessage(null);
            setError(null);
            applyTranscript(partialBrowser, 'browser');
            consecutiveFailuresRef.current = 0;
            return;
          }
          setTranscriptionState('failed');
          setTranscriptionMessage(result.message || SPEECH_FAILED_LABEL);
          setError({
            code: result.errorCode ?? 'transcription-failed',
            message: result.message,
            recoverable: true,
          });
          if (!userEditedRef.current) {
            setTranscriptState('');
            setInterimTranscript('');
            sttFinalRef.current = '';
          }
          consecutiveFailuresRef.current += 1;
          return;
        }

        const t =
          result.status === 'ok' || result.status === 'browser_only'
            ? result.transcript
            : null;

        if (!t?.text.trim()) {
          setTranscriptionState('failed');
          setTranscriptionMessage(SPEECH_FAILED_LABEL);
          setError({
            code: 'transcription-failed',
            message: SPEECH_FAILED_LABEL,
            recoverable: true,
          });
          if (!userEditedRef.current) setTranscriptState('');
          return;
        }

        setTranscriptionState('success');
        setTranscriptionMessage(null);
        setError(null);
        setUsedDeviceCaptions(
          Boolean(t.fallbackRequired) || result.status === 'browser_only',
        );
        applyTranscript(t.text, t.source === 'whisper' ? 'whisper' : 'browser');
        consecutiveFailuresRef.current = 0;
        if (voiceHealth !== 'good') setVoiceHealth('good');
        /** `fallbackRequired` alone must not switch to typing — user reviews transcript first. */
      });
    },
    [applyTranscript, hybrid, voiceHealth],
  );

  const stop = useCallback(() => {
    if (useWhisperPath) {
      const rs = hybrid.recordingState;
      if (rs !== 'recording' && !isRecordingRef.current) return;
      const epochAtStop = ++stopEpochRef.current;
      isRecordingRef.current = false;
      setIsRecording(false);
      setProcessingStatus('whisper');
      setTranscriptionState('processing');
      setTranscriptionMessage(SPEECH_PROCESSING_LABEL);
      handleStopResult(epochAtStop);
      return;
    }

    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    listenEpochRef.current += 1;
    speech.stopListening();
    setIsRecording(false);
    setProcessingStatus('idle');
    setTranscriptionState('idle');
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    flushTranscriptToState(sttFinalRef.current, '');
    setInterimTranscript('');
    if (!sttFinalRef.current.trim()) {
      setTranscriptionState('failed');
      setTranscriptionMessage(SPEECH_FAILED_LABEL);
    } else {
      setTranscriptionState('success');
    }
  }, [flushTranscriptToState, handleStopResult, speech, useWhisperPath]);

  const retryCapture = useCallback(() => {
    setTranscriptionState('idle');
    setTranscriptionMessage(null);
    setError(null);
    if (!userEditedRef.current) {
      setTranscriptState('');
      sttFinalRef.current = '';
    }
    void start();
  }, [start]);

  const reset = useCallback(() => {
    stopEpochRef.current += 1;
    if (useWhisperPath) hybrid.reset();
    else {
      listenEpochRef.current += 1;
      speech.stopListening();
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setProcessingStatus('idle');
    setTranscriptionState('idle');
    setTranscriptionMessage(null);
    setUsedDeviceCaptions(false);
    sttFinalRef.current = '';
    sttInterimRef.current = '';
    userEditedRef.current = false;
    usedBrowserSttRef.current = false;
    usedWhisperRef.current = false;
    consecutiveFailuresRef.current = 0;
    restartLoopsRef.current = 0;
    setTranscriptState('');
    setInterimTranscript('');
    setError(null);
    if (!fellBackToManual) setVoiceHealth('good');
  }, [fellBackToManual, hybrid, speech, useWhisperPath]);

  const setTranscript = useCallback((value: string) => {
    userEditedRef.current = true;
    sttFinalRef.current = value;
    sttInterimRef.current = '';
    setTranscriptState(value);
    setInterimTranscript('');
    if (value.trim()) {
      setTranscriptionState('success');
      setTranscriptionMessage(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!speech.speechApisReady) return;
    if (!isSupported) {
      setInputMode('type');
      setMode('manual');
      return;
    }
    if (!appliedDefaultVoiceRef.current) {
      appliedDefaultVoiceRef.current = true;
      setInputMode('voice');
      setMode('browser_stt');
    }
  }, [isSupported, speech.speechApisReady]);

  useEffect(() => {
    if (!useWhisperPath || !isRecording || userEditedRef.current) return;
    const live = hybrid.browserInterim.trim();
    if (!live || live === lastBrowserInterimRef.current) return;
    lastBrowserInterimRef.current = live;
    setTranscriptState(live);
    setInterimTranscript('');
  }, [hybrid.browserInterim, isRecording, useWhisperPath]);

  useEffect(() => {
    if (!useWhisperPath) return;
    const rs = hybrid.recordingState;
    if (rs === 'recording') {
      isRecordingRef.current = true;
      setIsRecording(true);
      setProcessingStatus('recording');
      return;
    }
    if (rs === 'arming') {
      isRecordingRef.current = false;
      setIsRecording(false);
      setProcessingStatus('recording');
      return;
    }
    if (hybrid.isTranscribing || rs === 'transcribing' || rs === 'finalizing') {
      isRecordingRef.current = false;
      setIsRecording(false);
      setProcessingStatus('whisper');
      setTranscriptionState('processing');
      setTranscriptionMessage(SPEECH_PROCESSING_LABEL);
    }
    if (rs === 'ready') {
      isRecordingRef.current = false;
      setIsRecording(false);
      setProcessingStatus('idle');
    }
  }, [hybrid.isTranscribing, hybrid.recordingState, useWhisperPath]);

  const recordingState: RecordingState = useMemo(() => {
    if (useWhisperPath) {
      if (transcriptionState === 'failed') return 'failed';
      return hybrid.recordingState;
    }
    if (transcriptionState === 'processing') return 'transcribing';
    if (transcriptionState === 'failed') return 'failed';
    if (transcriptionState === 'success') return 'ready';
    if (isRecording) return 'recording';
    return 'idle';
  }, [
    hybrid.recordingState,
    isRecording,
    transcriptionState,
    useWhisperPath,
  ]);

  const isTtsActive = speech.isSpeaking || speech.isSynthesisActive();

  useEffect(() => {
    if (isTtsActive && isRecording) stop();
  }, [isTtsActive, isRecording, stop]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const uiStatus: VoiceUiStatus = useMemo(() => {
    if (
      recordingState === 'transcribing' ||
      recordingState === 'finalizing' ||
      transcriptionState === 'processing'
    ) {
      return 'speech_processing';
    }
    if (recordingState === 'failed' || transcriptionState === 'failed') return 'speech_failed';
    if (processingStatus === 'whisper') return 'speech_processing';
    if (fellBackToManual || voiceHealth === 'fallback') return 'fallback';
    if (inputMode === 'type' || mode === 'manual') return 'manual';
    if (isTtsActive || speech.isSpeaking) return 'paused_tts';
    if (recordingState === 'arming') return 'speech_processing';
    if (recordingState === 'recording' || isRecording) return 'listening';
    if (recordingState === 'ready') return 'idle';
    return 'idle';
  }, [
    fellBackToManual,
    inputMode,
    isRecording,
    isTtsActive,
    mode,
    processingStatus,
    recordingState,
    speech.isSpeaking,
    transcriptionState,
    voiceHealth,
  ]);

  const isTranscriptReady = useMemo(() => {
    if (transcriptionState === 'processing') return false;
    if (transcriptionState === 'failed') return false;
    return transcript.trim().length > 0 || inputMode === 'type';
  }, [inputMode, transcript, transcriptionState]);

  const getAnswerSource = useCallback(
    () =>
      resolveAnswerSource({
        inputMode,
        usedBrowserStt: usedBrowserSttRef.current,
        usedWhisper: usedWhisperRef.current,
        userEditedTranscript: userEditedRef.current,
        fellBackToManual,
      }),
    [fellBackToManual, inputMode],
  );

  return {
    ...speech,
    isRecording,
    transcript,
    interimTranscript: useWhisperPath ? hybrid.browserInterim : interimTranscript,
    error,
    start,
    stop,
    reset,
    retryCapture,
    mode,
    isSupported,
    inputMode,
    setInputMode,
    setTranscript,
    voiceHealth,
    uiStatus,
    processingStatus,
    transcriptionState,
    transcriptionMessage,
    usedDeviceCaptions,
    isTranscriptReady,
    isTranscribing: useWhisperPath ? hybrid.isTranscribing : false,
    recordingState,
    getAnswerSource,
    fellBackToManual,
    useWhisperPath,
    isAnswerLongEnough: (text: string) => isTurnAnswerLongEnough(text),
  };
}
