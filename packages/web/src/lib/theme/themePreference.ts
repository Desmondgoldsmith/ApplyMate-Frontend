export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'careerkite:theme';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function readStoredThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* private mode / storage disabled: theme still applies for this visit */
  }
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Runs before first paint (inlined in the root layout's <head>) so a reload
 * never flashes the wrong theme. Keep in sync with the helpers above; it
 * cannot import them.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p!=='light'&&p!=='dark'&&p!=='system')p='${DEFAULT_THEME_PREFERENCE}';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;
