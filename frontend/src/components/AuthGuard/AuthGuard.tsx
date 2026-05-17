import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function AuthGuard({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { user, loading } = useAuth();

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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</> ;
}
