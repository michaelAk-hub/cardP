import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ApiError, apiFetch, messageOf, RequestOptions } from '../api/http';
import { API_URL } from '../config';
import { Student, TokenPair } from '../api/types';
import { tokenStore } from './tokenStore';

export interface RegisterInput {
  name: string;
  surname: string;
  email: string;
  phone: string;
  universityId: string;
  password: string;
  marketingConsent: boolean;
}

interface AuthContextValue {
  booting: boolean;
  student: Student | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Authenticated JSON request with automatic refresh-on-401.
  request: <T = any>(path: string, opts?: RequestOptions) => Promise<T>;
  // Authenticated raw request (binary, e.g. .pkpass).
  accessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const sessionRef = useRef<TokenPair | null>(null);

  const setSession = (tokens: TokenPair | null) => {
    sessionRef.current = tokens;
  };

  const doRefresh = useCallback(async (): Promise<TokenPair | null> => {
    const current = sessionRef.current;
    if (!current?.refreshToken) return null;
    const { status, data } = await apiFetch<TokenPair>('/auth/student/refresh', {
      method: 'POST',
      body: { refreshToken: current.refreshToken },
    });
    if (status >= 400) return null;
    await tokenStore.save(data);
    setSession(data);
    return data;
  }, []);

  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    setSession(null);
    setStudent(null);
  }, []);

  const request = useCallback(
    async <T,>(path: string, opts: RequestOptions = {}): Promise<T> => {
      let res = await apiFetch<T>(path, {
        ...opts,
        token: sessionRef.current?.accessToken,
      });
      if (res.status === 401 && sessionRef.current?.refreshToken) {
        const refreshed = await doRefresh();
        if (!refreshed) {
          await clearSession();
          throw new ApiError(401, 'Session expired');
        }
        res = await apiFetch<T>(path, { ...opts, token: refreshed.accessToken });
      }
      if (res.status >= 400) {
        throw new ApiError(res.status, messageOf(res.data));
      }
      return res.data;
    },
    [doRefresh, clearSession],
  );

  const refreshProfile = useCallback(async () => {
    const me = await request<Student>('/auth/student/me');
    setStudent(me);
  }, [request]);

  const adopt = useCallback(
    async (payload: { student: Student; tokens: TokenPair }) => {
      await tokenStore.save(payload.tokens);
      setSession(payload.tokens);
      setStudent(payload.student);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { status, data } = await apiFetch<{ student: Student; tokens: TokenPair }>(
        '/auth/student/login',
        { method: 'POST', body: { email, password } },
      );
      if (status >= 400) throw new ApiError(status, messageOf(data, 'Login failed'));
      await adopt(data);
    },
    [adopt],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { status, data } = await apiFetch<{ student: Student; tokens: TokenPair }>(
        '/auth/student/register',
        { method: 'POST', body: input },
      );
      if (status >= 400) throw new ApiError(status, messageOf(data, 'Registration failed'));
      await adopt(data);
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    const refreshToken = sessionRef.current?.refreshToken;
    if (refreshToken) {
      await apiFetch('/auth/student/logout', {
        method: 'POST',
        body: { refreshToken },
      }).catch(() => undefined);
    }
    await clearSession();
  }, [clearSession]);

  // Bootstrap: restore a stored session and load the profile.
  useEffect(() => {
    (async () => {
      const tokens = await tokenStore.load();
      if (tokens) {
        setSession(tokens);
        try {
          await refreshProfile();
        } catch {
          await clearSession();
        }
      }
      setBooting(false);
    })();
  }, [refreshProfile, clearSession]);

  const value: AuthContextValue = {
    booting,
    student,
    isAuthenticated: !!student,
    login,
    register,
    logout,
    refreshProfile,
    request,
    accessToken: () => sessionRef.current?.accessToken ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { API_URL };
