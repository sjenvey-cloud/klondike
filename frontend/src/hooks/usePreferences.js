import { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '../App';
import { getPreferences, patchPreferences } from '../services/api';

const DEFAULTS = {
  cardBackColour:   '#1c2333',
  cardBackPattern:  null,
  feltColour:       '#0d1117',
  animationsEnabled: true,
  cardFaceDesign:   'standard',
  cardStyle:        null,   // 'classic' | 'modern' | 'fantasy' — takes precedence over cardFaceDesign when set
};

function applyPreferences(prefs) {
  const html = document.documentElement;
  if (prefs.feltColour) {
    html.style.setProperty('--color-table', prefs.feltColour);
  }
  if (prefs.cardBackColour) {
    html.style.setProperty('--color-card-back', prefs.cardBackColour);
  }
  if (prefs.cardBackPattern) {
    // cardBackPattern is a URL string (truthy); empty string or null/undefined means flat colour
    html.style.setProperty('--card-back-image', `url("${prefs.cardBackPattern}")`);
  } else {
    html.style.removeProperty('--card-back-image');
  }
  if (prefs.animationsEnabled === false) {
    html.classList.add('animations-off');
  } else {
    html.classList.remove('animations-off');
  }
}

export function usePreferences() {
  const { user } = useContext(AuthContext);
  const [preferences, setPreferences] = useState(DEFAULTS);

  useEffect(() => {
    if (!user) return;
    getPreferences()
      .then(prefs => {
        const merged = { ...DEFAULTS, ...prefs };
        setPreferences(merged);
        applyPreferences(merged);
      })
      .catch(() => {
        // Server unavailable — apply defaults so CSS vars are consistent
        applyPreferences(DEFAULTS);
      });
  }, [user]);

  const updatePreference = useCallback(async (key, value) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    applyPreferences(next);
    try {
      await patchPreferences({ [key]: value });
    } catch { /* best-effort */ }
  }, [preferences]);

  return { preferences, updatePreference };
}
