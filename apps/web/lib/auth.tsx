'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthResponse, Role, User } from '@rentora/shared';
import { api, setUnauthorizedHandler, tokenStore } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  register: (input: { name: string; phone: string; password: string; email?: string; role: 'OWNER' | 'MANAGER' }) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

export const homeFor = (role: Role) => (role === 'TENANT' ? '/tenant' : '/owner');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) { setLoading(false); return; }
    api<User>('/auth/me').then(setUser).catch(() => tokenStore.set(null)).finally(() => setLoading(false));
  }, [logout]);

  const finish = (r: AuthResponse) => { tokenStore.set(r.token); setUser(r.user); return r.user; };
  const login = async (phone: string, password: string) => finish(await api<AuthResponse>('/auth/login', { body: { phone, password } }));
  const register: AuthState['register'] = async input => finish(await api<AuthResponse>('/auth/register', { body: input }));

  return <Ctx.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
