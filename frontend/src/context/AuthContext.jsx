import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('fitgoals_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('fitgoals_token') || null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('register'); // 'login' or 'register'

  const refreshUser = useCallback(async (email) => {
    const targetEmail = email || user?.email;
    if (!targetEmail) return;
    try {
      const res = await fetch(`/api/auth/me?email=${encodeURIComponent(targetEmail)}`);
      if (res.ok) {
        const fresh = await res.json();
        setUser(fresh);
        localStorage.setItem('fitgoals_user', JSON.stringify(fresh));
      }
    } catch (e) {
      console.warn("Failed to refresh user stats:", e);
    }
  }, [user?.email]);

  useEffect(() => {
    if (user?.email) {
      refreshUser(user.email);
    }
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Login failed');
    }
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('fitgoals_user', JSON.stringify(data.user));
    localStorage.setItem('fitgoals_token', data.token);
    setIsAuthModalOpen(false);
    return data;
  };

  const register = async ({ name, email, password, height, weight, photo }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        height: parseFloat(height),
        weight: parseFloat(weight),
        photo: photo || null
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Registration failed');
    }
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('fitgoals_user', JSON.stringify(data.user));
    localStorage.setItem('fitgoals_token', data.token);
    setIsAuthModalOpen(false);
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('fitgoals_user');
    localStorage.removeItem('fitgoals_token');
  };

  const openAuthModal = (tab = 'register') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        refreshUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        openAuthModal
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
