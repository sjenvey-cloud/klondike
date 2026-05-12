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

export function Nav({ challengeBadge = 0 }) {
  return (
    <nav className="nav">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
        >
          <span className="nav-tab-icon-wrap">
            <span className="nav-tab-icon">{tab.icon}</span>
            {tab.badge && challengeBadge > 0 && (
              <span className="nav-heart-badge" aria-label={`${challengeBadge} pending challenge${challengeBadge !== 1 ? 's' : ''}`}>
                ♥
              </span>
            )}
          </span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
