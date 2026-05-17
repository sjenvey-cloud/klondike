import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { usePreferences } from '../hooks/usePreferences';
import './Settings.css';

interface ThemePreview {
  bg: string;
  surface: string;
  accent: string;
  text: string;
  label: string;
}

const THEME_PREVIEWS: Record<string, ThemePreview> = {
  dark:    { bg: '#0d1117', surface: '#161b22', accent: '#c9a84c', text: '#e6edf3', label: 'Dark Premium' },
  classic: { bg: '#1a5c2e', surface: '#0d3d1e', accent: '#f5c518', text: '#f0ead6', label: 'Classic Felt' },
  modern:  { bg: '#e8eaed', surface: '#ffffff', accent: '#2563eb', text: '#1f2937', label: 'Modern Minimal' },
};

const CARD_BACK_COLOURS = [
  { hex: '#1c2333', label: 'Dark Navy' },
  { hex: '#2d1b4e', label: 'Deep Purple' },
  { hex: '#1a3a2e', label: 'Forest' },
  { hex: '#3a1a1a', label: 'Burgundy' },
  { hex: '#1a2a3a', label: 'Midnight Blue' },
  { hex: '#2a2a2a', label: 'Charcoal' },
];
const FELT_COLOURS = [
  { hex: '#0d1117', label: 'Black' },
  { hex: '#1a5c2e', label: 'Classic Green' },
  { hex: '#e8eaed', label: 'Light Grey' },
  { hex: '#1a1a2e', label: 'Dark Indigo' },
  { hex: '#2d1a0e', label: 'Dark Brown' },
  { hex: '#0e1a2d', label: 'Deep Navy' },
];

const CDN = (import.meta as unknown as { env: Record<string, string> }).env.VITE_THEMES_CDN_URL || '';
const CARD_BACK_PATTERNS = [
  { key: 'dark-premium', label: 'Dark Premium', url: `${CDN}/patterns/card-back-dark-premium.svg`, accent: '#c9a84c' },
  { key: 'classic',      label: 'Classic',       url: `${CDN}/patterns/card-back-classic.svg`,      accent: '#f5f0e8' },
  { key: 'modern',       label: 'Modern',        url: `${CDN}/patterns/card-back-modern.svg`,       accent: '#93c5fd' },
];

const CARD_DESIGNS = [
  { key: 'standard', label: 'Standard' },
  { key: 'classic',  label: 'Classic'  },
  { key: 'minimal',  label: 'Minimal'  },
];

