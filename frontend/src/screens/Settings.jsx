import React, { useContext } from 'react';
import { ThemeContext } from '../App';
import { PreferencesContext } from '../contexts/PreferencesContext';
import './Settings.css';

const THEME_PREVIEWS = {
  dark:    { bg: '#0d1117', surface: '#161b22', accent: '#c9a84c', text: '#e6edf3', label: 'Dark Premium' },
  classic: { bg: '#1a5c2e', surface: '#0d3d1e', accent: '#f5c518', text: '#f0ead6', label: 'Classic Felt' },
  modern:  { bg: '#e8eaed', surface: '#ffffff', accent: '#2563eb', text: '#1f2937', label: 'Modern Minimal' },
};

const CARD_BACK_COLOURS = ['#1c2333', '#2d1b4e', '#1a3a2e', '#3a1a1a', '#1a2a3a', '#2a2a2a'];
const FELT_COLOURS      = ['#0d1117', '#1a5c2e', '#e8eaed', '#1a1a2e', '#2d1a0e', '#0e1a2d'];

const CARD_DESIGNS = [
  { key: 'standard', label: 'Standard' },
  { key: 'classic',  label: 'Classic'  },
  { key: 'minimal',  label: 'Minimal'  },
];

export function Settings() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { preferences, updatePreference } = useContext(PreferencesContext);

  const drawMode        = preferences?.drawModeDefault   ?? 'draw3';
  const cardBackColour  = preferences?.cardBackColour    ?? '#1c2333';
  const feltColour      = preferences?.feltColour        ?? '#0d1117';
  const animEnabled     = preferences?.animationsEnabled !== false;
  const cardFaceDesign  = preferences?.cardFaceDesign    ?? 'standard';

  return (
    <div className="screen settings-screen">
      <h2 className="section-title">Settings</h2>

      {/* ── Theme ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Theme</h3>
        <div className="theme-grid">
          {Object.entries(THEME_PREVIEWS).map(([key, t]) => (
            <div
              key={key}
              className={`theme-card${theme === key ? ' selected' : ''}`}
              onClick={() => setTheme(key)}
              style={{ background: t.bg, borderColor: theme === key ? t.accent : 'transparent' }}
            >
              <div className="theme-preview" style={{ background: t.surface, borderColor: t.accent }}>
                <span style={{ color: t.accent }}>♠ A</span>
              </div>
              <span className="theme-label" style={{ color: t.text }}>{t.label}</span>
              {theme === key && (
                <div className="theme-check" style={{ color: t.accent }}>✓</div>
              )}
            </div>
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
        <div className="design-cards">
          {CARD_DESIGNS.map(d => (
            <div
              key={d.key}
              className={`design-card${cardFaceDesign === d.key ? ' design-card--active' : ''}`}
              onClick={() => updatePreference('cardFaceDesign', d.key)}
            >
              <div className={`design-card-preview design-card-preview--${d.key}`}>
                <span className="design-card-suit">♠</span>
                <span className="design-card-rank">A</span>
              </div>
              <span className="design-card-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card Back Colour ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Card Back Colour</h3>
        <div className="swatch-row">
          {CARD_BACK_COLOURS.map(colour => (
            <button
              key={colour}
              className={`swatch${cardBackColour === colour ? ' active' : ''}`}
              style={{ background: colour }}
              aria-label={colour}
              onClick={() => updatePreference('cardBackColour', colour)}
            />
          ))}
        </div>
      </div>

      {/* ── Felt Colour ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Felt Colour</h3>
        <div className="swatch-row">
          {FELT_COLOURS.map(colour => (
            <button
              key={colour}
              className={`swatch${feltColour === colour ? ' active' : ''}`}
              style={{ background: colour }}
              aria-label={colour}
              onClick={() => updatePreference('feltColour', colour)}
            />
          ))}
        </div>
      </div>

      {/* ── Animations ── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Animations</h3>
        <div className="toggle-row">
          <span className="toggle-label">{animEnabled ? 'On' : 'Off'}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={animEnabled}
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
