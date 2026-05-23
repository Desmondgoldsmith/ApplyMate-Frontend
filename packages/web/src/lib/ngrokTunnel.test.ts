import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isNgrokFreeTunnel,
  shouldSendNgrokSkipHeader,
} from '@/lib/ngrokTunnel';

describe('ngrokTunnel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects ngrok free hostnames', () => {
    expect(isNgrokFreeTunnel('https://abc.ngrok-free.dev/api/')).toBe(true);
    expect(isNgrokFreeTunnel('https://abc.ngrok-free.app/api')).toBe(true);
    expect(isNgrokFreeTunnel('https://api.applymate.com/api/')).toBe(false);
  });

  it('skips header in production without flag', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://abc.ngrok-free.dev/api');
    vi.stubEnv('NEXT_PUBLIC_USE_NGROK_TUNNEL', '');
    expect(shouldSendNgrokSkipHeader()).toBe(false);
  });

  it('sends header on Vercel test when flag and ngrok URL', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://abc.ngrok-free.dev/api');
    vi.stubEnv('NEXT_PUBLIC_USE_NGROK_TUNNEL', 'true');
    expect(shouldSendNgrokSkipHeader()).toBe(true);
  });

  it('sends header in dev when API URL is ngrok', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://abc.ngrok-free.dev/api');
    vi.stubEnv('NEXT_PUBLIC_USE_NGROK_TUNNEL', '');
    expect(shouldSendNgrokSkipHeader()).toBe(true);
  });

  it('never sends for non-ngrok production API', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.applymate.com/api');
    vi.stubEnv('NEXT_PUBLIC_USE_NGROK_TUNNEL', 'true');
    expect(shouldSendNgrokSkipHeader()).toBe(false);
  });
});
