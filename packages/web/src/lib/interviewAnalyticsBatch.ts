type QueuedEvent = {
  eventName: string;
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
  queue.push(evt);
  if (queue.length >= MAX_BATCH) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushQueue();
    return;
  }
  scheduleFlush();
}
