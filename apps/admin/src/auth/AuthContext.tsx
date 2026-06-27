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
import { AdminView, TokenPair } from '../api/types';

const STORAGE_KEY = 'bluecard.admin.session';

export type LoginResult =
  | { kind: 'authenticated' }
  | { kind: 'enroll'; enrollmentToken: string; otpauthUrl: string; qrDataUrl: string }
  | { kind: 'needCode' };

interface AuthContextValue {
  booting: boolean;
  admin: AdminView | null;
  isAuthenticated: boolean;
  isRoot: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<LoginResult>;
  verifyEnrollment: (enrollmentToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  request: <T = any>(path: string, opts?: RequestOptions) => Promise<T>;
  requestBlob: (path: string) => Promise<Blob>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadTokens(): TokenPair | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenPair;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [admin, setAdmin] = useState<AdminView | null>(null);
  const sessionRef = useRef<TokenPair | null>(null);

  const setSession = (tokens: TokenPair | null) => {
    sessionRef.current = tokens;
    if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const doRefresh = useCallback(async (): Promise<TokenPair | null> => {
    const current = sessionRef.current;
    if (!current?.refreshToken) return null;
    const { status, data } = await apiFetch<TokenPair>('/auth/admin/refresh', {
      method: 'POST',
      body: { refreshToken: current.refreshToken },
    });
    if (status >= 400) return null;
    setSession(data);
    return data;
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    setAdmin(null);
  }, []);

  const request = useCallback(
    async <T,>(path: string, opts: RequestOptions = {}): Promise<T> => {
      let res = await apiFetch<T>(path, { ...opts, token: sessionRef.current?.accessToken });
      if (res.status === 401 && sessionRef.current?.refreshToken) {
        const refreshed = await doRefresh();
        if (!refreshed) {
          clearSession();
          throw new ApiError(401, 'Session expired');
        }
        res = await apiFetch<T>(path, { ...opts, token: refreshed.accessToken });
      }
      if (res.status >= 400) throw new ApiError(res.status, messageOf(res.data));
      return res.data;
    },
    [doRefresh, clearSession],
  );

  // Authenticated binary fetch (ID photos streamed by the API for the local driver).
  const requestBlob = useCallback(
    async (path: string): Promise<Blob> => {
      const doFetch = (token?: string | null) =>
        fetch(API_URL + path, {
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
        });
      let res = await doFetch(sessionRef.current?.accessToken);
      if (res.status === 401) {
        const refreshed = await doRefresh();
        if (refreshed) res = await doFetch(refreshed.accessToken);
      }
      if (!res.ok) throw new ApiError(res.status, 'Failed to load image');
      return res.blob();
    },
    [doRefresh],
  );

  const loadProfile = useCallback(async () => {
    const me = await request<AdminView>('/auth/admin/me');
    setAdmin(me);
  }, [request]);

  const login = useCallback(
    async (email: string, password: string, totpCode?: string): Promise<LoginResult> => {
      const { status, data } = await apiFetch<any>('/auth/admin/login', {
        method: 'POST',
        body: { email, password, totpCode },
      });
      if (status === 200 && data?.status === 'ok') {
        setSession(data.tokens);
        setAdmin(data.admin);
        return { kind: 'authenticated' };
      }
      if (status === 200 && data?.status === 'totp_enrollment_required') {
        return {
          kind: 'enroll',
          enrollmentToken: data.enrollmentToken,
          otpauthUrl: data.otpauthUrl,
          qrDataUrl: data.qrDataUrl,
        };
      }
      if (status === 401 && /totp code required/i.test(messageOf(data, ''))) {
        return { kind: 'needCode' };
      }
      throw new ApiError(status, messageOf(data, 'Login failed'));
    },
    [],
  );

  const verifyEnrollment = useCallback(
    async (enrollmentToken: string, code: string) => {
      const { status, data } = await apiFetch<any>('/auth/admin/totp/verify', {
        method: 'POST',
        body: { enrollmentToken, code },
      });
      if (status >= 400) throw new ApiError(status, messageOf(data, 'Verification failed'));
      setSession(data.tokens);
      setAdmin(data.admin);
    },
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = sessionRef.current?.refreshToken;
    if (refreshToken) {
      await apiFetch('/auth/admin/logout', {
        method: 'POST',
        body: { refreshToken },
      }).catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    const tokens = loadTokens();
    if (tokens) {
      sessionRef.current = tokens;
      loadProfile()
        .catch(() => clearSession())
        .finally(() => setBooting(false));
    } else {
      setBooting(false);
    }
  }, [loadProfile, clearSession]);

  const value: AuthContextValue = {
    booting,
    admin,
    isAuthenticated: !!admin,
    isRoot: admin?.role === 'root',
    login,
    verifyEnrollment,
    logout,
    request,
    requestBlob,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
