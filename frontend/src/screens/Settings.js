import React, { useContext } from 'react';
import { ThemeContext } from '../App';
import './Settings.css';

const THEME_PREVIEWS = {
  dark:    { bg: '#0d1117', surface: '#161b22', accent: '#c9a84c', text: '#e6edf3', label: 'Dark Premium' },
  classic: { bg: '#1a5c2e', surface: '#0d3d1e', accent: '#f5c518', text: '#f0ead6', label: 'Classic Felt' },
  modern:  { bg: '#e8eaed', surface: '#ffffff', accent: '#2563eb', text: '#1f2937', label: 'Modern Minimal' },
};

export function Settings() {
  const { theme, setTheme } = useContext(ThemeContext);

  return (
    <div className="screen settings-screen">
      <h2 className="section-title">Settings</h2>

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

      <div className="settings-section">
        <h3 className="settings-section-title">Draw Mode</h3>
        <div className="draw-mode-box">
          <p className="draw-mode-text">Draw 3</p>
          <p className="draw-mode-note">
            Draw 3 is the only supported mode. Each draw moves up to 3 cards
            from the stock to the waste — only the top card is playable.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">About</h3>
        <p className="about-text">
          Klondike Pro · Draw 3 · Server-validated wins · Real-time leaderboards
        </p>
      </div>
    </div>
  );
}
