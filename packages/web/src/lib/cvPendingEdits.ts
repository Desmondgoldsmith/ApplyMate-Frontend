let saver: (() => Promise<void>) | null = null;

/** The open CV editor registers how to save its open field and unsaved edits. */
export function registerCvPendingEditsSaver(
  fn: () => Promise<void>,
): () => void {
  saver = fn;
  return () => {
    if (saver === fn) saver = null;
  };
}

/**
 * Saves whatever the user is still typing before an AI action. Accepting an AI change reloads
 * the CV from the server, which would otherwise drop edits autosave has not sent yet.
 */
export async function savePendingCvEdits(): Promise<void> {
  try {
    await saver?.();
  } catch {
    // Autosave reports its own errors; the AI action can still go ahead.
  }
}
