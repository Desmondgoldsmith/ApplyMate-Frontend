import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isThemePreference,
  readStoredThemePreference,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './themePreference';

function stubSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: dark }));
}

function runInitScript() {
  new Function(THEME_INIT_SCRIPT)();
  return document.documentElement.getAttribute('data-theme');
}

describe('themePreference', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
  });

  it('recognises only light, dark and system', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('neon')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it('resolves system from the device setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('falls back to system when storage holds junk', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredThemePreference()).toBe('system');
  });

  it('init script applies the stored choice before paint', () => {
    stubSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(runInitScript()).toBe('light');
  });

  it('init script follows the device when nothing is stored', () => {
    stubSystemDark(true);
    expect(runInitScript()).toBe('dark');
    stubSystemDark(false);
    expect(runInitScript()).toBe('light');
  });
});
