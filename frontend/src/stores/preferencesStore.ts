import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { getPreferences, patchPreferences } from '../services/api';
import type { UserPreferences } from '../types/api';

const DEFAULTS: UserPreferences = {
  cardBackColour:    '#1c2333',
  cardBackPattern:   null,
  feltColour:        '#2d6a4f',
  animationsEnabled: true,
  cardFaceDesign:    'classic',
  cardStyle:         'classic',
  stockSide:         'left',
  animationSpeed:    'normal',
  winAnimation:      'confetti',
};

const ANIM_DURATION: Record<string, string> = { slow: '300ms', normal: '150ms', fast: '50ms' };

function applyPreferences(prefs: UserPreferences): void {
  const html = document.documentElement;
  if (prefs.feltColour)      html.style.setProperty('--color-table',     prefs.feltColour);
  if (prefs.cardBackColour)  html.style.setProperty('--color-card-back', prefs.cardBackColour);
  if (prefs.cardBackPattern) {
    html.style.setProperty('--card-back-image', `url("${prefs.cardBackPattern}")`);
  } else {
    html.style.removeProperty('--card-back-image');
  }
  if (prefs.animationsEnabled === false) {
    html.classList.add('animations-off');
  } else {
    html.classList.remove('animations-off');
  }
  const speed = prefs.animationSpeed ?? 'normal';
  html.dataset['animSpeed'] = speed;
  html.style.setProperty('--anim-duration', ANIM_DURATION[speed] ?? ANIM_DURATION['normal']);
}

interface PreferencesState {
  preferences: UserPreferences;
  loadPreferences: () => Promise<void>;
  updatePreference: (key: keyof UserPreferences, value: UserPreferences[keyof UserPreferences]) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  preferences: DEFAULTS,

  loadPreferences: async (): Promise<void> => {
    try {
      const prefs   = await getPreferences();
      const merged: UserPreferences = { ...DEFAULTS, ...prefs };
      set({ preferences: merged });
      applyPreferences(merged);
    } catch {
      applyPreferences(DEFAULTS);
    }
  },

  updatePreference: async (
    key: keyof UserPreferences,
    value: UserPreferences[keyof UserPreferences],
  ): Promise<void> => {
    const next: UserPreferences = { ...get().preferences, [key]: value };
    set({ preferences: next });
    applyPreferences(next);
    try {
      await patchPreferences({ [key]: value });
    } catch { /* best-effort */ }
  },
}));

// Subscribe to auth changes: load prefs when a user logs in, reset to defaults on logout.
useAuthStore.subscribe((state, prevState) => {
  if (state.user !== prevState.user) {
    if (state.user) {
      void usePreferencesStore.getState().loadPreferences();
    } else {
      usePreferencesStore.setState({ preferences: DEFAULTS });
      applyPreferences(DEFAULTS);
    }
  }
});

// If a user is already logged in when this module first loads (e.g. page refresh),
// kick off the initial preferences fetch immediately.
if (useAuthStore.getState().user) {
  void usePreferencesStore.getState().loadPreferences();
}
