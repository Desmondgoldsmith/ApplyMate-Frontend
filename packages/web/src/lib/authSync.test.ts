import { afterEach, describe, expect, it, vi } from 'vitest';

import { broadcastAuthLogout, subscribeAuthLogout } from '@/lib/authSync';

describe('authSync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('broadcastAuthLogout posts logout message', () => {
    const postMessage = vi.fn();
    const close = vi.fn();

    class MockChannel {
      constructor(_name: string) {}
      postMessage = postMessage;
      close = close;
    }

    vi.stubGlobal('BroadcastChannel', MockChannel as unknown as typeof BroadcastChannel);

    broadcastAuthLogout();

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'logout' }));
    expect(close).toHaveBeenCalled();
  });

  it('subscribeAuthLogout invokes callback on logout message', () => {
    let channel: {
      onmessage: ((ev: MessageEvent) => void) | null;
      close: ReturnType<typeof vi.fn>;
    } | null = null;

    class MockChannel {
      constructor(_name: string) {
        channel = this as unknown as typeof channel;
      }
      onmessage: ((ev: MessageEvent) => void) | null = null;
      close = vi.fn();
    }

    vi.stubGlobal('BroadcastChannel', MockChannel as unknown as typeof BroadcastChannel);

    const onLogout = vi.fn();
    const unsub = subscribeAuthLogout(onLogout);

    expect(channel).not.toBeNull();
    channel!.onmessage?.(new MessageEvent('message', { data: { type: 'logout' } }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    unsub();
    expect(channel!.close).toHaveBeenCalled();
  });
});
