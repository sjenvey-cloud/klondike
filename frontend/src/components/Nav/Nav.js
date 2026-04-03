import React from 'react';
import { NavLink } from 'react-router-dom';
import './Nav.css';

const TABS = [
  { to: '/',        icon: '🏠', label: 'Home',    exact: true },
  { to: '/game',    icon: '🃏', label: 'Game'  },
  { to: '/daily',   icon: '🌅', label: 'Daily' },
  { to: '/friends', icon: '👥', label: 'Social' },
  { to: '/profile', icon: '👤', label: 'Profile' },
];

export function Nav() {
  return (
    <nav className="nav">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          exact={tab.exact}
          className="nav-tab"
          activeClassName="active"
        >
          <span className="nav-tab-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
