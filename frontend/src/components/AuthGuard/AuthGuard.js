import React, { useContext } from 'react';
import { Redirect } from 'react-router-dom';
import { AuthContext } from '../../App';

export function AuthGuard({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-table)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--color-text-secondary)',
        fontSize: '15px',
      }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return children;
}
