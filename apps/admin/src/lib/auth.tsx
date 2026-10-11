'use client';

import type { StaffAuthResponse, StaffDto, StaffRole } from '@kirilovskiy/shared';
import { useRouter } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

interface AuthState {
  staff: StaffDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: StaffRole[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffDto | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setStaff(null);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<StaffDto>('/admin/auth/me')
      .then(setStaff)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<StaffAuthResponse>('/admin/auth/login', { email, password });
    setToken(res.accessToken);
    setStaff(res.staff);
  }, []);

  const can = useCallback((...roles: StaffRole[]) => !!staff && roles.includes(staff.role), [staff]);

  const value = useMemo(() => ({ staff, loading, login, logout, can }), [staff, loading, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
