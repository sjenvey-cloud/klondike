import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'classic' | 'modern';

const THEMES: Theme[] = ['dark', 'classic', 'modern'];
const CLASS_MAP: Record<Theme, string> = { dark: '', classic: 'theme-classic', modern: 'theme-modern' };
const STORAGE_KEY = 'klondike_theme';

export interface UseThemeReturn {
  theme: Theme;
  setTheme: (t: Theme) => void;
  themes: Theme[];
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark'
  );

  useEffect(() => {
    const html = document.documentElement;
    THEMES.forEach(t => { if (CLASS_MAP[t]) html.classList.remove(CLASS_MAP[t]); });
    if (CLASS_MAP[theme]) html.classList.add(CLASS_MAP[theme]);
  }, [theme]);

  const setTheme = useCallback((t: Theme): void => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  return { theme, setTheme, themes: THEMES };
}
