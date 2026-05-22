type InFlight<T> = {
  key: string;
  promise: Promise<T>;
  controller: AbortController;
};

const turnSubmitFlights = new Map<string, InFlight<unknown>>();

function turnSubmitKey(
  sessionId: string,
  turnId: string,
  answerText: string,
): string {
  return `${sessionId}:${turnId}:${answerText.trim().slice(0, 64)}`;
}

/**
 * Deduplicates identical in-flight turn submits and aborts superseded requests.
 */
export async function dedupeTurnSubmit<T>(
  sessionId: string,
  turnId: string,
  answerText: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const key = turnSubmitKey(sessionId, turnId, answerText);

  const existing = turnSubmitFlights.get(key);
  if (existing) {
    return existing.promise as Promise<T>;
  }

  const controller = new AbortController();
  const promise = run(controller.signal).finally(() => {
    const current = turnSubmitFlights.get(key);
    if (current?.controller === controller) {
      turnSubmitFlights.delete(key);
    }
  });

  turnSubmitFlights.set(key, {
    key,
    promise,
    controller,
  });

  return promise;
}

export function cancelTurnSubmitsForSession(sessionId: string): void {
  for (const [key, flight] of turnSubmitFlights) {
    if (key.startsWith(`${sessionId}:`)) {
      flight.controller.abort();
      turnSubmitFlights.delete(key);
    }
  }
}

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function debounceByKey(
  key: string,
  ms: number,
  fn: () => void,
): void {
  const prev = debounceTimers.get(key);
  if (prev) clearTimeout(prev);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      fn();
    }, ms),
  );
}
