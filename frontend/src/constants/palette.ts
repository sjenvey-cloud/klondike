// DEV-337: canonical cross-platform palette. These hex values are the single
// source of truth and must match the iOS SettingsView / Preferences.defaults so
// a named theme looks identical on web and iOS.

export interface FeltTheme {
  name: string;   // canonical themeName stored in preferences
  label: string;
  hex: string;
}

/** The three named felt themes shared with iOS. */
export const FELT_THEMES: readonly FeltTheme[] = [
  { name: 'dark-premium',   label: 'Dark Premium',   hex: '#0d1117' },
  { name: 'classic-felt',   label: 'Classic Felt',   hex: '#1a5c2e' },
  { name: 'modern-minimal', label: 'Modern Minimal', hex: '#2d2d2d' },
];

/** Extra felt colours available on web only — stored as themeName = null ("custom"). */
export const FELT_CUSTOM: readonly FeltTheme[] = [
  { name: 'custom', label: 'Dark Indigo', hex: '#1a1a2e' },
  { name: 'custom', label: 'Dark Brown',  hex: '#2d1a0e' },
  { name: 'custom', label: 'Deep Navy',   hex: '#0e1a2d' },
];

/** Six canonical card-back colours shared with iOS. */
export const CARD_BACK_COLOURS: readonly { hex: string; label: string }[] = [
  { hex: '#1c2333', label: 'Dark Navy' },
  { hex: '#2d1b4e', label: 'Deep Purple' },
  { hex: '#1a3a2e', label: 'Forest' },
  { hex: '#3a1a1a', label: 'Burgundy' },
  { hex: '#1a2a3a', label: 'Midnight Blue' },
  { hex: '#2a2a2a', label: 'Charcoal' },
];

/** Returns the canonical theme name for a felt hex, or null when it's a custom colour. */
export function themeNameForFelt(hex: string): string | null {
  const match = FELT_THEMES.find(t => t.hex.toLowerCase() === hex.toLowerCase());
  return match ? match.name : null;
}
