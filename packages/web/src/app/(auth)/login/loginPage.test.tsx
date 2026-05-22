import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from '@/app/(auth)/login/page';
import { useAuthStore } from '@/store/useAuthStore';

const { login } = vi.hoisted(() => ({
  login: vi.fn(),
}));

const push = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      login,
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/components/layout/AppShellBackdrop', () => ({
  AppShellBackdrop: () => null,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
    push.mockReset();
    useAuthStore.getState().clearAuth({ skipBroadcast: true });
  });

  it(
    'on success, sets session and navigates to dashboard',
    async () => {
      const user = userEvent.setup();
      login.mockResolvedValueOnce({
        accessToken: 'token-ok',
        user: {
          id: '1',
          email: 'u@x.com',
          onboardingCompleted: true,
          selectedFeatures: ['cv'],
          primaryGoal: null,
        },
      });

      render(<LoginPage />);

      await user.type(await screen.findByPlaceholderText('Email'), 'u@x.com');
      await user.type(screen.getByPlaceholderText('Password'), 'secret12');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      expect(login).toHaveBeenCalledWith({ email: 'u@x.com', password: 'secret12' });
      expect(useAuthStore.getState().accessToken).toBe('token-ok');
      expect(push).toHaveBeenCalledWith('/dashboard');
    },
    15_000,
  );

  it('on failure, does not navigate away', async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(new Error('bad'));

    render(<LoginPage />);

    await user.type(await screen.findByPlaceholderText('Email'), 'u@x.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret12');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(push).not.toHaveBeenCalled();
  });
});
