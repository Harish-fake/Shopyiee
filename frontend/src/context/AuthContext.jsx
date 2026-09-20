import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, fetchCsrfToken } from '../api/client.js';

/**
 * Session state.
 *
 * The signed-in user is read from the server on mount rather than from
 * localStorage, so the browser never holds an authoritative copy of the role.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response?.data?.user ?? null);
      return response?.data?.user ?? null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    fetchCsrfToken().catch(() => {});
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const nextUser = response?.data?.user ?? null;
    setUser(nextUser);
    await fetchCsrfToken().catch(() => {});
    return nextUser;
  }, []);

  const register = useCallback(async (payload) => {
    const response = await api.post('/auth/register', payload);
    const nextUser = response?.data?.user ?? null;
    setUser(nextUser);
    await fetchCsrfToken().catch(() => {});
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const response = await api.put('/auth/profile', payload);
    const nextUser = response?.data?.user ?? null;
    setUser(nextUser);
    return nextUser;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api.put('/auth/password', { currentPassword, newPassword });
  }, []);

  /** Re-read the wallet balance after a purchase or top-up. */
  const syncBalance = useCallback(async () => {
    try {
      const response = await api.get('/wallet');
      const balance = response?.data?.balance;
      setUser((current) => (current ? { ...current, walletBalance: balance } : current));
      return balance;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refresh,
      syncBalance,
    }),
    [user, loading, login, register, logout, updateProfile, changePassword, refresh, syncBalance]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
