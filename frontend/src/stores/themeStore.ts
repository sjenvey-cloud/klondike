import { create } from 'zustand';

type Theme = 'dark' | 'classic' | 'modern';

const THEMES: readonly Theme[] = ['dark', 'classic', 'modern'];
const CLASS_MAP: Record<Theme, string> = { dark: '', classic: 'theme-classic', modern: 'theme-modern' };
const STORAGE_KEY = 'klondike_theme';

function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  THEMES.forEach(t => { if (CLASS_MAP[t]) html.classList.remove(CLASS_MAP[t]); });
  if (CLASS_MAP[theme]) html.classList.add(CLASS_MAP[theme]);
}

interface ThemeState {
  theme: Theme;
  themes: readonly Theme[];
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()((set) => {
  const initial: Theme = (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
  applyTheme(initial);

  return {
    theme:  initial,
    themes: THEMES,

    setTheme: (t: Theme): void => {
      localStorage.setItem(STORAGE_KEY, t);
      applyTheme(t);
      set({ theme: t });
    },
  };
});
