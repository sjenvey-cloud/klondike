import { useThemeStore } from '../stores/themeStore';

type Theme = 'dark' | 'classic' | 'modern';

export interface UseThemeReturn {
  theme: Theme;
  setTheme: (t: Theme) => void;
  themes: readonly Theme[];
}

/** Thin wrapper around useThemeStore — preserves the original hook API. */
export function useTheme(): UseThemeReturn {
  return useThemeStore();
}
