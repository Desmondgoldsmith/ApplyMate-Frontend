import { trackConversionFunnelEvent } from '@/lib/analytics';

type InterviewAnalyticsEventName =
  | 'interview_started'
  | 'interview_answer_submitted'
  | 'interview_followup_triggered'
  | 'interview_completed'
  | 'interview_weakness_detected';

type QueuedEvent = {
  eventName: InterviewAnalyticsEventName;
  sessionId?: string;
  context?: Record<string, unknown>;
};

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 1200;
const MAX_BATCH = 12;

async function flushQueue(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  const { api } = await import('@/lib/api');
  await Promise.allSettled(
    batch.map((evt) =>
      api.analytics.trackEvent({
        eventName: evt.eventName,
        sessionId: evt.sessionId,
        context: evt.context,
      }),
    ),
  );
  if (queue.length > 0) {
    scheduleFlush();
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_MS);
}

/** Non-blocking analytics — debounced batch, never awaited on hot path. */
export function enqueueInterviewAnalyticsEvent(evt: QueuedEvent): void {
  if (evt.eventName === 'interview_started') {
    trackConversionFunnelEvent('interview_started', {
      ...evt.context,
      sessionId: evt.sessionId,
    });
  }
  queue.push(evt);
  scheduleFlush();
}
