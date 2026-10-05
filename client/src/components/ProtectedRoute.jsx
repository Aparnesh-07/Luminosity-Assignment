import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#12100e', color: '#d9a463' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', letterSpacing: '0.1em' }}>
          VERIFYING STUDIO CREDENTIALS...
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
