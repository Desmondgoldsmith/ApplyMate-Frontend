'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';

import { useInterviewSpeechController } from '@/hooks/useInterviewSpeechController';
import { useThrottledValue } from '@/hooks/useThrottledValue';
import type { AnswerSource } from '@/lib/interview-prep-types';
import type { TranscriptionState } from '@/lib/interviewSpeech';

export type InterviewVoiceBridge = {
  inputMode: 'voice' | 'type';
  transcript: string;
  transcriptionState: TranscriptionState;
  transcriptionMessage: string | null;
  isRecording: boolean;
  isListening: boolean;
  isTranscriptReady: boolean;
  fellBackToManual: boolean;
  speechApisReady: boolean;
  isSpeechRecognitionSupported: boolean;
  getAnswerSource: () => AnswerSource;
  stop: () => void;
  reset: () => void;
  start: () => Promise<void>;
  setInputMode: (mode: 'voice' | 'type') => void;
  isTranscribing: boolean;
};

type RecordingSlice = {
  isRecording: boolean;
  isListening: boolean;
  inputMode: 'voice' | 'type';
  fellBackToManual: boolean;
};

type TranscriptSlice = ReturnType<typeof useInterviewSpeechController>;

const RecordingContext = createContext<RecordingSlice | null>(null);
const TranscriptContext = createContext<TranscriptSlice | null>(null);

export function InterviewVoiceProvider({
  children,
  sessionId,
  turnId,
  blocked,
  bridgeRef,
}: {
  children: ReactNode;
  sessionId: string | null;
  turnId: string | null;
  blocked?: boolean;
  bridgeRef?: MutableRefObject<InterviewVoiceBridge | null>;
}) {
  const voice = useInterviewSpeechController({ sessionId, turnId, blocked });

  const throttledTranscript = useThrottledValue(voice.transcript, 120);

  const recordingSlice = useMemo(
    (): RecordingSlice => ({
      isRecording: voice.isRecording,
      isListening: voice.isListening,
      inputMode: voice.inputMode,
      fellBackToManual: voice.fellBackToManual,
    }),
    [
      voice.fellBackToManual,
      voice.inputMode,
      voice.isListening,
      voice.isRecording,
    ],
  );

  const transcriptSlice = useMemo(
    () => ({
      ...voice,
      transcript: throttledTranscript,
    }),
    [voice, throttledTranscript],
  );

  const bridge = useMemo((): InterviewVoiceBridge => {
    return {
      inputMode: voice.inputMode,
      transcript: voice.transcript,
      transcriptionState: voice.transcriptionState,
      transcriptionMessage: voice.transcriptionMessage,
      isRecording: voice.isRecording,
      isListening: voice.isListening,
      isTranscriptReady: voice.isTranscriptReady,
      fellBackToManual: voice.fellBackToManual,
      speechApisReady: voice.speechApisReady,
      isSpeechRecognitionSupported: voice.isSupported,
      getAnswerSource: voice.getAnswerSource,
      stop: voice.stop,
      reset: voice.reset,
      start: voice.start,
      setInputMode: voice.setInputMode,
      isTranscribing: voice.isTranscribing,
    };
  }, [voice]);

  const bridgeStableRef = useRef(bridge);
  bridgeStableRef.current = bridge;
  if (bridgeRef) {
    bridgeRef.current = bridgeStableRef.current;
  }

  return (
    <RecordingContext.Provider value={recordingSlice}>
      <TranscriptContext.Provider value={transcriptSlice}>{children}</TranscriptContext.Provider>
    </RecordingContext.Provider>
  );
}

export function useInterviewVoiceRecording(): RecordingSlice {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    return {
      isRecording: false,
      isListening: false,
      inputMode: 'type',
      fellBackToManual: true,
    };
  }
  return ctx;
}

export function useInterviewVoiceTranscript(): TranscriptSlice {
  const ctx = useContext(TranscriptContext);
  if (!ctx) {
    throw new Error('useInterviewVoiceTranscript must be used within InterviewVoiceProvider');
  }
  return ctx;
}
