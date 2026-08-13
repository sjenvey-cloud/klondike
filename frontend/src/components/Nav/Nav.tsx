import React from 'react';
import { NavLink } from 'react-router-dom';
import './Nav.css';

const TABS = [
  { to: '/',            icon: '🏠', label: 'Home',   end: true },
  { to: '/game',        icon: '🃏', label: 'Game'   },
  { to: '/daily',       icon: '🌅', label: 'Daily'  },
  { to: '/leaderboard', icon: '🏆', label: 'Ranks'  },
  { to: '/friends',     icon: '👥', label: 'Social', badge: true },
  { to: '/profile',     icon: '👤', label: 'Profile' },
];

export function Nav({ challengeBadge = 0 }: { challengeBadge?: number }): React.JSX.Element {
  return (
    <nav className="nav" aria-label="Main navigation">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
        >
          <span className="nav-tab-icon-wrap">
            <span className="nav-tab-icon" aria-hidden="true">{tab.icon}</span>
            {tab.badge && challengeBadge > 0 && (
              <span
                className="nav-heart-badge nav-count-badge"
                aria-label={`${challengeBadge} social notification${challengeBadge !== 1 ? 's' : ''}`}
              >
                <span aria-hidden="true">{challengeBadge > 9 ? '9+' : challengeBadge}</span>
              </span>
            )}
          </span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
