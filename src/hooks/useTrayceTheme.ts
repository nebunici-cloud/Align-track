import { useEffect, useState } from 'react';

export type TrayceTheme = 'light' | 'dark';

const STORAGE_KEY = 'alignertrack_trayce_theme';

function getSystemTheme(): TrayceTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getStoredTheme(): TrayceTheme | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

/** Theme for the redesigned Home screen only — persisted locally, defaults to the OS preference. */
export function useTrayceTheme(): [TrayceTheme, (theme: TrayceTheme) => void] {
  const [theme, setThemeState] = useState<TrayceTheme>(() => getStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'light' ? '#f3f8f6' : '#061624'
    );
  }, [theme]);

  const setTheme = (next: TrayceTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors (private browsing, quota, etc.)
    }
  };

  return [theme, setTheme];
}