export function Settings(): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreference } = usePreferences();

  const drawMode        = preferences?.drawModeDefault   ?? 'draw3';
  const cardBackColour  = preferences?.cardBackColour    ?? '#1c2333';
  const cardBackPattern = preferences?.cardBackPattern   ?? null;
  const feltColour      = preferences?.feltColour        ?? FELT_COLOURS[0].hex;
  const animEnabled     = preferences?.animationsEnabled !== false;
  const cardFaceDesign  = preferences?.cardFaceDesign    ?? 'standard';

  function selectPattern(url: string): void {
    updatePreference('cardBackPattern', url);
  }

  function selectColour(colour: string): void {
    updatePreference('cardBackPattern', '');   // empty string clears server-side; falsy locally
    updatePreference('cardBackColour', colour);
  }

  return (
    <div className="screen settings-screen">
      <h2 className="section-title">Settings</h2>

      {/* ── Theme ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Theme</h3>
        <div className="theme-grid" role="radiogroup" aria-label="Theme">
          {Object.entries(THEME_PREVIEWS).map(([key, t]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={theme === key}
              className={`theme-card${theme === key ? ' selected' : ''}`}
              onClick={() => setTheme(key as 'dark' | 'classic' | 'modern')}
              style={{ background: t.bg, borderColor: theme === key ? t.accent : 'transparent' }}
            >
              <div className="theme-preview" style={{ background: t.surface, borderColor: t.accent }} aria-hidden="true">
                <span style={{ color: t.accent }}>♠ A</span>
              </div>
              <span className="theme-label" style={{ color: t.text }}>{t.label}</span>
              {theme === key && (
                <div className="theme-check" style={{ color: t.accent }} aria-hidden="true">✓</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Draw Mode Default ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Draw Mode Default</h3>
        <div className="pill-toggle">
          <button
            className={`pill-btn${drawMode === 'draw1' ? ' pill-btn--active' : ''}`}
            onClick={() => updatePreference('drawModeDefault', 'draw1')}
          >
            Draw 1
          </button>
          <button
            className={`pill-btn${drawMode === 'draw3' ? ' pill-btn--active' : ''}`}
            onClick={() => updatePreference('drawModeDefault', 'draw3')}
          >
            Draw 3
          </button>
        </div>
      </div>

      {/* ── Card Face Design ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Card Face Design</h3>
        <div className="design-cards" role="radiogroup" aria-label="Card face design">
          {CARD_DESIGNS.map(d => (
            <button
              key={d.key}
              type="button"
              role="radio"
              aria-checked={cardFaceDesign === d.key}
              className={`design-card${cardFaceDesign === d.key ? ' design-card--active' : ''}`}
              onClick={() => updatePreference('cardFaceDesign', d.key)}
            >
              <div className={`design-card-preview design-card-preview--${d.key}`} aria-hidden="true">
                <span className="design-card-suit">♠</span>
                <span className="design-card-rank">A</span>
              </div>
              <span className="design-card-label">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Card Back ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Card Back</h3>

        {/* Pattern tiles */}
        <div className="pattern-grid">
          {CARD_BACK_PATTERNS.map(p => (
            <button
              key={p.key}
              className={`pattern-tile${cardBackPattern === p.url ? ' pattern-tile--active' : ''}`}
              style={{
                backgroundImage: `url("${p.url}")`,
                backgroundSize: '40px 40px',
                borderColor: cardBackPattern === p.url ? p.accent : 'transparent',
              }}
              aria-label={p.label}
              onClick={() => selectPattern(p.url)}
              title={p.label}
            >
              {cardBackPattern === p.url && (
                <span className="pattern-tile-check" style={{ color: p.accent }}>✓</span>
              )}
              <span className="pattern-tile-label">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Flat colour swatches */}
        <p className="settings-subsection-label">Flat colour</p>
        <div className="swatch-row" role="radiogroup" aria-label="Card back colour">
          {CARD_BACK_COLOURS.map(c => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={!cardBackPattern && cardBackColour === c.hex}
              className={`swatch${!cardBackPattern && cardBackColour === c.hex ? ' active' : ''}`}
              style={{ background: c.hex }}
              aria-label={c.label}
              onClick={() => selectColour(c.hex)}
            />
          ))}
        </div>
      </div>

      {/* ── Felt Colour ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Felt Colour</h3>
        <div className="swatch-row" role="radiogroup" aria-label="Felt colour">
          {FELT_COLOURS.map(c => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={feltColour === c.hex}
              className={`swatch${feltColour === c.hex ? ' active' : ''}`}
              style={{ background: c.hex }}
              aria-label={c.label}
              onClick={() => updatePreference('feltColour', c.hex)}
            />
          ))}
        </div>
      </div>

      {/* ── Animations ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Animations</h3>
        <div className="toggle-row">
          <span className="toggle-label" aria-hidden="true">{animEnabled ? 'On' : 'Off'}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={animEnabled}
              aria-label={`Animations ${animEnabled ? 'on' : 'off'}`}
              onChange={e => updatePreference('animationsEnabled', e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>
      </div>

      {/* ── Draw Mode info ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Draw Mode</h3>
        <div className="draw-mode-box">
          <p className="draw-mode-text">{drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}</p>
          <p className="draw-mode-note">
            {drawMode === 'draw1'
              ? 'Draw 1 moves one card at a time from the stock to the waste. Easier and faster to clear.'
              : 'Draw 3 moves up to 3 cards from the stock to the waste — only the top card is playable.'}
          </p>
        </div>
      </div>

      {/* ── About ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">About</h3>
        <p className="about-text">
          Klondike Pro · Draw 1 &amp; Draw 3 · Server-validated wins · Real-time leaderboards
        </p>
      </div>
    </div>
  );
}
