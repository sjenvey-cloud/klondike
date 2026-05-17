import { createContext } from 'react';
import type { UserPreferences } from '../types/api';

export interface PreferencesContextValue {
  preferences: UserPreferences | null;
  updatePreference: (key: keyof UserPreferences, value: UserPreferences[keyof UserPreferences]) => Promise<void>;
}

const noop = async (): Promise<void> => {};

export const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: null,
  updatePreference: noop,
});
