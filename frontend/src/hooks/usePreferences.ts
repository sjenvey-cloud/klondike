import { usePreferencesStore } from '../stores/preferencesStore';
import type { UserPreferences } from '../types/api';
import type { PreferencesContextValue } from '../contexts/PreferencesContext';

// Re-export so consumers that imported DEFAULTS from here still compile.
export type { PreferencesContextValue };

/** Thin wrapper around usePreferencesStore — preserves the original hook API. */
export function usePreferences(): PreferencesContextValue {
  const { preferences, updatePreference } = usePreferencesStore();
  return { preferences, updatePreference };
}
