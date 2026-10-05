import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, getMe as apiGetMe } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    apiGetMe()
      .then((profile) => {
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role
        });
        setStudio(profile.studio);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
        setStudio(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const handleUnauthorized = () => {
      setUser(null);
      setStudio(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    localStorage.setItem('token', res.token);
    setUser(res.user);
    setStudio(res.studio);
    return res;
  };

  const register = async (data) => {
    const res = await apiRegister(data);
    localStorage.setItem('token', res.token);
    setUser(res.user);
    setStudio(res.studio);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setStudio(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        studio,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
