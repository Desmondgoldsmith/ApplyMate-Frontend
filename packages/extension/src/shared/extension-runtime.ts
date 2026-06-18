/** True when this JS context can talk to the extension background. */
export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function safeRuntimeSendMessage<T = unknown>(message: unknown): Promise<T | undefined> {
  if (!isExtensionContextValid()) {
    return Promise.resolve(undefined);
  }
  return chrome.runtime.sendMessage(message) as Promise<T | undefined>;
}
