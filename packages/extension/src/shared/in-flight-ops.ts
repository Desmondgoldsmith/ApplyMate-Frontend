export type InFlightOperation = 'scoring' | 'coverLetter';

export type InFlightState = {
  operation: InFlightOperation;
  sourceUrl: string;
  startedAt: number;
};

const IN_FLIGHT_KEY = 'inFlightOperation';

export async function setInFlight(state: InFlightState): Promise<void> {
  await chrome.storage.session.set({ [IN_FLIGHT_KEY]: state });
}

export async function readInFlight(): Promise<InFlightState | null> {
  const stored = await chrome.storage.session.get(IN_FLIGHT_KEY);
  const raw = stored[IN_FLIGHT_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const op = raw as InFlightState;
  if (op.operation !== 'scoring' && op.operation !== 'coverLetter') return null;
  if (typeof op.sourceUrl !== 'string' || !op.sourceUrl.trim()) return null;
  return op;
}

export async function clearInFlight(operation?: InFlightOperation): Promise<void> {
  if (!operation) {
    await chrome.storage.session.remove(IN_FLIGHT_KEY);
    return;
  }
  const current = await readInFlight();
  if (current?.operation === operation) {
    await chrome.storage.session.remove(IN_FLIGHT_KEY);
  }
}
