'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecordingStrategyResponse } from '@/lib/interview-voice-api';
import { pickMimeTypeFromStrategy } from '@/lib/interviewRecordingStrategy';
import {
  isEdgeBrowser,
  MIC_WARMUP_BEFORE_RECORD_MS,
  RECORDING_FLUSH_BEFORE_STOP_MS,
  RECORDING_MIN_VALID_BYTES,
  RECORDING_REQUEST_DATA_INTERVAL_MS,
  RECORDING_STOP_FINALIZE_EDGE_MS,
  RECORDING_STOP_FINALIZE_MS,
  RECORDING_TIMESLICE_MS,
  sleep,
  type AudioRecorderStopResult,
  type RecordingState,
} from '@/lib/interviewSpeech';

export type UseAudioRecorderOptions = {
  recordingStrategy?: RecordingStrategyResponse | null;
};

function totalChunkBytes(chunks: Blob[]): number {
  return chunks.reduce((sum, c) => sum + c.size, 0);
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const { recordingStrategy = null } = options;
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const strategyRef = useRef(recordingStrategy);
  const requestDataIntervalRef = useRef<number | null>(null);
  const startEpochRef = useRef(0);
  const stopEpochRef = useRef(0);

  strategyRef.current = recordingStrategy;

  const clearRequestDataInterval = useCallback(() => {
    if (requestDataIntervalRef.current !== null) {
      window.clearInterval(requestDataIntervalRef.current);
      requestDataIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined',
    );
  }, []);

  useEffect(() => {
    return () => {
      clearRequestDataInterval();
      const stream = mediaStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
      mediaStreamRef.current = null;
      recorderRef.current = null;
    };
  }, [clearRequestDataInterval]);

  const releaseStream = useCallback(() => {
    clearRequestDataInterval();
    const stream = mediaStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    mediaStreamRef.current = null;
    recorderRef.current = null;
  }, [clearRequestDataInterval]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser.');
      setRecordingState('failed');
      return false;
    }

    const epoch = ++startEpochRef.current;
    setError(null);
    chunksRef.current = [];
    setRecordingState('arming');
    setIsCapturing(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (epoch !== startEpochRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return false;
      }

      mediaStreamRef.current = stream;
      await sleep(MIC_WARMUP_BEFORE_RECORD_MS);
      if (epoch !== startEpochRef.current) {
        releaseStream();
        return false;
      }

      const mime = pickMimeTypeFromStrategy(strategyRef.current);
      mimeTypeRef.current = mime ?? 'audio/webm';
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) chunksRef.current.push(evt.data);
      };

      recorderRef.current = recorder;
      recorder.start(RECORDING_TIMESLICE_MS);

      clearRequestDataInterval();
      requestDataIntervalRef.current = window.setInterval(() => {
        const active = recorderRef.current;
        if (active?.state === 'recording') {
          try {
            active.requestData();
          } catch {
            /* ignore — recorder may be stopping */
          }
        }
      }, RECORDING_REQUEST_DATA_INTERVAL_MS);

      setRecordingState('recording');
      setIsCapturing(true);
      return true;
    } catch (err) {
      releaseStream();
      setIsCapturing(false);
      setRecordingState('failed');
      const msg = err instanceof Error ? err.message : 'Microphone access failed';
      setError(msg);
      return false;
    }
  }, [clearRequestDataInterval, isSupported, releaseStream]);

  const stop = useCallback(async (): Promise<AudioRecorderStopResult> => {
    const stopEpoch = ++stopEpochRef.current;
    clearRequestDataInterval();

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      const chunks = chunksRef.current;
      const bytes = totalChunkBytes(chunks);
      releaseStream();
      setIsCapturing(false);
      if (!chunks.length || bytes < RECORDING_MIN_VALID_BYTES) {
        setRecordingState('failed');
        return {
          ok: false,
          error: 'EMPTY_RECORDING',
          fallbackToSTT: true,
          message: 'Recording was too short — try speaking longer or type your answer.',
        };
      }
      setRecordingState('idle');
      return { ok: true, blob: new Blob(chunks, { type: mimeTypeRef.current }) };
    }

    setRecordingState('finalizing');

    try {
      if (recorder.state === 'recording') {
        recorder.requestData();
      }
    } catch {
      /* ignore */
    }

    await sleep(RECORDING_FLUSH_BEFORE_STOP_MS);
    if (stopEpoch !== stopEpochRef.current) {
      return {
        ok: false,
        error: 'STOP_FAILED',
        fallbackToSTT: true,
        message: 'Recording cancelled.',
      };
    }

    const finalizeDelay = isEdgeBrowser()
      ? RECORDING_STOP_FINALIZE_EDGE_MS
      : RECORDING_STOP_FINALIZE_MS;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: AudioRecorderStopResult) => {
        if (settled || stopEpoch !== stopEpochRef.current) return;
        settled = true;
        releaseStream();
        setIsCapturing(false);
        setRecordingState(result.ok ? 'idle' : 'failed');
        resolve(result);
      };

      recorder.onstop = () => {
        const chunks = chunksRef.current;
        const bytes = totalChunkBytes(chunks);
        if (!chunks.length || bytes < RECORDING_MIN_VALID_BYTES) {
          finish({
            ok: false,
            error: 'EMPTY_RECORDING',
            fallbackToSTT: true,
            message: 'Recording was too short — try speaking longer or type your answer.',
          });
          return;
        }
        finish({
          ok: true,
          blob: new Blob(chunks, { type: mimeTypeRef.current }),
        });
      };

      window.setTimeout(() => {
        if (settled || stopEpoch !== stopEpochRef.current) return;
        if (recorder.state === 'inactive') {
          const chunks = chunksRef.current;
          const bytes = totalChunkBytes(chunks);
          if (!chunks.length || bytes < RECORDING_MIN_VALID_BYTES) {
            finish({
              ok: false,
              error: 'EMPTY_RECORDING',
              fallbackToSTT: true,
              message: 'Recording was too short — try speaking longer or type your answer.',
            });
          } else {
            finish({ ok: true, blob: new Blob(chunks, { type: mimeTypeRef.current }) });
          }
          return;
        }
        try {
          recorder.stop();
        } catch {
          finish({
            ok: false,
            error: 'STOP_FAILED',
            fallbackToSTT: true,
            message: 'Could not finish recording. Try again or type your answer.',
          });
        }
      }, finalizeDelay);
    });
  }, [clearRequestDataInterval, releaseStream]);

  const cancel = useCallback(() => {
    ++stopEpochRef.current;
    ++startEpochRef.current;
    clearRequestDataInterval();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    chunksRef.current = [];
    releaseStream();
    setIsCapturing(false);
    setRecordingState('idle');
  }, [clearRequestDataInterval, releaseStream]);

  return {
    recordingState,
    isCapturing,
    isSupported,
    error,
    start,
    stop,
    cancel,
  };
}
