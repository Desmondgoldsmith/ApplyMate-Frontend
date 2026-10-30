import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider';
import { THEME_STORAGE_KEY } from '@/lib/theme/themePreference';
import { useAuthStore } from '@/store/useAuthStore';

const { updateMe } = vi.hoisted(() => ({
  updateMe: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/api', () => ({
  api: { users: { updateMe } },
}));

function Probe() {
  const { preference, setPreference } = useTheme();
  return (
    <>
      <span data-testid="pref">{preference}</span>
      <button type="button" onClick={() => setPreference('dark')}>
        dark
      </button>
    </>
  );
}

function signIn(theme?: string) {
  act(() => {
    useAuthStore.getState().setAuth(
      {
        id: 'u1',
        email: 'u@x.com',
        uiPrefs: theme ? { theme } : null,
      } as never,
      'token',
    );
  });
}

const theme = () => document.documentElement.getAttribute('data-theme');

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    updateMe.mockClear();
  });

  afterEach(() => {
    act(() => useAuthStore.getState().clearAuth({ skipBroadcast: true }));
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('applies the theme saved on the account at sign-in', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    signIn('dark');
    expect(theme()).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByTestId('pref')).toHaveTextContent('dark');
  });

  it('keeps the local choice when the account has none', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    signIn();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('saves a new choice to the account without bouncing back', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    signIn('light');
    await user.click(screen.getByRole('button', { name: 'dark' }));

    expect(theme()).toBe('dark');
    expect(updateMe).toHaveBeenCalledWith({ uiPrefs: { theme: 'dark' } });
    expect(useAuthStore.getState().user?.uiPrefs?.theme).toBe('dark');
    expect(screen.getByTestId('pref')).toHaveTextContent('dark');
  });
});
