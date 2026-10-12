import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../api/types';
import { ApiError, api, onUnauthorized, readAuthToken, writeAuthToken } from '../api/client';

const USER_CACHE_KEY = 'kovies_user';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed && typeof parsed.email === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: UserProfile | null): void {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // ignore storage failures
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => readAuthToken());
  const [user, setUser] = useState<UserProfile | null>(() => (readAuthToken() ? readCachedUser() : null));
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(readAuthToken()));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const clearSession = useCallback(() => {
    writeAuthToken(null);
    writeCachedUser(null);
    setToken(null);
    setUser(null);
  }, []);

  const startSession = useCallback((nextToken: string, nextUser: UserProfile) => {
    writeAuthToken(nextToken);
    writeCachedUser(nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  // Any 401 from user/* or auth/me drops the session.
  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  // Validate a stored token once on startup.
  useEffect(() => {
    if (!readAuthToken()) return;
    const controller = new AbortController();
    api
      .me(controller.signal)
      .then((res) => {
        setUser(res.user);
        writeCachedUser(res.user);
      })
      .catch((err) => {
        // 401 is handled by onUnauthorized; network errors keep the cached session.
        if (err instanceof ApiError && err.status === 401) clearSession();
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [clearSession]);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email: email.trim(), password });
      startSession(res.token, res.user);
      setIsAuthModalOpen(false);
    },
    [startSession]
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await api.register({ email: email.trim(), password, displayName: displayName.trim() });
      startSession(res.token, res.user);
      setIsAuthModalOpen(false);
    },
    [startSession]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      login,
      register,
      logout: clearSession,
    }),
    [user, token, isLoading, isAuthModalOpen, openAuthModal, closeAuthModal, login, register, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
