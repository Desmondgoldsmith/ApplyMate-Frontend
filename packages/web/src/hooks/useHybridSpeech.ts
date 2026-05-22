'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSpeech } from '@/hooks/useSpeech';
import { interviewVoiceApi } from '@/lib/interview-voice-api';
import {
  clientBrowserLabel,
  getCachedRecordingStrategy,
  loadRecordingStrategy,
  minBlobBytesFromStrategy,
} from '@/lib/interviewRecordingStrategy';
import { TranscriptionFailedError } from '@/lib/interviewTranscriptionErrors';
import {
  collapseSpeechTranscript,
  mapApiTranscriptionSource,
  RECORDING_MIN_VALID_BYTES,
  STT_TRANSCRIPT_DEBOUNCE_MS,
  WHISPER_UPLOAD_MAX_RETRIES,
  type HybridStopResult,
  type HybridTranscript,
  type RecordingState,
} from '@/lib/interviewSpeech';

export type UseHybridSpeechOptions = {
  sessionId: string | null;
  turnId: string | null;
  blocked?: boolean;
};

export function useHybridSpeech(options: UseHybridSpeechOptions) {
  const { sessionId, turnId, blocked = false } = options;

  const speech = useSpeech();
  const strategy = getCachedRecordingStrategy();
  const recorder = useAudioRecorder({ recordingStrategy: strategy });

  const [isListening, setIsListening] = useState(false);
  const [browserInterim, setBrowserInterim] = useState('');
  const [lastResult, setLastResult] = useState<HybridTranscript | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  const [recorderFailed, setRecorderFailed] = useState(false);
  const [captureState, setCaptureState] = useState<RecordingState>('idle');

  const browserFinalRef = useRef('');
  const browserLiveRef = useRef('');
  const listenEpochRef = useRef(0);
  const stopEpochRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const usedWhisperRef = useRef(false);
  const usedBrowserRef = useRef(false);
  const activeTurnIdRef = useRef<string | null>(turnId);

  activeTurnIdRef.current = turnId;

  const whisperEnabled = Boolean(sessionId && turnId);

  useEffect(() => {
    void loadRecordingStrategy(() => interviewVoiceApi.getRecordingStrategy());
  }, []);

  const scheduleBrowserUpdate = useCallback((text: string, hasFinal: boolean) => {
    const collapsed = collapseSpeechTranscript(text);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      if (hasFinal && collapsed) {
        browserFinalRef.current = collapsed;
        browserLiveRef.current = collapsed;
        usedBrowserRef.current = true;
      } else if (collapsed) {
        browserLiveRef.current = collapsed;
      }
      setBrowserInterim((prev) => (prev === collapsed ? prev : collapsed));
    }, STT_TRANSCRIPT_DEBOUNCE_MS);
  }, []);

  const buildBrowserOnlyResult = useCallback(
    (browserText: string, epoch: number, fallbackRequired = false): HybridStopResult => {
      const transcript: HybridTranscript = {
        text: browserText,
        source: 'browser',
        fallbackRequired,
      };
      usedBrowserRef.current = true;
      usedWhisperRef.current = false;
      setLastResult(transcript);
      setLastFailure(null);
      setCaptureState('ready');
      return {
        status: 'browser_only',
        transcript,
        turnId: activeTurnIdRef.current,
        epoch,
      };
    },
    [],
  );

  const flushBrowserTranscript = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const merged = collapseSpeechTranscript(
      browserFinalRef.current || browserLiveRef.current,
    );
    if (merged) {
      browserFinalRef.current = merged;
      browserLiveRef.current = merged;
      setBrowserInterim(merged);
    }
  }, []);

  const start = useCallback(async () => {
    if (blocked) return false;
    listenEpochRef.current += 1;
    const epoch = listenEpochRef.current;
    browserFinalRef.current = '';
    browserLiveRef.current = '';
    setBrowserInterim('');
    setLastFailure(null);
    setLastResult(null);
    usedWhisperRef.current = false;
    usedBrowserRef.current = false;
    setRecorderFailed(false);
    setCaptureState('arming');

    let recorderOk = false;
    if (recorder.isSupported) {
      recorderOk = await recorder.start();
      if (!recorderOk) {
        setRecorderFailed(true);
        setCaptureState('failed');
      }
    }

    let browserOk = false;
    if (speech.isSpeechRecognitionSupported) {
      await speech.releaseAudioForListening();
      if (epoch !== listenEpochRef.current) return false;
      browserOk = speech.startListening({
        onTranscript: (text, hasFinal) => {
          if (epoch !== listenEpochRef.current) return;
          scheduleBrowserUpdate(text, hasFinal);
        },
        onError: (code) => {
          if (code === 'aborted' || code === 'no-speech') return;
        },
        continuous: true,
      });
    }

    const ok = recorderOk || browserOk;
    setIsListening(ok);
    if (ok) {
      setCaptureState(
        recorder.recordingState === 'recording' ? 'recording' : browserOk ? 'recording' : 'idle',
      );
    } else if (!recorderOk && !browserOk) {
      setCaptureState('failed');
    }
    return ok;
  }, [blocked, recorder, scheduleBrowserUpdate, speech]);

  const stop = useCallback(async (): Promise<HybridStopResult> => {
    const epoch = ++stopEpochRef.current;
    listenEpochRef.current += 1;
    const turnAtStop = activeTurnIdRef.current;
    speech.stopListening();
    setIsListening(false);
    flushBrowserTranscript();

    const browserText = collapseSpeechTranscript(
      browserFinalRef.current || browserLiveRef.current || browserInterim,
    );

    let blob: Blob | null = null;
    let emptyRecording = false;

    if (
      recorder.isCapturing ||
      recorder.recordingState === 'recording' ||
      recorder.recordingState === 'finalizing'
    ) {
      setCaptureState('finalizing');
      const stopResult = await recorder.stop();
      if (stopResult.ok) {
        blob = stopResult.blob;
      } else {
        emptyRecording = stopResult.error === 'EMPTY_RECORDING';
        if (stopResult.fallbackToSTT) setRecorderFailed(true);
      }
    }

    if (epoch !== stopEpochRef.current) {
      return {
        status: 'failed',
        message: 'Transcription cancelled.',
        turnId: turnAtStop,
        epoch,
      };
    }

    const strat = getCachedRecordingStrategy();
    const minBytes = minBlobBytesFromStrategy(strat);
    const blobTooSmall =
      blob !== null && blob.size < Math.max(minBytes, RECORDING_MIN_VALID_BYTES);

    const canUpload =
      whisperEnabled &&
      sessionId &&
      turnAtStop &&
      blob &&
      blob.size >= minBytes &&
      !recorderFailed &&
      !emptyRecording &&
      !blobTooSmall;

    if (!canUpload) {
      if (browserText.length >= 1) {
        return buildBrowserOnlyResult(browserText, epoch, true);
      }
      const message =
        emptyRecording || blobTooSmall
          ? 'Recording was too short — try speaking longer or type your answer.'
          : browserText.length > 0
            ? 'Could not understand clearly. Try again or type.'
            : "We couldn't capture audio clearly. Please retry or type your answer.";
      setLastFailure(message);
      setCaptureState('failed');
      return { status: 'failed', message, turnId: turnAtStop, epoch };
    }

    setCaptureState('transcribing');
    setIsTranscribing(true);
    try {
      const res = await interviewVoiceApi.transcribeTurnAudioWithRetry(
        sessionId!,
        turnAtStop!,
        blob!,
        browserText,
        WHISPER_UPLOAD_MAX_RETRIES,
        {
          clientBrowser: clientBrowserLabel(),
          recordingStrategy: strat?.strategy,
        },
      );

      if (epoch !== stopEpochRef.current) {
        return {
          status: 'failed',
          message: 'Transcription cancelled.',
          turnId: turnAtStop,
          epoch,
        };
      }

      const source = mapApiTranscriptionSource(res.source);
      usedWhisperRef.current = source === 'whisper';
      usedBrowserRef.current = source === 'browser';

      const transcript: HybridTranscript = {
        text: res.transcript,
        source,
        fallbackRequired: res.fallbackRequired,
        whisperErrorCode: res.errorCode,
      };
      setLastResult(transcript);
      setLastFailure(null);
      setCaptureState('ready');

      return {
        status: 'ok',
        transcript,
        turnId: turnAtStop,
        epoch,
      };
    } catch (err) {
      if (epoch !== stopEpochRef.current) {
        return {
          status: 'failed',
          message: 'Transcription cancelled.',
          turnId: turnAtStop,
          epoch,
        };
      }

      if (err instanceof TranscriptionFailedError) {
        if (browserText.length >= 1) {
          return buildBrowserOnlyResult(browserText, epoch, true);
        }
        setLastFailure(err.message);
        setCaptureState('failed');
        return {
          status: 'failed',
          message: err.message,
          errorCode: err.errorCode,
          turnId: turnAtStop,
          epoch,
        };
      }

      if (browserText.length >= 1) {
        return buildBrowserOnlyResult(browserText, epoch, true);
      }

      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "We couldn't capture audio clearly. Please retry or type your answer.";
      setLastFailure(message);
      setCaptureState('failed');
      return { status: 'failed', message, turnId: turnAtStop, epoch };
    } finally {
      if (epoch === stopEpochRef.current) {
        setIsTranscribing(false);
      }
    }
  }, [
    browserInterim,
    buildBrowserOnlyResult,
    flushBrowserTranscript,
    recorder,
    recorderFailed,
    sessionId,
    speech,
    whisperEnabled,
  ]);

  const reset = useCallback(() => {
    stopEpochRef.current += 1;
    listenEpochRef.current += 1;
    speech.stopListening();
    recorder.cancel();
    setIsListening(false);
    setIsTranscribing(false);
    setBrowserInterim('');
    browserFinalRef.current = '';
    browserLiveRef.current = '';
    usedWhisperRef.current = false;
    usedBrowserRef.current = false;
    setRecorderFailed(false);
    setLastResult(null);
    setLastFailure(null);
    setCaptureState('idle');
  }, [recorder, speech]);

  useEffect(() => {
    if (isTranscribing) {
      setCaptureState('transcribing');
      return;
    }
    if (recorder.recordingState === 'recording') {
      setCaptureState('recording');
      return;
    }
    if (recorder.recordingState === 'arming') {
      setCaptureState('arming');
      return;
    }
    if (recorder.recordingState === 'finalizing') {
      setCaptureState('finalizing');
      return;
    }
    if (!isListening && recorder.recordingState === 'idle' && !isTranscribing) {
      setCaptureState((prev) => (prev === 'failed' || prev === 'ready' ? prev : 'idle'));
    }
  }, [isListening, isTranscribing, recorder.recordingState]);

  return {
    speech,
    recorder,
    recordingState: captureState,
    isListening,
    isTranscribing,
    browserInterim,
    lastResult,
    lastFailure,
    whisperEnabled,
    start,
    stop,
    reset,
    getUsedWhisper: () => usedWhisperRef.current,
    getUsedBrowser: () => usedBrowserRef.current,
    isSpeechRecognitionSupported: speech.isSpeechRecognitionSupported,
    speechApisReady: speech.speechApisReady,
  };
}
