import { useState, useEffect, useCallback } from 'react';

const THEMES = ['dark', 'classic', 'modern'];
const CLASS_MAP = { dark: '', classic: 'theme-classic', modern: 'theme-modern' };
const STORAGE_KEY = 'klondike_theme';

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'dark'
  );

  useEffect(() => {
    const html = document.documentElement;
    THEMES.forEach(t => { if (CLASS_MAP[t]) html.classList.remove(CLASS_MAP[t]); });
    if (CLASS_MAP[theme]) html.classList.add(CLASS_MAP[theme]);
  }, [theme]);

  const setTheme = useCallback((t) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  return { theme, setTheme, themes: THEMES };
}
