import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  setAuthRefreshHandler,
} from "@workspace/api-client-react";
import type { CurrentUserResponse } from "@workspace/api-client-react";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "@/lib/auth-token";

interface LoginParams {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: CurrentUserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: LoginParams) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    queryClient.clear();
    clearTokens();
    setUser(null);
  }, [queryClient]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      return false;
    }
    try {
      const refreshed = await apiRefreshToken({ refreshToken });
      setTokens(
        refreshed.data.accessToken,
        refreshed.data.refreshToken,
        refreshed.data.expiresAt,
      );
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [clearSession]);

  useEffect(() => {
    setAuthRefreshHandler(refreshSession);
    return () => setAuthRefreshHandler(null);
  }, [refreshSession]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = getAccessToken();

      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const result = await getCurrentUser();

        if (cancelled) return;

        if (result?.data) {
          setUser(result.data);
        } else {
          clearSession();
        }
      } catch {
        if (await refreshSession()) {
          try {
            const result = await getCurrentUser();
            if (cancelled) return;

            if (result?.data) {
              setUser(result.data);
            } else {
              clearSession();
            }
          } catch {
            if (!cancelled) clearSession();
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession, refreshSession]);

  const login = useCallback(
    async ({ email, password }: LoginParams) => {
      clearSession();

      try {
        const result = await apiLogin({ email, password });
        setTokens(
          result.data.accessToken,
          result.data.refreshToken,
          result.data.expiresAt,
        );

        const me = await getCurrentUser();
        if (!me?.data) throw new Error("Invalid current user response.");

        setUser(me.data);
      } catch (error) {
        clearSession();
        throw error;
      }
    },
    [clearSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();

    clearSession();

    if (refreshToken) {
      try {
        await apiLogout({ refreshToken });
      } catch {
        // Ignore logout errors — clear local session regardless.
      }
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
}
