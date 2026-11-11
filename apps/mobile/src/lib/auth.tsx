import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthResponse, User } from './shared';
import { api, setUnauthorizedHandler, tokenStore } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); });
    (async () => {
      try {
        if (await tokenStore.load()) setUser(await api<User>('/auth/me'));
      } catch {
        await tokenStore.set(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [logout]);

  const login = async (phone: string, password: string) => {
    const r = await api<AuthResponse>('/auth/login', { body: { phone, password } });
    await tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  };

  return <Ctx.Provider value={{ user, loading, login, logout, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
