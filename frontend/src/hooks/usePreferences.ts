import { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '../App';
import { getPreferences, patchPreferences } from '../services/api';
import type { UserPreferences } from '../types/api';
import type { PreferencesContextValue } from '../contexts/PreferencesContext';

const DEFAULTS: UserPreferences = {
  cardBackColour:    '#1c2333',
  cardBackPattern:   null,
  feltColour:        '#2d6a4f',
  animationsEnabled: true,
  cardFaceDesign:    'classic',
  cardStyle:         'classic',   // 'classic' | 'modern' | 'fantasy'
  stockSide:         'left',      // 'left' | 'right'
  animationSpeed:    'normal',    // 'slow' | 'normal' | 'fast'
  winAnimation:      'confetti',  // 'confetti' | 'simple'
};

const ANIM_DURATION: Record<string, string> = { slow: '300ms', normal: '150ms', fast: '50ms' };

function applyPreferences(prefs: UserPreferences): void {
  const html = document.documentElement;
  if (prefs.feltColour) {
    html.style.setProperty('--color-table', prefs.feltColour);
  }
  if (prefs.cardBackColour) {
    html.style.setProperty('--color-card-back', prefs.cardBackColour);
  }
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

export function usePreferences(): PreferencesContextValue {
  const { user } = useContext(AuthContext);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULTS);

  useEffect(() => {
    if (!user) return;
    getPreferences()
      .then(prefs => {
        const merged: UserPreferences = { ...DEFAULTS, ...prefs };
        setPreferences(merged);
        applyPreferences(merged);
      })
      .catch(() => {
        // Server unavailable — apply defaults so CSS vars are consistent
        applyPreferences(DEFAULTS);
      });
  }, [user]);

  const updatePreference = useCallback(async (
    key: keyof UserPreferences,
    value: UserPreferences[keyof UserPreferences],
  ): Promise<void> => {
    const next: UserPreferences = { ...preferences, [key]: value };
    setPreferences(next);
    applyPreferences(next);
    try {
      await patchPreferences({ [key]: value });
    } catch { /* best-effort */ }
  }, [preferences]);

  return { preferences, updatePreference };
}
