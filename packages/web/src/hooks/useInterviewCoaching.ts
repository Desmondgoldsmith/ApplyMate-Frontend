'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { interviewCoachingApi } from '@/lib/interview-coaching-api';
import type {
  CoachingLoadStatus,
  LiveCoachingResponse,
  PostCoachingResponse,
  PreCoachingResponse,
} from '@/lib/interview-coaching-types';
import {
  getCachedLiveCoaching,
  getCachedPostCoaching,
  getCachedPreCoaching,
  liveBufferFingerprint,
  setCachedLiveCoaching,
  setCachedPostCoaching,
  setCachedPreCoaching,
} from '@/lib/interviewCoachingCache';
import { debounceByKey } from '@/lib/interviewRequestDedupe';

const LIVE_DEBOUNCE_MS = 500;
const PRE_SKELETON_MAX_MS = 280;

export function useInterviewCoaching(options: {
  sessionId: string;
  turnId: string | null;
  enabled?: boolean;
  /** Active while user can answer (pre + live). */
  prepActive?: boolean;
  answerBuffer?: string;
  elapsedSeconds?: number;
}) {
  const {
    sessionId,
    turnId,
    enabled = true,
    prepActive = false,
    answerBuffer = '',
    elapsedSeconds = 0,
  } = options;

  const [preStatus, setPreStatus] = useState<CoachingLoadStatus>('idle');
  const [pre, setPre] = useState<PreCoachingResponse | null>(null);
  const [live, setLive] = useState<LiveCoachingResponse | null>(null);
  const [postStatus, setPostStatus] = useState<CoachingLoadStatus>('idle');
  const [post, setPost] = useState<PostCoachingResponse | null>(null);

  const liveAbortRef = useRef<AbortController | null>(null);
  const postInFlightRef = useRef<string | null>(null);

  const active = enabled && Boolean(sessionId && turnId);

  useEffect(() => {
    setPre(null);
    setLive(null);
    setPost(null);
    setPreStatus('idle');
    setPostStatus('idle');
    postInFlightRef.current = null;
  }, [sessionId, turnId]);

  useEffect(() => {
    if (!active || !turnId || !prepActive) return;

    const cached = getCachedPreCoaching(sessionId, turnId);
    if (cached) {
      setPre(cached);
      setPreStatus('ready');
      return;
    }

    setPreStatus('loading');
    const skeletonTimer = window.setTimeout(() => {
      setPreStatus((s) => (s === 'loading' ? 'loading' : s));
    }, PRE_SKELETON_MAX_MS);

    let cancelled = false;
    void interviewCoachingApi
      .getPreCoaching(sessionId, turnId)
      .then((data) => {
        if (cancelled) return;
        setCachedPreCoaching(sessionId, turnId, data);
        setPre(data);
        setPreStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setPreStatus('error');
      })
      .finally(() => {
        window.clearTimeout(skeletonTimer);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(skeletonTimer);
    };
  }, [active, prepActive, sessionId, turnId]);

  useEffect(() => {
    if (!active || !turnId || !prepActive) return;

    const buffer = answerBuffer.trim();
    if (buffer.length < 12) {
      setLive(null);
      return;
    }

    const fp = liveBufferFingerprint(buffer);
    const cached = getCachedLiveCoaching(sessionId, turnId, fp);
    if (cached) {
      setLive(cached);
      return;
    }

    debounceByKey(`live:${sessionId}:${turnId}`, LIVE_DEBOUNCE_MS, () => {
      if (liveAbortRef.current) liveAbortRef.current.abort();
      const controller = new AbortController();
      liveAbortRef.current = controller;

      void interviewCoachingApi
        .postLiveCoaching(sessionId, turnId, {
          buffer,
          elapsedSeconds: elapsedSeconds > 0 ? elapsedSeconds : undefined,
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          setCachedLiveCoaching(sessionId, turnId, fp, data);
          setLive(data);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
        });
    });

    return () => {
      if (liveAbortRef.current) {
        liveAbortRef.current.abort();
        liveAbortRef.current = null;
      }
    };
  }, [active, answerBuffer, elapsedSeconds, prepActive, sessionId, turnId]);

  const fetchPostCoaching = useCallback(
    async (
      answerText: string,
      durationSeconds?: number,
    ): Promise<PostCoachingResponse | null> => {
      if (!active || !turnId) return null;

      const cached = getCachedPostCoaching(sessionId, turnId);
      if (cached) {
        setPost(cached);
        setPostStatus('ready');
        return cached;
      }

      const inflightKey = `${sessionId}:${turnId}:${answerText.trim().slice(0, 32)}`;
      if (postInFlightRef.current === inflightKey) {
        return post;
      }
      postInFlightRef.current = inflightKey;
      setPostStatus('loading');

      try {
        const data = await interviewCoachingApi.postPostCoaching(sessionId, turnId, {
          answerText,
          durationSeconds,
        });
        setCachedPostCoaching(sessionId, turnId, data);
        setPost(data);
        setPostStatus('ready');
        return data;
      } catch {
        setPostStatus('error');
        return null;
      } finally {
        if (postInFlightRef.current === inflightKey) {
          postInFlightRef.current = null;
        }
      }
    },
    [active, post, sessionId, turnId],
  );

  const clearPost = useCallback(() => {
    setPost(null);
    setPostStatus('idle');
  }, []);

  return useMemo(
    () => ({
      pre,
      preStatus,
      live,
      post,
      postStatus,
      fetchPostCoaching,
      clearPost,
    }),
    [clearPost, fetchPostCoaching, live, post, postStatus, pre, preStatus],
  );
}
